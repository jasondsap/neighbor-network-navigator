/**
 * app/api/admin/resources/[id]/versions/[versionId]/restore/route.ts
 *
 * POST — roll back a resource to a prior version.
 *
 * Copies every column from the chosen version row back into the live
 * resource row. The trigger fires on the UPDATE, so a new "rollback"
 * version entry gets stamped into history — you can see the rollback
 * in the history list and roll back FROM it if needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import {
    validateEditSummary,
    buildEditorContextStatements,
} from '@/lib/resource-admin';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; versionId: string }> }
) {
    let userId: string;
    try {
        const result = await requireAdmin();
        userId = result.userId;
    } catch (err) {
        if (err instanceof NotAdminError) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, versionId } = await params;

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        // empty body is OK; we build a default summary below
    }

    // Summary is provided by the admin OR we auto-generate one
    const rawSummary =
        body.edit_summary ||
        `Rolled back to an earlier version`;
    const summaryCheck = validateEditSummary(rawSummary);
    if (summaryCheck.error) {
        return NextResponse.json({ error: summaryCheck.error }, { status: 400 });
    }

    try {
        // Fetch the version snapshot
        const versionRow = await sql`
            SELECT * FROM resource_versions
             WHERE id = ${versionId}
               AND resource_id = ${id}
        `;

        if ((versionRow as any[]).length === 0) {
            return NextResponse.json({ error: 'Version not found' }, { status: 404 });
        }

        const v: any = (versionRow as any[])[0];

        // Build a more descriptive summary if the caller didn't provide a custom one
        const finalSummary = body.edit_summary
            ? summaryCheck.value!
            : `Rolled back to version ${v.version_number}`;

        const ctx = buildEditorContextStatements(userId, finalSummary, 'rollback');
        const updateStmt = sql`
            UPDATE resources SET
                organization_name   = ${v.organization_name},
                program_name        = ${v.program_name},
                category            = ${v.category},
                subcategory         = ${v.subcategory},
                service_type        = ${v.service_type},
                service_description = ${v.service_description},
                capacity            = ${v.capacity},
                last_updated_at     = ${v.last_updated_at},
                address             = ${v.address},
                city                = ${v.city},
                state               = ${v.state},
                zip                 = ${v.zip},
                latitude            = ${v.latitude},
                longitude           = ${v.longitude},
                phone               = ${v.phone},
                email               = ${v.email},
                website             = ${v.website},
                hours               = ${v.hours},
                point_of_contact    = ${v.point_of_contact},
                qualifier_geography = ${v.qualifier_geography},
                qualifier_age       = ${v.qualifier_age},
                qualifier_income    = ${v.qualifier_income},
                qualifier_cohort    = ${v.qualifier_cohort},
                qualifier_misc      = ${v.qualifier_misc},
                required_documents  = ${v.required_documents},
                tips_tricks         = ${v.tips_tricks},
                notes               = ${v.notes},
                is_active           = ${v.is_active},
                updated_by          = ${userId},
                updated_at          = NOW()
            WHERE id = ${id}
            RETURNING *
        `;

        const results = await (sql as any).transaction([...ctx, updateStmt]);
        const updated = (results[results.length - 1] as any[])[0];

        return NextResponse.json({
            success: true,
            resource: updated,
            rolledBackToVersion: v.version_number,
        });
    } catch (err) {
        console.error('Admin resource rollback error:', err);
        return NextResponse.json({ error: 'Failed to roll back resource' }, { status: 500 });
    }
}
