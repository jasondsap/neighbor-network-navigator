/**
 * lib/notifications.ts
 *
 * Creation of in-app notifications for the header bell, plus a throttled email
 * "doorbell" via Resend (ported from DDOR). Rows land in the `notifications`
 * table and surface via GET /api/notifications.
 *
 * createNotifications() never throws — a failed notification (row insert or
 * email) must not break the message-send request.
 */

import { query, queryOne } from './db';
import { sendEmail } from './email/resend';

export type NotificationType = 'mention' | 'dm' | 'channel_added' | 'reaction';
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

// Don't re-email a recipient for the same channel within this window — the bell
// still catches every event, but a rapid back-and-forth won't flood their inbox.
const EMAIL_THROTTLE_MINUTES = 10;

const BRAND = 'Louisville Neighbor Network';

function appBaseUrl(): string {
    return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Deep link back into the app for a notification (the Messages view). */
function notificationLink(base: string, channelId?: string | null): string {
    return channelId ? `${base}/messages?channel=${channelId}` : `${base}/messages`;
}

/**
 * Insert notification rows, then fire a throttled email doorbell for each.
 * Drops self-notifications (recipient === actor) and de-dupes on
 * recipient:sourceType:sourceId within the batch.
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

    const inserted: { id: string; input: CreateNotificationInput }[] = [];
    try {
        for (const n of rows) {
            const r = await queryOne<{ id: string }>(
                `INSERT INTO notifications
                   (recipient_user_id, type, source_type, source_id, channel_id, resource_id, actor_user_id, preview)
                 VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, $7::uuid, $8)
                 RETURNING id`,
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
            if (r) inserted.push({ id: r.id, input: n });
        }
    } catch (err) {
        // Never break the originating request because of a notification failure.
        console.error('createNotifications insert failed:', err);
    }

    // Email is best-effort and independent of the bell rows above.
    await Promise.all(
        inserted.map(({ id, input }) =>
            emailDoorbell(id, input).catch((err) => console.error('emailDoorbell failed:', err))
        )
    );
}

/**
 * Send a single notification email, throttled per recipient + channel. Skips
 * reactions (an email per 👍 would be pure noise) and no-ops silently when
 * Resend isn't configured. Stamps notifications.emailed_at on success.
 */
async function emailDoorbell(notifId: string, input: CreateNotificationInput): Promise<void> {
    if (input.type === 'reaction') return;
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

    // Throttle per recipient + channel. IS NOT DISTINCT FROM treats NULLs as
    // equal so channel-less rows still group together.
    const recent = await queryOne<{ id: string }>(
        `SELECT id FROM notifications
         WHERE recipient_user_id = $1::uuid
           AND id <> $2::uuid
           AND emailed_at IS NOT NULL
           AND emailed_at > now() - ($3 || ' minutes')::interval
           AND channel_id IS NOT DISTINCT FROM $4
         LIMIT 1`,
        [input.recipientUserId, notifId, String(EMAIL_THROTTLE_MINUTES), input.channelId ?? null]
    );
    if (recent) return;

    const recipient = await queryOne<{ email: string | null }>(
        `SELECT email FROM users WHERE id = $1::uuid`,
        [input.recipientUserId]
    );
    if (!recipient?.email) return;

    const actor = await queryOne<{ name: string | null }>(
        `SELECT COALESCE(NULLIF(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), email) AS name
         FROM users WHERE id = $1::uuid`,
        [input.actorUserId]
    );
    const actorName = actor?.name || 'A teammate';

    let channelName: string | null = null;
    if (input.channelId) {
        const ch = await queryOne<{ name: string | null; channel_type: string }>(
            `SELECT name, channel_type FROM channels WHERE id = $1::uuid`,
            [input.channelId]
        );
        channelName = ch && ch.channel_type !== 'dm' ? ch.name : null;
    }
    const channelLabel = channelName ? `the "${channelName}" channel` : 'a private channel';

    const subject =
        input.type === 'dm'
            ? `New message from ${actorName} — ${BRAND}`
            : input.type === 'channel_added'
              ? `${actorName} added you to ${channelLabel} — ${BRAND}`
              : `${actorName} mentioned you — ${BRAND}`;
    const intro =
        input.type === 'dm'
            ? `${actorName} sent you a direct message in ${BRAND} Messages.`
            : input.type === 'channel_added'
              ? `${actorName} added you to ${channelLabel} in ${BRAND} Messages.`
              : `${actorName} mentioned you${channelName ? ` in ${channelName}` : ''} in ${BRAND} Messages.`;
    const reason =
        input.type === 'dm'
            ? 'sent a direct message'
            : input.type === 'channel_added'
              ? 'added to a channel'
              : 'mentioned';

    const link = notificationLink(appBaseUrl(), input.channelId);
    const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
            <p style="font-size:15px;margin:0 0 12px">${escapeHtml(intro)}</p>
            ${input.preview ? `<blockquote style="margin:0 0 16px;padding:10px 14px;background:#f3f4f6;border-left:3px solid #2E4A8E;border-radius:6px;font-size:14px;color:#374151">${escapeHtml(input.preview)}</blockquote>` : ''}
            <p style="margin:0 0 20px">
                <a href="${link}" style="display:inline-block;background:#2E4A8E;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">Open Messages</a>
            </p>
            <p style="font-size:12px;color:#9ca3af;margin:0">You're receiving this because you were ${reason} in ${BRAND}. Reply inside the app to keep the conversation in one place.</p>
        </div>`;
    const text = `${intro}\n\n${input.preview ? `"${input.preview}"\n\n` : ''}Open Messages: ${link}\n\nYou're receiving this because you were ${reason} in ${BRAND}.`;

    await sendEmail({ to: recipient.email, subject, html, text });
    await query(`UPDATE notifications SET emailed_at = now() WHERE id = $1::uuid`, [notifId]);
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
    );
}
