/**
 * app/api/admin/flags/summary/route.ts
 *
 * GET — aggregate counts for the admin dashboard and flag page header.
 *       Returns per-status totals and the overall "pending" figure.
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
        const rows = await sql`
            SELECT status, COUNT(*)::INT AS count
            FROM resource_flags
            GROUP BY status
        `;

        const byStatus: Record<string, number> = {
            open: 0, in_progress: 0, resolved: 0, dismissed: 0,
        };
        for (const r of rows as any[]) {
            byStatus[r.status] = r.count;
        }

        const pending = byStatus.open + byStatus.in_progress;
        const total = pending + byStatus.resolved + byStatus.dismissed;

        return NextResponse.json({ byStatus, pending, total });
    } catch (err) {
        console.error('Flag summary error:', err);
        return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
    }
}
