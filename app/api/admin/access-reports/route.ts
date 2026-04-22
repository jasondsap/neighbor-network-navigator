/**
 * app/api/admin/access-reports/route.ts
 *
 * GET — paginated list for the admin queue.
 *       Filters: status, resource_id, barrier (JSONB contains).
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import { isValidAccessStatus } from '@/lib/access-reports';

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
    const status     = sp.get('status')      || 'pending';   // 'pending' (open+reviewed) | specific | 'all'
    const resourceId = sp.get('resource_id') || null;
    const barrier    = sp.get('barrier')     || null;        // one barrier code to filter by
    const page       = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const pageSize   = Math.min(100, Math.max(10, parseInt(sp.get('pageSize') || '25', 10)));
    const offset     = (page - 1) * pageSize;

    const clauses: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status === 'pending') {
        // "pending" = anything that still needs attention
        clauses.push(`ar.status IN ('open', 'reviewed')`);
    } else if (status !== 'all' && isValidAccessStatus(status)) {
        clauses.push(`ar.status = $${p}`);
        params.push(status);
        p += 1;
    }

    if (resourceId) {
        clauses.push(`ar.resource_id = $${p}`);
        params.push(resourceId);
        p += 1;
    }

    if (barrier) {
        // JSONB contains: barriers @> '["waitlist"]'
        clauses.push(`ar.barriers @> $${p}::jsonb`);
        params.push(JSON.stringify([barrier]));
        p += 1;
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    try {
        const rows = await (sql as any).query(
            `
                SELECT
                    ar.id, ar.status, ar.created_at, ar.updated_at,
                    ar.barriers, ar.barriers_other,
                    ar.attempt_methods, ar.attempt_count,
                    ar.final_outcome,
                    ar.improvements, ar.improvements_other,
                    ar.additional_notes,

                    r.id AS resource_id,
                    r.organization_name AS resource_name,
                    r.category AS resource_category,
                    r.is_active AS resource_is_active,

                    COALESCE(u.first_name || ' ' || u.last_name, u.email) AS reporter_name,
                    u.email AS reporter_email
                FROM access_reports ar
                JOIN resources r ON ar.resource_id = r.id
                LEFT JOIN users u ON ar.reporter_id = u.id
                ${whereSql}
                ORDER BY
                    CASE ar.status
                        WHEN 'open'      THEN 1
                        WHEN 'reviewed'  THEN 2
                        WHEN 'addressed' THEN 3
                        WHEN 'archived'  THEN 4
                    END,
                    ar.created_at DESC
                LIMIT $${p} OFFSET $${p + 1}
            `,
            [...params, pageSize, offset]
        );

        const totalRow = await (sql as any).query(
            `SELECT COUNT(*)::INT AS total FROM access_reports ar ${whereSql}`,
            params
        );
        const total = (Array.isArray(totalRow) ? totalRow[0] : totalRow.rows?.[0])?.total ?? 0;

        return NextResponse.json({
            reports: Array.isArray(rows) ? rows : rows.rows ?? [],
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (err) {
        console.error('Admin access report list error:', err);
        return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
    }
}
