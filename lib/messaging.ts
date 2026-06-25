/**
 * lib/messaging.ts
 *
 * Channel access + visibility helpers (ported from DDOR's lib/channels.ts).
 *
 * Visibility rules:
 *   - DM channels      → only the two participants (dm_user_1 / dm_user_2)
 *   - public channel   → any authenticated user (is_private = false)
 *   - private channel  → the creator, or a row in channel_members
 */

import { queryOne } from './db';

export interface ChannelRow {
    id: string;
    name: string;
    channel_type: string;
    description: string | null;
    is_private: boolean;
    is_archived: boolean;
    created_by: string | null;
    dm_user_1: string | null;
    dm_user_2: string | null;
    last_message_at: string | null;
    created_at: string;
}

/**
 * Reusable WHERE fragment for "channels this user may see", covering both the
 * private-membership rule and the DM-participant rule. `userParam` is the bound
 * placeholder (e.g. '$1'); `alias` is the channels table alias in the query.
 */
export function channelVisibilitySql(userParam: string, alias = 'ch'): string {
    return `(
        (${alias}.channel_type <> 'dm' AND (
            ${alias}.is_private = false
            OR ${alias}.created_by = ${userParam}::uuid
            OR EXISTS (SELECT 1 FROM channel_members cm
                       WHERE cm.channel_id = ${alias}.id AND cm.user_id = ${userParam}::uuid)
        ))
        OR (${alias}.channel_type = 'dm' AND (${alias}.dm_user_1 = ${userParam}::uuid OR ${alias}.dm_user_2 = ${userParam}::uuid))
    )`;
}

/**
 * Fetch a channel and whether `userId` may access it. Returns channel=null when
 * the channel doesn't exist (caller → 404) and canAccess=false when it exists
 * but the user isn't allowed (caller → 403).
 */
export async function getChannelForUser(
    channelId: string,
    userId: string
): Promise<{ channel: ChannelRow | null; canAccess: boolean }> {
    const channel = await queryOne<ChannelRow>(
        `SELECT * FROM channels WHERE id = $1 AND is_archived = false`,
        [channelId]
    );
    if (!channel) return { channel: null, canAccess: false };

    let canAccess = false;
    if (channel.channel_type === 'dm') {
        canAccess = channel.dm_user_1 === userId || channel.dm_user_2 === userId;
    } else if (!channel.is_private) {
        canAccess = true;
    } else if (channel.created_by === userId) {
        canAccess = true;
    } else {
        const member = await queryOne<{ id: string }>(
            `SELECT id FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
            [channelId, userId]
        );
        canAccess = !!member;
    }
    return { channel, canAccess };
}
