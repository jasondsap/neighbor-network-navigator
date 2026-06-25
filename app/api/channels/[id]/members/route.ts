/**
 * app/api/channels/[id]/members/route.ts
 *
 * GET    — roster of a channel the caller can see.
 * POST   — { user_ids: string[] } — add people to a private channel (creator or
 *          admin only). New members get a 'channel_added' notification.
 * DELETE — ?user_id=… — remove a person from a private channel (creator or admin
 *          only; the creator can't be removed — delete the channel instead).
 *
 * Access enforced by getChannelForUser (404 unknown, 403 not allowed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, logAuditEvent } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { getChannelForUser } from '@/lib/messaging';
import { createNotifications, type CreateNotificationInput } from '@/lib/notifications';

async function uid(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
    try {
        const { internalUserId } = await getSessionWithUserId();
        return { ok: true, userId: internalUserId };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

async function isAdmin(userId: string): Promise<boolean> {
    const row = await queryOne<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [userId]);
    return row?.role === 'admin';
}

// ============================================================================
// GET — roster
// ============================================================================
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const { id } = await params;

    const { channel, canAccess } = await getChannelForUser(id, auth.userId);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const members = await query<any>(
            `SELECT cm.user_id, cm.created_at AS added_at, u.role, u.email,
                    COALESCE(NULLIF(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email) AS name
             FROM channel_members cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.channel_id = $1::uuid
             ORDER BY name`,
            [id]
        );
        return NextResponse.json({ members, created_by: channel.created_by });
    } catch (err) {
        console.error('Members list error:', err);
        return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
    }
}

// ============================================================================
// POST — add members
// ============================================================================
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    const { id } = await params;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const userIds: string[] = Array.isArray(body.user_ids)
        ? Array.from(new Set(body.user_ids.filter((u: any) => typeof u === 'string')))
        : [];
    if (!userIds.length) return NextResponse.json({ error: 'user_ids is required' }, { status: 400 });

    const { channel, canAccess } = await getChannelForUser(id, me);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!channel.is_private) {
        return NextResponse.json({ error: 'This is a public channel — everyone already has access' }, { status: 400 });
    }
    if (channel.created_by !== me && !(await isAdmin(me))) {
        return NextResponse.json({ error: 'Only the channel creator can add members' }, { status: 403 });
    }

    try {
        const addedIds: string[] = [];
        for (const memberId of userIds) {
            const inserted = await query(
                `INSERT INTO channel_members (channel_id, user_id, added_by)
                 VALUES ($1::uuid, $2::uuid, $3::uuid)
                 ON CONFLICT (channel_id, user_id) DO NOTHING
                 RETURNING id`,
                [id, memberId, me]
            );
            if ((inserted as any[]).length > 0) addedIds.push(memberId);
        }

        const inputs: CreateNotificationInput[] = addedIds
            .filter((m) => m !== me)
            .map((m) => ({
                recipientUserId: m,
                type: 'channel_added' as const,
                sourceType: 'channel' as const,
                sourceId: id,
                channelId: id,
                actorUserId: me,
                preview: `You were added to #${channel.name}`,
            }));
        await createNotifications(inputs);

        await logAuditEvent(me, 'create', 'channel_members', id, { added: addedIds.length });
        return NextResponse.json({ success: true, added: addedIds.length });
    } catch (err) {
        console.error('Members add error:', err);
        return NextResponse.json({ error: 'Failed to add members' }, { status: 500 });
    }
}

// ============================================================================
// DELETE — remove a member
// ============================================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    const { id } = await params;

    const targetId = request.nextUrl.searchParams.get('user_id');
    if (!targetId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    const { channel, canAccess } = await getChannelForUser(id, me);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!channel.is_private) {
        return NextResponse.json({ error: 'This is a public channel — there is no member list' }, { status: 400 });
    }
    if (channel.created_by !== me && !(await isAdmin(me))) {
        return NextResponse.json({ error: 'Only the channel creator can remove members' }, { status: 403 });
    }
    if (targetId === channel.created_by) {
        return NextResponse.json({ error: 'The channel creator cannot be removed — delete the channel instead' }, { status: 400 });
    }

    try {
        const removed = await queryOne<{ id: string }>(
            `DELETE FROM channel_members
             WHERE channel_id = $1::uuid AND user_id = $2::uuid
             RETURNING id`,
            [id, targetId]
        );
        if (!removed) return NextResponse.json({ error: 'That person is not a member of this channel' }, { status: 404 });

        await logAuditEvent(me, 'delete', 'channel_members', removed.id);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Members remove error:', err);
        return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }
}
