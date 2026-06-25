/**
 * app/api/messages/search/route.ts
 *
 * GET ?q=…&limit=… — full-content search across messages the caller can see.
 * Visibility mirrors the channels list (channelVisibilitySql): non-DM channels
 * follow public/private membership rules, DMs only their two participants.
 * Returns enough channel/partner context for the UI to jump to the conversation.
 * Requires a query of at least 2 characters.
 *
 * Gated by requireAuth (any signed-in user).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

export async function GET(request: NextRequest) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;

    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '25', 10) || 25, 50);
    if (q.length < 2) return NextResponse.json({ results: [] });

    try {
        const results = await query<any>(
            `SELECT m.id, m.channel_id, m.body, m.created_at,
                    COALESCE(NULLIF(trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), ''), u.email) AS sender_name,
                    ch.channel_type, ch.name AS channel_name,
                    CASE WHEN ch.channel_type = 'dm' THEN (
                        SELECT COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.email)
                        FROM users p
                        WHERE p.id = CASE WHEN ch.dm_user_1 = $1::uuid THEN ch.dm_user_2 ELSE ch.dm_user_1 END
                    ) ELSE NULL END AS dm_partner_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             JOIN channels ch ON ch.id = m.channel_id
             WHERE m.is_deleted = false
               AND ch.is_archived = false
               AND m.body ILIKE $2
               AND ${channelVisibilitySql('$1', 'ch')}
             ORDER BY m.created_at DESC
             LIMIT $3`,
            [me, `%${q}%`, limit]
        );
        return NextResponse.json({ results });
    } catch (err) {
        console.error('Message search error:', err);
        return NextResponse.json({ error: 'Failed to search messages' }, { status: 500 });
    }
}
