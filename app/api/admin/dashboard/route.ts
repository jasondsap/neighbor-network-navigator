/**
 * app/api/admin/dashboard/route.ts
 *
 * Update log:
 *  - Phase C: real pendingFlags count
 *  - Phase D: adds pendingAccessReports count
 */

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';

export async function GET() {
    try {
        await requireAdmin();
    } catch (err) {
        if (err instanceof NotAdminError) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const [counts, totalRow, recentEdits, staleRow, pendingRow, accessPendingRow] = await Promise.all([
            sql`
                SELECT category, COUNT(*)::INT AS count
                FROM resources
                WHERE is_active = TRUE
                GROUP BY category
                ORDER BY count DESC
            `,
            sql`SELECT COUNT(*)::INT AS total FROM resources WHERE is_active = TRUE`,
            sql`
                SELECT
                    r.id,
                    r.organization_name,
                    r.category,
                    r.updated_at,
                    COALESCE(u.first_name || ' ' || u.last_name, u.email) AS editor
                FROM resources r
                LEFT JOIN users u ON r.updated_by = u.id
                WHERE r.is_active = TRUE
                ORDER BY r.updated_at DESC
                LIMIT 5
            `,
            sql`
                SELECT COUNT(*)::INT AS stale
                FROM resources
                WHERE is_active = TRUE
                  AND (last_updated_at IS NULL OR last_updated_at < NOW() - INTERVAL '6 months')
            `,
            sql`
                SELECT COUNT(*)::INT AS pending
                FROM resource_flags
                WHERE status IN ('open', 'in_progress')
            `,
            sql`
                SELECT COUNT(*)::INT AS pending
                FROM access_reports
                WHERE status IN ('open', 'reviewed')
            `,
        ]);

        return NextResponse.json({
            total: (totalRow as any[])[0]?.total ?? 0,
            categoryCounts: counts,
            recentEdits,
            staleCount: (staleRow as any[])[0]?.stale ?? 0,
            pendingFlags: (pendingRow as any[])[0]?.pending ?? 0,
            pendingAccessReports: (accessPendingRow as any[])[0]?.pending ?? 0,
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        return NextResponse.json(
            { error: 'Failed to load dashboard' },
            { status: 500 }
        );
    }
}
