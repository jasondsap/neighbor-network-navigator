/**
 * app/api/channels/[id]/route.ts
 *
 * PATCH  — { name, description } — edit a channel (creator or admin; DMs can't
 *          be edited). Public channels still don't require a description here —
 *          it's optional, matching channel creation in this app.
 * DELETE — soft-archive a channel (sets is_archived = true). The creator or an
 *          admin can archive any channel; either participant can archive a DM.
 *
 * Gated by requireAuth (any signed-in user); per-action ownership checked below.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, logAuditEvent } from '@/lib/db';
import { getSessionWithUserId } from '@/lib/auth';

async function uid(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
    try {
        const { internalUserId } = await getSessionWithUserId();
        return { ok: true, userId: internalUserId };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
}

async function isAdmin(userId: string): Promise<boolean> {
    const row = await queryOne<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [userId]);
    return row?.role === 'admin';
}

// ============================================================================
// PATCH — edit name/description
// ============================================================================
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    const { id } = await params;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        const ch = await queryOne<{ created_by: string | null; channel_type: string }>(
            `SELECT created_by, channel_type FROM channels WHERE id = $1 AND is_archived = false`,
            [id]
        );
        if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        if (ch.channel_type === 'dm') {
            return NextResponse.json({ error: 'Direct messages cannot be edited' }, { status: 400 });
        }
        if (ch.created_by !== me && !(await isAdmin(me))) {
            return NextResponse.json({ error: 'Only the channel creator can edit this channel' }, { status: 403 });
        }

        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const channel = await queryOne<any>(
            `UPDATE channels SET name = $1, description = $2 WHERE id = $3::uuid RETURNING *`,
            [name, description || null, id]
        );
        await logAuditEvent(me, 'update', 'channels', id, { name });
        return NextResponse.json({ success: true, channel });
    } catch (err) {
        console.error('Channel update error:', err);
        return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
    }
}

// ============================================================================
// DELETE — soft-archive
// ============================================================================
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await uid();
    if (!auth.ok) return auth.res;
    const me = auth.userId;
    const { id } = await params;

    try {
        const ch = await queryOne<{
            created_by: string | null;
            channel_type: string;
            dm_user_1: string | null;
            dm_user_2: string | null;
        }>(
            `SELECT created_by, channel_type, dm_user_1, dm_user_2 FROM channels WHERE id = $1 AND is_archived = false`,
            [id]
        );
        if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

        const isParticipant = ch.channel_type === 'dm' && (ch.dm_user_1 === me || ch.dm_user_2 === me);
        if (ch.created_by !== me && !isParticipant && !(await isAdmin(me))) {
            return NextResponse.json({ error: 'You do not have permission to delete this channel' }, { status: 403 });
        }

        await query(`UPDATE channels SET is_archived = true WHERE id = $1`, [id]);
        await logAuditEvent(me, 'delete', 'channels', id);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Channel delete error:', err);
        return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 });
    }
}
