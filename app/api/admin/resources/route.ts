/**
 * app/api/admin/resources/route.ts
 *
 * GET  /api/admin/resources   — paginated search (admins see archived too)
 * POST /api/admin/resources   — create a new resource
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import { normalizeResourceInput, validateEditSummary } from '@/lib/resource-admin';

// ----------------------------------------------------------------------------
// Shared auth wrapper
// ----------------------------------------------------------------------------
async function requireAdminResponse(): Promise<
    { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
    try {
        const { userId } = await requireAdmin();
        return { ok: true, userId };
    } catch (err) {
        if (err instanceof NotAdminError) {
            return { ok: false, response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
        }
        return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

// ============================================================================
// GET — paginated search
// ============================================================================
export async function GET(request: NextRequest) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const sp = request.nextUrl.searchParams;
    const q           = (sp.get('q')           || '').trim();
    const category    = sp.get('category')     || 'all';
    const status      = sp.get('status')       || 'active';   // 'active' | 'archived' | 'all'
    const page        = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const pageSize    = Math.min(100, Math.max(10, parseInt(sp.get('pageSize') || '25', 10)));
    const offset      = (page - 1) * pageSize;

    const clauses: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status === 'active')   clauses.push('is_active = TRUE');
    else if (status === 'archived') clauses.push('is_active = FALSE');
    // else 'all' — no filter

    if (q) {
        clauses.push(`(
            search_vector @@ plainto_tsquery('english', $${p})
            OR organization_name ILIKE '%' || $${p} || '%'
        )`);
        params.push(q);
        p += 1;
    }

    if (category && category !== 'all') {
        clauses.push(`category = $${p}`);
        params.push(category);
        p += 1;
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    try {
        const rows = await (sql as any).query(
            `
                SELECT
                    id, organization_name, program_name, category, subcategory,
                    phone, address, is_active, updated_at
                FROM resources
                ${whereSql}
                ORDER BY organization_name ASC
                LIMIT $${p} OFFSET $${p + 1}
            `,
            [...params, pageSize, offset]
        );

        const totalRow = await (sql as any).query(
            `SELECT COUNT(*)::INT AS total FROM resources ${whereSql}`,
            params
        );

        const total = (Array.isArray(totalRow) ? totalRow[0] : totalRow.rows?.[0])?.total ?? 0;

        return NextResponse.json({
            resources: Array.isArray(rows) ? rows : rows.rows ?? [],
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (err) {
        console.error('Admin resources list error:', err);
        return NextResponse.json({ error: 'Failed to load resources' }, { status: 500 });
    }
}

// ============================================================================
// POST — create a new resource
// ============================================================================
export async function POST(request: NextRequest) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Edit summary is required even on create (explains *why* this was added)
    const summaryCheck = validateEditSummary(body.edit_summary);
    if (summaryCheck.error) {
        return NextResponse.json({ error: summaryCheck.error }, { status: 400 });
    }

    const { data, errors } = normalizeResourceInput(body);
    if (errors.length) {
        return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    try {
        // No trigger fires on INSERT (by design — nothing to snapshot). Instead,
        // we manually write a "creation" version row so the history has a start point.
        const result = await sql`
            INSERT INTO resources (
                organization_name, program_name, category, subcategory, service_type,
                service_description, capacity, last_updated_at,
                address, city, state, zip, latitude, longitude,
                phone, email, website, hours, point_of_contact,
                qualifier_geography, qualifier_age, qualifier_income, qualifier_cohort, qualifier_misc,
                required_documents, tips_tricks, notes, languages,
                source, is_active, created_by, updated_by
            ) VALUES (
                ${data.organization_name}, ${data.program_name}, ${data.category}, ${data.subcategory}, ${data.service_type},
                ${data.service_description}, ${data.capacity}, ${data.last_updated_at},
                ${data.address}, ${data.city}, ${data.state}, ${data.zip}, ${data.latitude}, ${data.longitude},
                ${data.phone}, ${data.email}, ${data.website}, ${data.hours}, ${data.point_of_contact},
                ${data.qualifier_geography}, ${data.qualifier_age}, ${data.qualifier_income}, ${data.qualifier_cohort}, ${data.qualifier_misc},
                ${data.required_documents}, ${data.tips_tricks}, ${data.notes}, ${data.languages},
                'local', TRUE, ${auth.userId}, ${auth.userId}
            )
            RETURNING *
        `;

        const created: any = (result as any[])[0];

        // Write a v1 "created" entry in resource_versions so history starts clean
        await sql`
            INSERT INTO resource_versions (
                resource_id, version_number, edited_by, edit_summary, edit_kind,
                organization_name, program_name, category, subcategory, service_type,
                service_description, capacity, last_updated_at,
                address, city, state, zip, latitude, longitude,
                phone, email, website, hours, point_of_contact,
                qualifier_geography, qualifier_age, qualifier_income,
                qualifier_cohort, qualifier_misc,
                required_documents, tips_tricks, notes, is_active, languages
            ) VALUES (
                ${created.id}, 1, ${auth.userId},
                ${'Created: ' + summaryCheck.value}, 'update',
                ${created.organization_name}, ${created.program_name}, ${created.category}, ${created.subcategory}, ${created.service_type},
                ${created.service_description}, ${created.capacity}, ${created.last_updated_at},
                ${created.address}, ${created.city}, ${created.state}, ${created.zip}, ${created.latitude}, ${created.longitude},
                ${created.phone}, ${created.email}, ${created.website}, ${created.hours}, ${created.point_of_contact},
                ${created.qualifier_geography}, ${created.qualifier_age}, ${created.qualifier_income},
                ${created.qualifier_cohort}, ${created.qualifier_misc},
                ${created.required_documents}, ${created.tips_tricks}, ${created.notes}, ${created.is_active}, ${created.languages}
            )
        `;

        return NextResponse.json({ success: true, resource: created });
    } catch (err) {
        console.error('Admin resource create error:', err);
        return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
    }
}
