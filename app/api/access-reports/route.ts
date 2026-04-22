/**
 * app/api/access-reports/route.ts
 *
 * POST — authenticated navigator submits an "Unable to Access" report.
 * Uses session to identify the reporter; never trusts a client-supplied user id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { validateAccessReportSubmission } from '@/lib/access-reports';

export async function POST(request: NextRequest) {
    let userId: string;
    try {
        const session = await getSessionWithUserId();
        userId = session.internalUserId;
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { data, errors } = validateAccessReportSubmission(body);
    if (!data) {
        return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    try {
        // Confirm the resource exists
        const found = (await sql`
            SELECT id FROM resources WHERE id = ${data.resource_id}
        `) as any[];
        if (found.length === 0) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // JSONB arrays go in as JSON strings via parameter binding
        const inserted = (await sql`
            INSERT INTO access_reports (
                resource_id, reporter_id,
                barriers, barriers_other,
                waitlist_time_given, waitlist_estimate, waitlist_client_added,
                attempt_methods, attempt_count, final_outcome,
                improvements, improvements_other,
                similar_accessed, similar_where,
                additional_notes
            ) VALUES (
                ${data.resource_id}, ${userId},
                ${JSON.stringify(data.barriers)}::jsonb, ${data.barriers_other},
                ${data.waitlist_time_given}, ${data.waitlist_estimate}, ${data.waitlist_client_added},
                ${JSON.stringify(data.attempt_methods)}::jsonb, ${data.attempt_count}, ${data.final_outcome},
                ${JSON.stringify(data.improvements)}::jsonb, ${data.improvements_other},
                ${data.similar_accessed}, ${data.similar_where},
                ${data.additional_notes}
            )
            RETURNING id, created_at
        `) as any[];

        return NextResponse.json({
            success: true,
            report: inserted[0],
        });
    } catch (err) {
        console.error('Access report submission error:', err);
        return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
    }
}
