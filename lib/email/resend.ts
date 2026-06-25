/**
 * lib/email/resend.ts
 *
 * Thin Resend wrapper for transactional email.
 *
 * Env (set in Vercel + locally):
 *   RESEND_API_KEY     — Resend API key
 *   RESEND_FROM_EMAIL  — verified sender, e.g. "Louisville Neighbor Network <no-reply@yourdomain.org>"
 *                        (the domain must have SPF/DKIM verified in Resend)
 *
 * sendEmail throws on failure — callers that must not break their request
 * (e.g. user creation) should wrap it and swallow errors.
 */

import { Resend } from 'resend';

let _client: Resend | null = null;

function getClient(): Resend {
    if (_client) return _client;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY must be set');
    _client = new Resend(apiKey);
    return _client;
}

export interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text: string;
}

export interface SendEmailResult {
    id: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const from = process.env.RESEND_FROM_EMAIL;
    if (!from) throw new Error('RESEND_FROM_EMAIL must be set');

    const client = getClient();
    const result = await client.emails.send({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
    });

    if (result.error) {
        throw new Error(`Resend send failed: ${result.error.message}`);
    }
    if (!result.data?.id) {
        throw new Error('Resend returned no message id');
    }
    return { id: result.data.id };
}
