/**
 * app/api/notifications/route.ts
 *
 * GET   — header bell payload: { inbox, inboxUnread, totalUnread }
 *         inbox       = last 20 notification rows for the caller (with actor + channel)
 *         inboxUnread = count of unread notifications (drives the bell badge)
 *         totalUnread = unread message count across visible channels (Messages badge)
 * PATCH — mark read: { all: true } or { id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { channelVisibilitySql } from '@/lib/messaging';

async function uid(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
    try {
        const { internalUserId } = await getSessionWithUserId();
        return { ok: true, userId: internalUserId };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

export async function GET() {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;

    try {
        const inbox = await query<any>(
            `SELECT n.id, n.type, n.source_type, n.source_id, n.channel_id, n.resource_id,
                    n.preview, n.created_at, n.read_at,
                    COALESCE(NULLIF(trim(coalesce(a.first_name,'') || ' ' || coalesce(a.last_name,'')), ''), a.email) AS actor_name,
                    c.name AS channel_name, c.channel_type
             FROM notifications n
             LEFT JOIN users a ON a.id = n.actor_user_id
             LEFT JOIN channels c ON c.id = n.channel_id
             WHERE n.recipient_user_id = $1::uuid
             ORDER BY n.created_at DESC
             LIMIT 20`,
            [me]
        );

        const unreadRow = await queryOne<{ c: string }>(
            `SELECT count(*)::text AS c FROM notifications WHERE recipient_user_id = $1::uuid AND read_at IS NULL`,
            [me]
        );

        const totalRow = await queryOne<{ total: string }>(
            `SELECT COALESCE(SUM(
                (SELECT count(*) FROM messages m
                   WHERE m.channel_id = ch.id AND m.is_deleted = false
                     AND m.created_at > COALESCE(
                       (SELECT last_read_at FROM message_read_status WHERE user_id = $1::uuid AND channel_id = ch.id),
                       '1970-01-01'::timestamptz)
                     AND m.sender_id <> $1::uuid)
             ), 0)::text AS total
             FROM channels ch
             WHERE ch.is_archived = false AND ${channelVisibilitySql('$1')}`,
            [me]
        );

        return NextResponse.json({
            inbox,
            inboxUnread: Number(unreadRow?.c || 0),
            totalUnread: Number(totalRow?.total || 0),
        });
    } catch (err) {
        console.error('Notifications GET error:', err);
        return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
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
        if (body.all) {
            await query(
                `UPDATE notifications SET read_at = NOW() WHERE recipient_user_id = $1::uuid AND read_at IS NULL`,
                [me]
            );
        } else if (body.id) {
            await query(
                `UPDATE notifications SET read_at = NOW()
                 WHERE id = $1::uuid AND recipient_user_id = $2::uuid AND read_at IS NULL`,
                [String(body.id), me]
            );
        } else {
            return NextResponse.json({ error: 'Provide { all: true } or { id }' }, { status: 400 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Notifications PATCH error:', err);
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
    }
}
