/**
 * lib/notifications.ts
 *
 * Creation of in-app notifications for the header bell (ported from DDOR,
 * trimmed to bell-only — no email doorbell yet). Rows land in the
 * `notifications` table and surface via GET /api/notifications.
 *
 * createNotifications() never throws — a failed notification must not break
 * the message-send request.
 */

import { query } from './db';

export type NotificationType = 'mention' | 'dm' | 'channel_added';
export type NotificationSource = 'message' | 'channel';

export interface CreateNotificationInput {
    recipientUserId: string;
    type: NotificationType;
    sourceType: NotificationSource;
    sourceId: string;
    channelId?: string | null;
    resourceId?: string | null;
    actorUserId: string;
    preview?: string | null;
}

/**
 * Insert notification rows. Drops self-notifications (recipient === actor) and
 * de-dupes on recipient:sourceType:sourceId within the batch.
 */
export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
    if (!inputs.length) return;

    const seen = new Set<string>();
    const rows = inputs.filter((n) => {
        if (!n.recipientUserId || n.recipientUserId === n.actorUserId) return false;
        const key = `${n.recipientUserId}:${n.sourceType}:${n.sourceId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    if (!rows.length) return;

    try {
        for (const n of rows) {
            await query(
                `INSERT INTO notifications
                   (recipient_user_id, type, source_type, source_id, channel_id, resource_id, actor_user_id, preview)
                 VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7::uuid, $8)`,
                [
                    n.recipientUserId,
                    n.type,
                    n.sourceType,
                    n.sourceId,
                    n.channelId ?? null,
                    n.resourceId ?? null,
                    n.actorUserId,
                    n.preview ?? null,
                ]
            );
        }
    } catch (err) {
        // Never break the originating request because of a notification failure.
        console.error('createNotifications failed:', err);
    }
}
