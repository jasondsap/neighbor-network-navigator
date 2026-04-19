/**
 * app/api/admin/resources/[id]/restore/route.ts
 *
 * POST — un-archive a soft-deleted resource (sets is_active back to TRUE).
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
    { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    let body: any = {};
    try {
        body = await request.json();
    } catch {
        // empty body is OK
    }

    const summaryCheck = validateEditSummary(body.edit_summary);
    if (summaryCheck.error) {
        return NextResponse.json({ error: summaryCheck.error }, { status: 400 });
    }

    try {
        const ctx = buildEditorContextStatements(userId, summaryCheck.value!, 'restore');
        const updateStmt = sql`
            UPDATE resources
               SET is_active = TRUE,
                   updated_by = ${userId},
                   updated_at = NOW()
             WHERE id = ${id}
             RETURNING id, organization_name, is_active
        `;

        const results = await (sql as any).transaction([...ctx, updateStmt]);
        const restored: any = (results[results.length - 1] as any[])[0];

        if (!restored) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, resource: restored });
    } catch (err) {
        console.error('Admin resource restore error:', err);
        return NextResponse.json({ error: 'Failed to restore resource' }, { status: 500 });
    }
}
