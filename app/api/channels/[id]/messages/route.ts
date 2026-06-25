/**
 * app/api/channels/[id]/messages/route.ts
 *
 * GET    — messages in a channel (oldest-first), each with grouped reactions.
 *          Side effect: marks the channel read for the caller (upserts
 *          message_read_status).
 * POST    — { body, mentions } — post a message; notifies @user mentions and,
 *          in a DM, the partner.
 * PUT    — ?messageId=… { body, mentions } — edit a message (sender only).
 * DELETE — ?messageId=… — soft-delete (sender or admin).
 *
 * Access enforced by getChannelForUser (404 unknown, 403 not allowed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { getChannelForUser } from '@/lib/messaging';
import { createNotifications, type CreateNotificationInput } from '@/lib/notifications';
import { parseMentions, toPreview, type Mention } from '@/lib/mentions';
import { groupReactions, type ReactionRow } from '@/lib/reactions';

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
// GET — list messages + mark read
// ============================================================================
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const { id } = await params;

    const { channel, canAccess } = await getChannelForUser(id, auth.userId);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const messages = await query<any>(
            `SELECT m.id, m.channel_id, m.sender_id, m.body, m.mentions, m.is_edited, m.created_at,
                    COALESCE(NULLIF(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email) AS sender_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.channel_id = $1 AND m.is_deleted = false
             ORDER BY m.created_at ASC`,
            [id]
        );

        await query(
            `INSERT INTO message_read_status (user_id, channel_id, last_read_at)
             VALUES ($1::uuid, $2::uuid, NOW())
             ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = NOW()`,
            [auth.userId, id]
        );

        // Attach reactions, grouped per message + emoji, popularity first.
        const ids = messages.map((m) => m.id);
        const reactionRows = ids.length
            ? await query<ReactionRow>(
                  `SELECT mr.message_id, mr.emoji, mr.user_id,
                          COALESCE(NULLIF(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email) AS user_name
                   FROM message_reactions mr
                   JOIN users u ON u.id = mr.user_id
                   WHERE mr.message_id = ANY($1::uuid[])
                   ORDER BY mr.created_at`,
                  [ids]
              )
            : [];
        const byMessage = groupReactions(reactionRows as ReactionRow[], auth.userId);

        return NextResponse.json({
            channel,
            messages: messages.map((m) => ({ ...m, reactions: byMessage[m.id] || [] })),
        });
    } catch (err) {
        console.error('Messages list error:', err);
        return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }
}

// ============================================================================
// POST — send a message
// ============================================================================
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    const { id } = await params;

    const { channel, canAccess } = await getChannelForUser(id, me);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const text = String(body.body || '').trim();
    if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });

    // Trust server-side parse for what we notify on; accept client mentions too.
    const mentions: Mention[] =
        Array.isArray(body.mentions) && body.mentions.length ? body.mentions : parseMentions(text);

    try {
        const message = await queryOne<any>(
            `INSERT INTO messages (channel_id, sender_id, body, mentions)
             VALUES ($1::uuid, $2::uuid, $3, $4::jsonb)
             RETURNING id, channel_id, sender_id, body, mentions, is_edited, created_at`,
            [id, me, text, JSON.stringify(mentions)]
        );
        await query(`UPDATE channels SET last_message_at = NOW() WHERE id = $1`, [id]);

        // Notifications: one per @user mention, plus the DM partner.
        const preview = toPreview(text);
        const resourceId = mentions.find((m) => m.type === 'resource' && m.id)?.id ?? null;
        const userMentionIds = Array.from(
            new Set(mentions.filter((m) => m.type === 'user' && m.id).map((m) => String(m.id)))
        );

        const inputs: CreateNotificationInput[] = userMentionIds.map((rid) => ({
            recipientUserId: rid,
            type: 'mention',
            sourceType: 'message',
            sourceId: message.id,
            channelId: id,
            resourceId,
            actorUserId: me,
            preview,
        }));

        if (channel.channel_type === 'dm') {
            const partner = channel.dm_user_1 === me ? channel.dm_user_2 : channel.dm_user_1;
            if (partner && !userMentionIds.includes(partner)) {
                inputs.push({
                    recipientUserId: partner,
                    type: 'dm',
                    sourceType: 'message',
                    sourceId: message.id,
                    channelId: id,
                    resourceId,
                    actorUserId: me,
                    preview,
                });
            }
        }
        await createNotifications(inputs);

        // attach sender_name for immediate render
        const sender = await queryOne<any>(
            `SELECT COALESCE(NULLIF(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), email) AS sender_name
             FROM users WHERE id = $1`,
            [me]
        );
        return NextResponse.json({ success: true, message: { ...message, sender_name: sender?.sender_name } }, { status: 201 });
    } catch (err) {
        console.error('Message send error:', err);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

// ============================================================================
// PUT — edit a message (sender only)
// ============================================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    const { id } = await params;

    const messageId = request.nextUrl.searchParams.get('messageId');
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });

    const { channel, canAccess } = await getChannelForUser(id, me);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const text = String(body.body || '').trim();
    if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });

    try {
        const existing = await queryOne<{ sender_id: string }>(
            `SELECT sender_id FROM messages
             WHERE id = $1::uuid AND channel_id = $2::uuid AND is_deleted = false`,
            [messageId, id]
        );
        if (!existing) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        if (existing.sender_id !== me) {
            return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });
        }

        // Re-parse mentions from the edited body so the stored tokens stay in
        // sync (editing does not re-notify — that would surprise recipients).
        const mentions: Mention[] =
            Array.isArray(body.mentions) && body.mentions.length ? body.mentions : parseMentions(text);

        const message = await queryOne<any>(
            `UPDATE messages
                SET body = $1, mentions = $2::jsonb, is_edited = true, updated_at = NOW()
              WHERE id = $3::uuid
              RETURNING id, channel_id, sender_id, body, mentions, is_edited, created_at`,
            [text, JSON.stringify(mentions), messageId]
        );

        const sender = await queryOne<any>(
            `SELECT COALESCE(NULLIF(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), email) AS sender_name
             FROM users WHERE id = $1`,
            [me]
        );
        return NextResponse.json({ success: true, message: { ...message, sender_name: sender?.sender_name } });
    } catch (err) {
        console.error('Message edit error:', err);
        return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 });
    }
}

// ============================================================================
// DELETE — soft-delete a message
// ============================================================================
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    await params; // channel id not needed beyond auth; messageId identifies the row

    const messageId = request.nextUrl.searchParams.get('messageId');
    if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });

    try {
        const msg = await queryOne<{ sender_id: string }>(
            `SELECT sender_id FROM messages WHERE id = $1 AND is_deleted = false`,
            [messageId]
        );
        if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        if (msg.sender_id !== me && !(await isAdmin(me))) {
            return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });
        }
        await query(`UPDATE messages SET is_deleted = true, updated_at = NOW() WHERE id = $1`, [messageId]);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Message delete error:', err);
        return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }
}
