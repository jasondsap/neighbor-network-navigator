/**
 * app/api/admin/me/route.ts
 *
 * Lightweight endpoint for the main app header to check
 * "is the current user an admin?" without bundling admin logic client-side.
 *
 * Returns: { isAdmin: boolean }
 */

import { NextResponse } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/admin';

export async function GET() {
    const isAdmin = await isCurrentUserAdmin();
    return NextResponse.json({ isAdmin });
}
