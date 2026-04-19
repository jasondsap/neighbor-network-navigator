/**
 * lib/admin.ts
 *
 * Admin-only auth helpers that build on lib/auth.ts.
 *
 * Pattern:
 *   const { userId } = await requireAdmin();   // throws if not admin
 *   // ...admin-only DB work
 */

import { sql } from './db';
import { requireAuth, getInternalUserId, type AppSession } from './auth';

export class NotAdminError extends Error {
    constructor(message = 'Admin access required') {
        super(message);
        this.name = 'NotAdminError';
    }
}

/**
 * Require that the current session belongs to an admin user.
 *
 * Throws:
 *   'Unauthorized'     — no session (delegate to requireAuth)
 *   NotAdminError      — signed in but role !== 'admin'
 *   'User not found'   — session exists but no matching row in users table
 *
 * Returns the session, the internal users.id UUID, and the role.
 */
export async function requireAdmin(): Promise<{
    session: AppSession;
    userId: string;
    role: string;
}> {
    const session = await requireAuth();   // throws 'Unauthorized' if missing
    const userId = await getInternalUserId(session.user.id, session.user.email);

    if (!userId) {
        throw new Error('User not found');
    }

    const rows = await sql`SELECT role FROM users WHERE id = ${userId}`;
    const role = (rows as any[])[0]?.role;

    if (role !== 'admin') {
        throw new NotAdminError();
    }

    return { session, userId, role };
}

/**
 * Non-throwing variant — returns null instead of throwing.
 * Useful in places like layouts where you want to conditionally render.
 */
export async function tryRequireAdmin(): Promise<{
    userId: string;
    role: string;
} | null> {
    try {
        const result = await requireAdmin();
        return { userId: result.userId, role: result.role };
    } catch {
        return null;
    }
}

/**
 * Lightweight "is this user an admin?" check for UI decisions in the
 * main app (e.g. showing an "Admin" link in the header).
 * Returns false for any failure, never throws.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
    return (await tryRequireAdmin()) !== null;
}
