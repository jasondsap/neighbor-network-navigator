/**
 * app/api/admin/users/route.ts
 *
 * GET  — list all users (id, name, email, role, login linkage, last login).
 * POST — create a user. Because users.cognito_sub is NOT NULL, we provision the
 *        Cognito login FIRST, then insert the row with the returned sub. If the
 *        Cognito provision fails (or yields no sub), nothing is written to the DB.
 *        Temp password Slcm!1234, no invitation email (see lib/cognito.ts).
 *
 * Both gated by requireAdmin().
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, insert, logAuditEvent } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import { validateNewUser } from '@/lib/users-admin';
import { provisionCognitoLogin, DEFAULT_TEMP_PASSWORD } from '@/lib/cognito';
import { sendWelcomeEmail } from '@/lib/email/user-welcome';

async function requireAdminResponse(): Promise<
    { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
    try {
        const { userId } = await requireAdmin();
        return { ok: true, userId };
    } catch (err) {
        if (err instanceof NotAdminError) {
            return { ok: false, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
        }
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

// ============================================================================
// GET — list users
// ============================================================================
export async function GET() {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    try {
        const users = await sql`
            SELECT
                id,
                email,
                first_name,
                last_name,
                display_name,
                role,
                (cognito_sub IS NOT NULL) AS has_login,
                last_login_at,
                created_at
            FROM users
            ORDER BY (role = 'admin') DESC, last_name NULLS LAST, first_name NULLS LAST, email
        `;
        return NextResponse.json({ users });
    } catch (err) {
        console.error('Admin users list error:', err);
        return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
    }
}

// ============================================================================
// POST — create user (Cognito first, then DB row)
// ============================================================================
export async function POST(request: NextRequest) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { data, errors } = validateNewUser(body);
    if (!data) {
        return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    try {
        // Reject duplicates up front (email is UNIQUE in the DB anyway).
        const existing = (await sql`SELECT id FROM users WHERE email = ${data.email}`) as any[];
        if (existing.length > 0) {
            return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
        }

        // 1) Provision the Cognito login first — cognito_sub is NOT NULL, so we
        //    need the sub before we can insert. already_exists is fine as long as
        //    we can read back the sub to link to.
        const cognito = await provisionCognitoLogin(data.email);
        if (!cognito.ok) {
            return NextResponse.json(
                { error: `Could not create the login in Cognito: ${cognito.reason}` },
                { status: 502 }
            );
        }
        if (!cognito.sub) {
            return NextResponse.json(
                {
                    error: 'A Cognito login already exists for this email but its ID could not be read, ' +
                        'so the account was not linked. Resolve it in the Cognito console, then retry.',
                },
                { status: 409 }
            );
        }

        // 2) Insert the DB row with the Cognito sub.
        const user = await insert<any>('users', {
            cognito_sub: cognito.sub,
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            role: data.role,
        });

        // 3) Email the new user their login details. Non-blocking: a failed
        //    email must not undo a successfully-created account. The temp
        //    password is only valid/relevant when we just created the login;
        //    an already-existing login keeps its own password.
        const welcome = await sendWelcomeEmail({
            firstName: data.first_name,
            email: data.email,
            tempPassword: cognito.status === 'created' ? DEFAULT_TEMP_PASSWORD : null,
        });

        await logAuditEvent(auth.userId, 'create', 'users', user.id, {
            role: data.role,
            cognito_status: cognito.status,
            welcome_email_sent: welcome.sent,
        });

        return NextResponse.json({
            success: true,
            user,
            cognito,
            email_sent: welcome.sent,
            email_error: welcome.error,
        });
    } catch (err) {
        console.error('Admin user create error:', err);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
