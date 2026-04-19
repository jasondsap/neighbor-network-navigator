/**
 * app/api/flags/route.ts
 *
 * POST — authenticated navigator submits a flag against a resource.
 *
 * Security: uses session to identify flagger (never trusts a client-supplied
 * user id). Only validates that the resource exists; anyone signed in can flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';
import { validateFlagSubmission } from '@/lib/flags';

export async function POST(request: NextRequest) {
    // Auth
    let userId: string;
    try {
        const session = await getSessionWithUserId();
        userId = session.internalUserId;
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse + validate
    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { data, errors } = validateFlagSubmission(body);
    if (!data) {
        return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    try {
        // Confirm the resource exists and is active before accepting the flag
        const found = await sql`
            SELECT id, organization_name FROM resources WHERE id = ${data.resource_id}
        `;
        if ((found as any[]).length === 0) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        const inserted = await sql`
            INSERT INTO resource_flags (
                resource_id, flagged_by, category, description, suggested_correction
            ) VALUES (
                ${data.resource_id}, ${userId}, ${data.category},
                ${data.description}, ${data.suggested_correction}
            )
            RETURNING id, created_at
        `;

        return NextResponse.json({
            success: true,
            flag: (inserted as any[])[0],
        });
    } catch (err) {
        console.error('Flag submission error:', err);
        return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 });
    }
}
