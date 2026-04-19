/**
 * app/api/favorites/route.ts
 *
 * User's saved-resource stars. Backed by Neon, gated by NextAuth session.
 *
 * Security note: this route ignores any `userId` param/body the client sends
 * and uses the authenticated session's internal UUID instead. That means:
 *   - No client can spoof another user's favorites
 *   - The existing frontend (which sends `userId=`) keeps working as-is;
 *     the param is simply ignored server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';

/** Resolve authenticated internal user ID or return 401. */
async function authedUserId(): Promise<
    { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
    try {
        const session = await getSessionWithUserId();
        return { ok: true, userId: session.internalUserId };
    } catch {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }
}

// ============================================================================
// GET — list the signed-in user's favorites
// ============================================================================
export async function GET() {
    const auth = await authedUserId();
    if (!auth.ok) return auth.response;

    try {
        const favorites = await sql`
            SELECT resource_id, resource_source, created_at
            FROM user_favorites
            WHERE user_id = ${auth.userId}
            ORDER BY created_at DESC
        `;
        return NextResponse.json({ favorites });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch favorites' },
            { status: 500 }
        );
    }
}

// ============================================================================
// POST — add a favorite (idempotent)
// ============================================================================
export async function POST(request: NextRequest) {
    const auth = await authedUserId();
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { resourceId, resourceSource = 'Local' } = body;

        if (!resourceId || typeof resourceId !== 'string') {
            return NextResponse.json(
                { error: 'resourceId is required' },
                { status: 400 }
            );
        }

        // ON CONFLICT DO NOTHING gives us natural idempotency — matching the
        // old Supabase version's 23505-unique-violation handling
        const result = await sql`
            INSERT INTO user_favorites (user_id, resource_id, resource_source)
            VALUES (${auth.userId}, ${resourceId}, ${resourceSource})
            ON CONFLICT (user_id, resource_id) DO NOTHING
            RETURNING id, resource_id, resource_source, created_at
        `;

        return NextResponse.json({
            success: true,
            favorite: (result as any[])[0] ?? null,   // null if it was already favorited
        });
    } catch (error) {
        console.error('Error adding favorite:', error);
        return NextResponse.json(
            { error: 'Failed to add favorite' },
            { status: 500 }
        );
    }
}

// ============================================================================
// DELETE — remove a favorite
// ============================================================================
export async function DELETE(request: NextRequest) {
    const auth = await authedUserId();
    if (!auth.ok) return auth.response;

    const resourceId = request.nextUrl.searchParams.get('resourceId');
    if (!resourceId) {
        return NextResponse.json(
            { error: 'resourceId query param is required' },
            { status: 400 }
        );
    }

    try {
        await sql`
            DELETE FROM user_favorites
            WHERE user_id = ${auth.userId}
              AND resource_id = ${resourceId}
        `;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing favorite:', error);
        return NextResponse.json(
            { error: 'Failed to remove favorite' },
            { status: 500 }
        );
    }
}
