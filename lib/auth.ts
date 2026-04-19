import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { sql } from './db';

export { authOptions };

// ============================================================================
// Session shape (simplified — no organizations)
// ============================================================================
export interface AppSession {
    user: {
        id: string;                // Cognito sub
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    expires: string;
}

/**
 * Current session on the server (or null).
 */
export async function getSession(): Promise<AppSession | null> {
    return (await getServerSession(authOptions)) as AppSession | null;
}

/**
 * Current user or null.
 */
export async function getCurrentUser() {
    const session = await getSession();
    return session?.user ?? null;
}

/**
 * Require auth. Throws 'Unauthorized' if missing — catch at the route level
 * and return 401.
 */
export async function requireAuth(): Promise<AppSession> {
    const session = await getSession();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    return session;
}

/**
 * Require the user to have a specific role (e.g. 'admin').
 */
export async function requireRole(allowedRoles: string[]) {
    const session = await requireAuth();
    const userId = await getInternalUserId(session.user.id, session.user.email);
    if (!userId) throw new Error('User not found');

    const rows = await sql`SELECT role FROM users WHERE id = ${userId}`;
    const role = (rows as any[])[0]?.role;

    if (!role || !allowedRoles.includes(role)) {
        throw new Error('Insufficient permissions');
    }
    return { session, userId, role };
}

/**
 * Resolve the internal users.id (UUID) from a Cognito sub or email.
 * Backfills cognito_sub when found via email fallback.
 */
export async function getInternalUserId(
    cognitoSub: string,
    email?: string | null
): Promise<string | null> {
    let result = (await sql`
        SELECT id FROM users WHERE cognito_sub = ${cognitoSub}
    `) as any[];
    if (result[0]?.id) return result[0].id;

    if (email) {
        result = (await sql`
            SELECT id FROM users WHERE email = ${email}
        `) as any[];
        if (result[0]?.id) {
            await sql`
                UPDATE users SET cognito_sub = ${cognitoSub} WHERE id = ${result[0].id}
            `;
            return result[0].id;
        }
    }

    return null;
}

/**
 * Standard helper for API routes: require auth and return both the session
 * and the internal UUID.
 */
export async function getSessionWithUserId() {
    const session = await requireAuth();
    const userId  = await getInternalUserId(session.user.id, session.user.email);

    if (!userId) {
        throw new Error('User not found in database');
    }

    return { ...session, internalUserId: userId };
}

// ============================================================================
// NextAuth type augmentation
// ============================================================================
declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        sub: string;
        accessToken?: string;
    }
}
