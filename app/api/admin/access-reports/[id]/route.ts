/**
 * app/api/admin/access-reports/[id]/route.ts
 *
 * GET   — single report with full resource context
 * PATCH — transition status (open / reviewed / addressed / archived).
 *         A note is required on every transition so the team has a paper trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import {
    isValidAccessStatus,
    validateAdminNote,
    type AccessReportStatus,
} from '@/lib/access-reports';

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
        const rows = (await sql`
            SELECT
                ar.*,
                r.organization_name AS resource_name,
                r.program_name AS resource_program_name,
                r.category AS resource_category,
                r.subcategory AS resource_subcategory,
                r.phone AS resource_phone,
                r.email AS resource_email,
                r.website AS resource_website,
                r.address AS resource_address,
                r.hours AS resource_hours,
                r.is_active AS resource_is_active,

                COALESCE(u.first_name || ' ' || u.last_name, u.email) AS reporter_name,
                u.email AS reporter_email,

                COALESCE(mu.first_name || ' ' || mu.last_name, mu.email) AS status_changer_name
            FROM access_reports ar
            JOIN resources r   ON ar.resource_id = r.id
            LEFT JOIN users u  ON ar.reporter_id = u.id
            LEFT JOIN users mu ON ar.status_changed_by = mu.id
            WHERE ar.id = ${id}
        `) as any[];

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        return NextResponse.json({ report: rows[0] });
    } catch (err) {
        console.error('Admin access report detail error:', err);
        return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
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
    if (!isValidAccessStatus(nextStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Every transition requires a note — reviewed/addressed/archived need explanation,
    // and even "reopen" back to open should explain why we're reopening.
    const noteCheck = validateAdminNote(body.admin_notes);
    if (noteCheck.error) {
        return NextResponse.json({ error: noteCheck.error }, { status: 400 });
    }

    // Load current to validate the transition is real
    const current = (await sql`
        SELECT status FROM access_reports WHERE id = ${id}
    `) as any[];
    if (current.length === 0) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const currentStatus: AccessReportStatus = current[0].status;
    if (currentStatus === nextStatus) {
        return NextResponse.json({ error: `Report is already ${nextStatus}` }, { status: 400 });
    }

    try {
        const rows = (await sql`
            UPDATE access_reports SET
                status             = ${nextStatus},
                admin_notes        = ${noteCheck.value},
                status_changed_at  = NOW(),
                status_changed_by  = ${auth.userId}
            WHERE id = ${id}
            RETURNING *
        `) as any[];

        return NextResponse.json({ success: true, report: rows[0] });
    } catch (err) {
        console.error('Admin access report update error:', err);
        return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
    }
}
