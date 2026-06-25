/**
 * app/api/admin/resources/[id]/links/route.ts
 *
 * Admin CRUD for a resource's structured links (resource_links table).
 *
 * GET  — list links for the resource
 * POST — create a link  { source_field, link_text?, url, sort_order? }
 *
 * Per-link update/delete live in ./[linkId]/route.ts.
 * Links are intentionally NOT versioned (resource_versions covers field edits only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, insert, logAuditEvent } from '@/lib/db';
import { requireAdmin, NotAdminError } from '@/lib/admin';
import { normalizeLinkInput } from '@/lib/resource-links';

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
// GET — list links for a resource
// ============================================================================
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    try {
        const links = await sql`
            SELECT id, source_field, link_text, url, sort_order
            FROM resource_links
            WHERE resource_id = ${id}
            ORDER BY sort_order, source_field, id
        `;
        return NextResponse.json({ links });
    } catch (err) {
        console.error('Admin links list error:', err);
        return NextResponse.json({ error: 'Failed to load links' }, { status: 500 });
    }
}

// ============================================================================
// POST — create a link
// ============================================================================
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { data, errors } = normalizeLinkInput(body);
    if (errors.length) {
        return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    try {
        // Confirm the parent resource exists (FK would catch it, but 404 is clearer).
        const parent = (await sql`SELECT id FROM resources WHERE id = ${id}`) as any[];
        if (parent.length === 0) {
            return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        }

        // Avoid duplicates — the table has a UNIQUE(resource_id, source_field, url).
        const dupe = (await sql`
            SELECT id FROM resource_links
            WHERE resource_id = ${id} AND source_field = ${data.source_field} AND url = ${data.url}
        `) as any[];
        if (dupe.length > 0) {
            return NextResponse.json({ error: 'That link already exists for this resource' }, { status: 409 });
        }

        const link = await insert<any>('resource_links', {
            resource_id: id,
            source_field: data.source_field,
            link_text: data.link_text,
            url: data.url,
            sort_order: data.sort_order,
        });

        await logAuditEvent(auth.userId, 'create', 'resource_link', link.id, {
            resource_id: id,
            source_field: data.source_field,
            url: data.url,
        });

        return NextResponse.json({ success: true, link }, { status: 201 });
    } catch (err) {
        console.error('Admin link create error:', err);
        return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
    }
}
