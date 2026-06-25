/**
 * app/api/channels/[id]/reactions/route.ts
 *
 * POST — toggle an emoji reaction on a message. Body: { message_id, emoji }.
 *        Adds the reaction when absent, removes it when present (click the same
 *        emoji again to take it back). Returns the message's updated reaction
 *        groups so the UI swaps them in place.
 *
 * First reaction from a user on someone else's message drops a bell-only
 * 'reaction' notification to the sender (no email; multiple emojis = one bell).
 *
 * Access enforced by getChannelForUser (404 unknown, 403 not allowed).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { getChannelForUser } from '@/lib/messaging';
import { groupReactions, type ReactionRow } from '@/lib/reactions';
import { ALL_EMOJIS } from '@/lib/emoji';
import { createNotifications } from '@/lib/notifications';

async function uid(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
    try {
        const { internalUserId } = await getSessionWithUserId();
        return { ok: true, userId: internalUserId };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

const REACTION_SELECT = `
    SELECT mr.message_id, mr.emoji, mr.user_id,
        COALESCE(NULLIF(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email) AS user_name
    FROM message_reactions mr
    JOIN users u ON u.id = mr.user_id
    WHERE mr.message_id = $1::uuid
    ORDER BY mr.created_at`;

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
    const messageId = typeof body.message_id === 'string' ? body.message_id : null;
    const emoji = typeof body.emoji === 'string' ? body.emoji : null;
    if (!messageId || !emoji) {
        return NextResponse.json({ error: 'message_id and emoji are required' }, { status: 400 });
    }
    if (!ALL_EMOJIS.has(emoji)) {
        return NextResponse.json({ error: 'Unsupported emoji' }, { status: 400 });
    }

    const { channel, canAccess } = await getChannelForUser(id, me);
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const msg = await queryOne<{ id: string; sender_id: string }>(
            `SELECT id, sender_id FROM messages
             WHERE id = $1::uuid AND channel_id = $2::uuid AND is_deleted = false`,
            [messageId, id]
        );
        if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

        // Toggle: remove if present, otherwise add.
        const removed = await queryOne<{ id: string }>(
            `DELETE FROM message_reactions
             WHERE message_id = $1::uuid AND user_id = $2::uuid AND emoji = $3
             RETURNING id`,
            [messageId, me, emoji]
        );
        let added = false;
        if (!removed) {
            await query(
                `INSERT INTO message_reactions (message_id, user_id, emoji)
                 VALUES ($1::uuid, $2::uuid, $3)
                 ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
                [messageId, me, emoji]
            );
            added = true;
        }

        // Bell-only notification to the sender on this user's first reaction to
        // the message (multiple emojis from one person = one bell, no email).
        if (added && msg.sender_id !== me) {
            try {
                const already = await queryOne<{ id: string }>(
                    `SELECT id FROM notifications
                     WHERE type = 'reaction' AND source_id = $1::uuid
                       AND recipient_user_id = $2::uuid AND actor_user_id = $3::uuid
                     LIMIT 1`,
                    [messageId, msg.sender_id, me]
                );
                if (!already) {
                    await createNotifications([
                        {
                            recipientUserId: msg.sender_id,
                            type: 'reaction',
                            sourceType: 'message',
                            sourceId: messageId,
                            channelId: id,
                            actorUserId: me,
                            preview: emoji,
                        },
                    ]);
                }
            } catch (e) {
                console.error('[reactions] notification error', e);
            }
        }

        const rows = await query<ReactionRow>(REACTION_SELECT, [messageId]);
        const grouped = groupReactions(rows as ReactionRow[], me);
        return NextResponse.json({ success: true, reactions: grouped[messageId] || [] });
    } catch (err) {
        console.error('Reaction error:', err);
        return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
    }
}
