/**
 * app/api/admin/users/[id]/route.ts
 *
 * PATCH  — update a user's name / role.
 * DELETE — remove a user: hard-delete the DB row, then disable (not delete) the
 *          Cognito login so they can't sign in. Cognito disable is best-effort.
 *
 * Self-protection: an admin can neither demote nor delete their own account
 * (prevents locking yourself out of the console).
 *
 * Both gated by requireAdmin().
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, logAuditEvent } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import { isValidRole } from '@/lib/users-admin';
import { disableCognitoLogin } from '@/lib/cognito';

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
// PATCH — update name / role
// ============================================================================
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate role if supplied, and block self-demotion.
    let role: string | undefined;
    if (body.role !== undefined) {
        if (!isValidRole(body.role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        if (id === auth.userId && body.role !== 'admin') {
            return NextResponse.json(
                { error: 'You cannot remove your own admin access.' },
                { status: 400 }
            );
        }
        role = body.role;
    }

    const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : undefined;
    const last_name  = typeof body.last_name === 'string'  ? body.last_name.trim()  : undefined;

    if (first_name === undefined && last_name === undefined && role === undefined) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }
    if (first_name === '') return NextResponse.json({ error: 'First name cannot be empty' }, { status: 400 });
    if (last_name === '')  return NextResponse.json({ error: 'Last name cannot be empty' }, { status: 400 });

    try {
        const rows = (await sql`
            UPDATE users SET
                first_name = COALESCE(${first_name ?? null}, first_name),
                last_name  = COALESCE(${last_name ?? null},  last_name),
                role       = COALESCE(${role ?? null},       role),
                updated_at = NOW()
            WHERE id = ${id}
            RETURNING id, email, first_name, last_name, display_name, role,
                      (cognito_sub IS NOT NULL) AS has_login, last_login_at, created_at
        `) as any[];

        if (rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await logAuditEvent(auth.userId, 'update', 'users', id, {
            first_name, last_name, role,
        });

        return NextResponse.json({ success: true, user: rows[0] });
    } catch (err) {
        console.error('Admin user update error:', err);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

// ============================================================================
// DELETE — remove DB row + disable Cognito login
// ============================================================================
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    if (id === auth.userId) {
        return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
    }

    try {
        const found = (await sql`SELECT email FROM users WHERE id = ${id}`) as any[];
        if (found.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const email: string = found[0].email;

        await sql`DELETE FROM users WHERE id = ${id}`;

        // Best-effort: disable the login so they can't authenticate. The DB row is
        // already gone — never fail the request on a Cognito hiccup.
        const cognito = await disableCognitoLogin(email);

        await logAuditEvent(auth.userId, 'delete', 'users', id, {
            email,
            cognito_disabled: cognito.ok,
        });

        return NextResponse.json({ success: true, cognito });
    } catch (err) {
        console.error('Admin user delete error:', err);
        return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
    }
}
