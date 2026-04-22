/**
 * app/api/admin/access-reports/summary/route.ts
 *
 * GET — counts by status for the admin header and sidebar badge.
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
        const rows = (await sql`
            SELECT status, COUNT(*)::INT AS count
            FROM access_reports
            GROUP BY status
        `) as any[];

        const byStatus: Record<string, number> = {
            open: 0, reviewed: 0, addressed: 0, archived: 0,
        };
        for (const r of rows) byStatus[r.status] = r.count;

        const pending = byStatus.open + byStatus.reviewed;
        const total = pending + byStatus.addressed + byStatus.archived;

        return NextResponse.json({ byStatus, pending, total });
    } catch (err) {
        console.error('Access report summary error:', err);
        return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
    }
}
