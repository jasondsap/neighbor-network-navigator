/**
 * app/api/resources/mention-search/route.ts
 *
 * GET /api/resources/mention-search?q=…  — typeahead for @resource mentions in
 * the message composer. Returns up to 10 active resources matching the query by
 * organization or program name. Any signed-in user may search.
 *
 * Response: { results: [{ id, name, subtitle }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        await requireAuth();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const q = (request.nextUrl.searchParams.get('q') || '').trim();

    try {
        const results = await query<any>(
            `SELECT id,
                    organization_name AS name,
                    COALESCE(NULLIF(program_name, ''), category) AS subtitle
             FROM resources
             WHERE is_active
               AND ($1 = '' OR organization_name ILIKE '%' || $1 || '%' OR program_name ILIKE '%' || $1 || '%')
             ORDER BY
               CASE WHEN organization_name ILIKE $1 || '%' THEN 0 ELSE 1 END,
               organization_name
             LIMIT 10`,
            [q]
        );
        return NextResponse.json({ results });
    } catch (err) {
        console.error('Resource mention-search error:', err);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
