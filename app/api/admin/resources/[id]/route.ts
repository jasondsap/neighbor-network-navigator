/**
 * app/api/admin/resources/[id]/route.ts
 *
 * GET    — fetch one resource + its version list
 * PUT    — update (triggers versioning)
 * DELETE — soft-delete (archive)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import {
    normalizeResourceInput,
    validateEditSummary,
    buildEditorContextStatements,
} from '@/lib/resource-admin';

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
// GET — resource + version history
// ============================================================================
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    try {
        const resource = await sql`SELECT * FROM resources WHERE id = ${id}`;
        if ((resource as any[]).length === 0) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        const versions = await sql`
            SELECT
                v.id,
                v.version_number,
                v.edit_summary,
                v.edit_kind,
                v.created_at,
                v.edited_by,
                COALESCE(u.first_name || ' ' || u.last_name, u.email) AS editor_name,
                u.email AS editor_email
            FROM resource_versions v
            LEFT JOIN users u ON v.edited_by = u.id
            WHERE v.resource_id = ${id}
            ORDER BY v.version_number DESC
        `;

        return NextResponse.json({
            resource: (resource as any[])[0],
            versions,
        });
    } catch (err) {
        console.error('Admin resource get error:', err);
        return NextResponse.json({ error: 'Failed to load resource' }, { status: 500 });
    }
}

// ============================================================================
// PUT — update (snapshotted by trigger)
// ============================================================================
export async function PUT(
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

    const summaryCheck = validateEditSummary(body.edit_summary);
    if (summaryCheck.error) {
        return NextResponse.json({ error: summaryCheck.error }, { status: 400 });
    }

    const { data, errors } = normalizeResourceInput(body);
    if (errors.length) {
        return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    try {
        // All statements run in one Neon transaction so the session-local
        // set_config values are visible to the trigger inside fn_snapshot_resource.
        const ctx = buildEditorContextStatements(auth.userId, summaryCheck.value!, 'update');
        const updateStmt = sql`
            UPDATE resources SET
                organization_name   = ${data.organization_name},
                program_name        = ${data.program_name},
                category            = ${data.category},
                subcategory         = ${data.subcategory},
                service_type        = ${data.service_type},
                service_description = ${data.service_description},
                capacity            = ${data.capacity},
                last_updated_at     = ${data.last_updated_at},
                address             = ${data.address},
                city                = ${data.city},
                state               = ${data.state},
                zip                 = ${data.zip},
                latitude            = ${data.latitude},
                longitude           = ${data.longitude},
                phone               = ${data.phone},
                email               = ${data.email},
                website             = ${data.website},
                hours               = ${data.hours},
                point_of_contact    = ${data.point_of_contact},
                qualifier_geography = ${data.qualifier_geography},
                qualifier_age       = ${data.qualifier_age},
                qualifier_income    = ${data.qualifier_income},
                qualifier_cohort    = ${data.qualifier_cohort},
                qualifier_misc      = ${data.qualifier_misc},
                required_documents  = ${data.required_documents},
                tips_tricks         = ${data.tips_tricks},
                notes               = ${data.notes},
                updated_by          = ${auth.userId},
                updated_at          = NOW()
            WHERE id = ${id}
            RETURNING *
        `;

        const results = await (sql as any).transaction([...ctx, updateStmt]);
        const updated: any = (results[results.length - 1] as any[])[0];

        if (!updated) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, resource: updated });
    } catch (err) {
        console.error('Admin resource update error:', err);
        return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 });
    }
}

// ============================================================================
// DELETE — soft-delete (archive)
// ============================================================================
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // Per Phase B decision: edit summary required even on archive.
    // Passed via query string since DELETE often has no body.
    const rawSummary =
        request.nextUrl.searchParams.get('edit_summary') ||
        (await request.json().then(b => b?.edit_summary).catch(() => null));

    const summaryCheck = validateEditSummary(rawSummary);
    if (summaryCheck.error) {
        return NextResponse.json({ error: summaryCheck.error }, { status: 400 });
    }

    try {
        const ctx = buildEditorContextStatements(auth.userId, summaryCheck.value!, 'archive');
        const updateStmt = sql`
            UPDATE resources
               SET is_active = FALSE,
                   updated_by = ${auth.userId},
                   updated_at = NOW()
             WHERE id = ${id}
             RETURNING id, organization_name
        `;

        const results = await (sql as any).transaction([...ctx, updateStmt]);
        const archived: any = (results[results.length - 1] as any[])[0];

        if (!archived) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, archived });
    } catch (err) {
        console.error('Admin resource archive error:', err);
        return NextResponse.json({ error: 'Failed to archive resource' }, { status: 500 });
    }
}
