/**
 * app/api/admin/resources/[id]/links/[linkId]/route.ts
 *
 * PUT    — update a link  { source_field, link_text?, url, sort_order? }
 * DELETE — remove a link
 *
 * resource_links has no updated_at column, so we use raw query() rather than
 * the generic update() helper (which auto-appends updated_at = NOW()).
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, hardDelete, logAuditEvent } from '@/lib/db';
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
// PUT — update a link
// ============================================================================
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; linkId: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id, linkId } = await params;

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
        const rows = await query<any>(
            `UPDATE resource_links
                SET source_field = $1, link_text = $2, url = $3, sort_order = $4
              WHERE id = $5 AND resource_id = $6
              RETURNING id, source_field, link_text, url, sort_order`,
            [data.source_field, data.link_text, data.url, data.sort_order, linkId, id]
        );
        if (rows.length === 0) {
            return NextResponse.json({ error: 'Link not found' }, { status: 404 });
        }

        await logAuditEvent(auth.userId, 'update', 'resource_link', linkId, { resource_id: id, url: data.url });
        return NextResponse.json({ success: true, link: rows[0] });
    } catch (err: any) {
        // Unique (resource_id, source_field, url) violation
        if (err?.code === '23505') {
            return NextResponse.json({ error: 'That link already exists for this resource' }, { status: 409 });
        }
        console.error('Admin link update error:', err);
        return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
    }
}

// ============================================================================
// DELETE — remove a link
// ============================================================================
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; linkId: string }> }
) {
    const auth = await requireAdminResponse();
    if (!auth.ok) return auth.response;

    const { id, linkId } = await params;

    try {
        const existing = await query<any>(
            `SELECT id FROM resource_links WHERE id = $1 AND resource_id = $2`,
            [linkId, id]
        );
        if (existing.length === 0) {
            return NextResponse.json({ error: 'Link not found' }, { status: 404 });
        }

        await hardDelete('resource_links', linkId);
        await logAuditEvent(auth.userId, 'delete', 'resource_link', linkId, { resource_id: id });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Admin link delete error:', err);
        return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
    }
}
