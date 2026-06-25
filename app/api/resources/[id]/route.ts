/**
 * app/api/resources/[id]/route.ts
 *
 * GET — a single active resource (with its links) for any signed-in user.
 * Used by the home page to open a resource's detail modal from a deep-link
 * (e.g. /?resource=<id> produced by an @resource mention).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResourceById } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    try {
        const resource = await getResourceById(id);
        if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
        return NextResponse.json({ resource: { ...resource, source: 'Local' } });
    } catch (err) {
        console.error('Resource get error:', err);
        return NextResponse.json({ error: 'Failed to load resource' }, { status: 500 });
    }
}
