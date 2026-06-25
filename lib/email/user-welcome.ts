/**
 * lib/email/user-welcome.ts
 *
 * Builds + sends the "your account is ready" email for newly-created app users
 * (admin → Users panel). Includes their username (email) and the temporary
 * password; they're forced to set their own on first sign-in.
 *
 * sendWelcomeEmail NEVER throws — user creation must not fail just because the
 * email couldn't go out. Returns { sent, error } for the caller to surface.
 */

import { sendEmail } from './resend';

// Brand colors (see CLAUDE.md): Blue #2E4A8E, Gold #E8B84A.
const BRAND_BLUE = '#2E4A8E';

function signInUrl(): string {
    const base = (process.env.NEXTAUTH_URL || process.env.APP_URL || '').replace(/\/$/, '');
    return base ? `${base}/auth/signin` : '/auth/signin';
}

export function buildWelcomeEmail(opts: {
    firstName?: string | null;
    email: string;
    tempPassword?: string | null;
}): { subject: string; html: string; text: string } {
    const { firstName, email, tempPassword } = opts;
    const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
    const url = signInUrl();
    const urlLabel = url.replace(/^https?:\/\//, '');

    const credsHtml = tempPassword
        ? `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f3f6fc;border:1px solid #d6def0;border-radius:8px;">
          <tr><td style="padding:12px 16px;color:#1f2937;"><strong>Username:</strong> ${email}</td></tr>
          <tr><td style="padding:12px 16px;border-top:1px solid #e4eaf6;color:#1f2937;"><strong>Temporary password:</strong> ${tempPassword}</td></tr>
        </table>
        <p style="color:#444;font-size:14px;">For your security, you'll be asked to create your own password the first time you sign in.</p>`
        : `
        <p style="color:#444;font-size:14px;"><strong>Username:</strong> ${email}</p>
        <p style="color:#444;font-size:14px;">An account already existed for this email, so it has been linked — sign in with your existing password. If you've forgotten it, ask an administrator to reset it.</p>`;

    const credsText = tempPassword
        ? `Username: ${email}\nTemporary password: ${tempPassword}\n\nFor your security, you'll be asked to create your own password the first time you sign in.`
        : `Username: ${email}\n\nAn account already existed for this email, so it has been linked — sign in with your existing password. If you've forgotten it, ask an administrator to reset it.`;

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:${BRAND_BLUE};color:#fff;padding:28px 24px;border-radius:10px 10px 0 0;text-align:center;border-bottom:4px solid #E8B84A;">
        <h1 style="margin:0;font-size:20px;">Your Neighbor Network account is ready</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e6ebf1;border-top:none;border-radius:0 0 10px 10px;">
        <p style="color:#222;">${greeting}</p>
        <p style="color:#444;">An administrator has created an account for you on the Louisville Neighbor Network resource navigation tool. Use the credentials below to sign in.</p>
        ${credsHtml}
        <p style="text-align:center;margin:24px 0;">
          <a href="${url}" style="display:inline-block;background:${BRAND_BLUE};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in</a>
        </p>
        <p style="color:#666;font-size:13px;">Or visit <a href="${url}" style="color:${BRAND_BLUE};">${urlLabel}</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px;">This is an automated message — please don't reply to this email. If you weren't expecting this account, you can ignore it.</p>
      </div>
    </div>
  </body>
</html>`;

    const text = `${greeting}

An administrator has created an account for you on the Louisville Neighbor Network resource navigation tool.

${credsText}

Sign in here: ${url}

This is an automated message — please don't reply.`;

    return { subject: 'Your Neighbor Network account is ready', html, text };
}

export async function sendWelcomeEmail(opts: {
    firstName?: string | null;
    email: string;
    tempPassword?: string | null;
}): Promise<{ sent: boolean; error: string | null }> {
    try {
        const { subject, html, text } = buildWelcomeEmail(opts);
        await sendEmail({ to: opts.email, subject, html, text });
        return { sent: true, error: null };
    } catch (err: any) {
        console.error('Welcome email send failed:', err);
        return { sent: false, error: err?.message || 'Failed to send email' };
    }
}
