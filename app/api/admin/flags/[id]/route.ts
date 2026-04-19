/**
 * app/api/admin/flags/[id]/route.ts
 *
 * GET   — single flag with full context (resource data, flagger info, timeline)
 * PATCH — transition state (in_progress / resolved / dismissed).
 *         resolve + dismiss REQUIRE a resolution note (per Phase C decision).
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import {
    isValidStatus,
    validateResolutionNote,
    type FlagStatusValue,
} from '@/lib/flags';

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
// GET
// ============================================================================
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    try {
        const rows = await sql`
            SELECT
                f.*,
                r.organization_name AS resource_name,
                r.category AS resource_category,
                r.phone AS resource_phone,
                r.address AS resource_address,
                r.website AS resource_website,
                r.email AS resource_email,
                r.hours AS resource_hours,
                r.is_active AS resource_is_active,

                COALESCE(fu.first_name || ' ' || fu.last_name, fu.email) AS flagger_name,
                fu.email AS flagger_email,

                COALESCE(ru.first_name || ' ' || ru.last_name, ru.email) AS resolver_name,
                ru.email AS resolver_email
            FROM resource_flags f
            JOIN resources r    ON f.resource_id = r.id
            LEFT JOIN users fu  ON f.flagged_by  = fu.id
            LEFT JOIN users ru  ON f.resolved_by = ru.id
            WHERE f.id = ${id}
        `;

        if ((rows as any[]).length === 0) {
            return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
        }

        return NextResponse.json({ flag: (rows as any[])[0] });
    } catch (err) {
        console.error('Admin flag detail error:', err);
        return NextResponse.json({ error: 'Failed to load flag' }, { status: 500 });
    }
}

// ============================================================================
// PATCH — transition state
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

    const nextStatus = body.status;
    if (!isValidStatus(nextStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Load current flag to validate the transition is legal
    const current = await sql`SELECT status FROM resource_flags WHERE id = ${id}`;
    if ((current as any[]).length === 0) {
        return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }
    const currentStatus: FlagStatusValue = (current as any[])[0].status;

    if (currentStatus === nextStatus) {
        return NextResponse.json({ error: `Flag is already ${nextStatus}` }, { status: 400 });
    }

    // Resolve/dismiss require a note. Marking in_progress does not.
    const isClosing = nextStatus === 'resolved' || nextStatus === 'dismissed';
    const isReopening = nextStatus === 'open' || nextStatus === 'in_progress';

    let note: string | null = null;
    if (isClosing) {
        const check = validateResolutionNote(body.resolution_note);
        if (check.error) {
            return NextResponse.json({ error: check.error }, { status: 400 });
        }
        note = check.value;
    }

    try {
        let updated: any;

        if (isClosing) {
            const rows = await sql`
                UPDATE resource_flags SET
                    status          = ${nextStatus},
                    resolved_at     = NOW(),
                    resolved_by     = ${auth.userId},
                    resolution_note = ${note}
                WHERE id = ${id}
                RETURNING *
            `;
            updated = (rows as any[])[0];
        } else if (isReopening) {
            // Moving back to open/in_progress — clear resolution tracking
            const rows = await sql`
                UPDATE resource_flags SET
                    status          = ${nextStatus},
                    resolved_at     = NULL,
                    resolved_by     = NULL,
                    resolution_note = NULL
                WHERE id = ${id}
                RETURNING *
            `;
            updated = (rows as any[])[0];
        }

        return NextResponse.json({ success: true, flag: updated });
    } catch (err) {
        console.error('Admin flag update error:', err);
        return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
    }
}
