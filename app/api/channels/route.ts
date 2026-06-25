/**
 * app/api/channels/route.ts
 *
 * GET  — channels visible to the caller, each with unread_count / message_count /
 *        member_count and (for DMs) the partner. Also returns the full `users`
 *        list (for DM creation + @user mention autocomplete), `currentUserId`,
 *        and `totalUnread` (sum of unread messages).
 * POST — create a channel or a DM.
 *
 * Gated by requireAuth (any signed-in user).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, logAuditEvent } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { channelVisibilitySql } from '@/lib/messaging';
import { createNotifications } from '@/lib/notifications';

async function uid(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
    try {
        const { internalUserId } = await getSessionWithUserId();
        return { ok: true, userId: internalUserId };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

// ============================================================================
// GET — list channels
// ============================================================================
export async function GET() {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;

    try {
        const channels = await query<any>(
            `SELECT ch.*,
                (SELECT count(*) FROM messages m
                   WHERE m.channel_id = ch.id AND m.is_deleted = false
                     AND m.created_at > COALESCE(
                       (SELECT last_read_at FROM message_read_status WHERE user_id = $1::uuid AND channel_id = ch.id),
                       '1970-01-01'::timestamptz)
                     AND m.sender_id <> $1::uuid) AS unread_count,
                (SELECT count(*) FROM messages m WHERE m.channel_id = ch.id AND m.is_deleted = false) AS message_count,
                (SELECT count(*) FROM channel_members cm WHERE cm.channel_id = ch.id) AS member_count,
                CASE WHEN ch.channel_type = 'dm' THEN (
                    SELECT json_build_object(
                        'id', u.id,
                        'name', COALESCE(NULLIF(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email))
                    FROM users u
                    WHERE u.id = CASE WHEN ch.dm_user_1 = $1::uuid THEN ch.dm_user_2 ELSE ch.dm_user_1 END
                ) ELSE NULL END AS dm_partner
             FROM channels ch
             WHERE ch.is_archived = false AND ${channelVisibilitySql('$1')}
             ORDER BY ch.last_message_at DESC NULLS LAST, ch.created_at DESC`,
            [me]
        );

        const users = await query<any>(
            `SELECT id, first_name, last_name, display_name, email, role
             FROM users ORDER BY last_name NULLS LAST, first_name NULLS LAST, email`
        );

        const totalUnread = channels.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);

        return NextResponse.json({ channels, users, currentUserId: me, totalUnread });
    } catch (err) {
        console.error('Channels list error:', err);
        return NextResponse.json({ error: 'Failed to load channels' }, { status: 500 });
    }
}

// ============================================================================
// POST — create channel or DM
// ============================================================================
export async function POST(request: NextRequest) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        // ---- Direct message ----
        if (body.channel_type === 'dm') {
            const target = String(body.dm_target_id || '');
            if (!target || target === me) {
                return NextResponse.json({ error: 'A valid DM recipient is required' }, { status: 400 });
            }
            const existing = await queryOne<any>(
                `SELECT * FROM channels
                  WHERE channel_type = 'dm'
                    AND ((dm_user_1 = $1::uuid AND dm_user_2 = $2::uuid)
                      OR (dm_user_1 = $2::uuid AND dm_user_2 = $1::uuid))
                  LIMIT 1`,
                [me, target]
            );
            if (existing) return NextResponse.json({ success: true, channel: existing });

            const created = await queryOne<any>(
                `INSERT INTO channels (name, channel_type, created_by, dm_user_1, dm_user_2)
                 VALUES ('Direct Message', 'dm', $1::uuid, $1::uuid, $2::uuid)
                 RETURNING *`,
                [me, target]
            );
            return NextResponse.json({ success: true, channel: created }, { status: 201 });
        }

        // ---- Regular channel ----
        const name = String(body.name || '').trim();
        if (!name) return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
        const description = body.description ? String(body.description).trim() : null;
        const isPrivate = !!body.is_private;
        const memberIds: string[] = Array.isArray(body.member_ids)
            ? body.member_ids.map(String).filter(Boolean)
            : [];

        if (isPrivate && memberIds.length === 0) {
            return NextResponse.json({ error: 'Private channels need at least one member' }, { status: 400 });
        }

        const channel = await queryOne<any>(
            `INSERT INTO channels (name, channel_type, description, is_private, created_by)
             VALUES ($1, 'general', $2, $3, $4::uuid)
             RETURNING *`,
            [name, description, isPrivate, me]
        );

        if (isPrivate) {
            const all = Array.from(new Set([me, ...memberIds]));
            for (const u of all) {
                await query(
                    `INSERT INTO channel_members (channel_id, user_id, added_by)
                     VALUES ($1::uuid, $2::uuid, $3::uuid)
                     ON CONFLICT (channel_id, user_id) DO NOTHING`,
                    [channel.id, u, me]
                );
            }
            await createNotifications(
                memberIds
                    .filter((u) => u !== me)
                    .map((u) => ({
                        recipientUserId: u,
                        type: 'channel_added' as const,
                        sourceType: 'channel' as const,
                        sourceId: channel.id,
                        channelId: channel.id,
                        actorUserId: me,
                        preview: `You were added to #${name}`,
                    }))
            );
        }

        await logAuditEvent(me, 'create', 'channel', channel.id, { name, is_private: isPrivate });
        return NextResponse.json({ success: true, channel }, { status: 201 });
    } catch (err) {
        console.error('Channel create error:', err);
        return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
    }
}
