/**
 * app/api/admin/flags/route.ts
 *
 * GET — paginated list of flags for the admin triage queue.
 *       Filters: status, category, resource.
 *       Joins: flagger name, resource name.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import { isValidStatus, isValidCategory } from '@/lib/flags';

export async function GET(request: NextRequest) {
    try {
        await requireAdmin();
    } catch (err) {
        if (err instanceof NotAdminError) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const status     = sp.get('status')      || 'pending';   // 'pending' | 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'all'
    const category   = sp.get('category')    || 'all';
    const resourceId = sp.get('resource_id') || null;
    const page       = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const pageSize   = Math.min(100, Math.max(10, parseInt(sp.get('pageSize') || '25', 10)));
    const offset     = (page - 1) * pageSize;

    // Build filters dynamically. `pending` is a meta-filter = open + in_progress.
    const clauses: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status === 'pending') {
        clauses.push(`f.status IN ('open', 'in_progress')`);
    } else if (status !== 'all' && isValidStatus(status)) {
        clauses.push(`f.status = $${p}`);
        params.push(status);
        p += 1;
    }

    if (category !== 'all' && isValidCategory(category)) {
        clauses.push(`f.category = $${p}`);
        params.push(category);
        p += 1;
    }

    if (resourceId) {
        clauses.push(`f.resource_id = $${p}`);
        params.push(resourceId);
        p += 1;
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    try {
        const rows = await (sql as any).query(
            `
                SELECT
                    f.id, f.category, f.description, f.suggested_correction,
                    f.status, f.created_at, f.updated_at, f.resolved_at, f.resolution_note,

                    r.id AS resource_id,
                    r.organization_name AS resource_name,
                    r.is_active AS resource_is_active,

                    COALESCE(fu.first_name || ' ' || fu.last_name, fu.email) AS flagger_name,
                    fu.email AS flagger_email,

                    COALESCE(ru.first_name || ' ' || ru.last_name, ru.email) AS resolver_name
                FROM resource_flags f
                JOIN resources r     ON f.resource_id = r.id
                LEFT JOIN users fu   ON f.flagged_by   = fu.id
                LEFT JOIN users ru   ON f.resolved_by  = ru.id
                ${whereSql}
                ORDER BY
                    CASE f.status
                        WHEN 'open'        THEN 1
                        WHEN 'in_progress' THEN 2
                        WHEN 'resolved'    THEN 3
                        WHEN 'dismissed'   THEN 4
                    END,
                    f.created_at DESC
                LIMIT $${p} OFFSET $${p + 1}
            `,
            [...params, pageSize, offset]
        );

        const totalRow = await (sql as any).query(
            `
                SELECT COUNT(*)::INT AS total
                FROM resource_flags f
                JOIN resources r ON f.resource_id = r.id
                ${whereSql}
            `,
            params
        );
        const total = (Array.isArray(totalRow) ? totalRow[0] : totalRow.rows?.[0])?.total ?? 0;

        return NextResponse.json({
            flags: Array.isArray(rows) ? rows : rows.rows ?? [],
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (err) {
        console.error('Admin flag list error:', err);
        return NextResponse.json({ error: 'Failed to load flags' }, { status: 500 });
    }
}
