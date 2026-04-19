/**
 * app/api/resource-subcategories/route.ts
 *
 * Returns subcategories with their resource counts. Powers the chip-based
 * filter UI on the Resource Navigator page.
 *
 * Query params:
 *   ?category=<name>   Optional. Filter to one category. Without it, returns
 *                      all subcategories grouped by category.
 *
 * Response shape:
 *   { subcategories: [{ category: string, subcategory: string, resource_count: number }] }
 *
 * Backed by the `vw_subcategories_with_counts` view in Neon.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSubcategoriesWithCounts } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        await requireAuth();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const category = request.nextUrl.searchParams.get('category') || undefined;

    try {
        const subcategories = await getSubcategoriesWithCounts(category);
        return NextResponse.json({
            subcategories,
            category: category || 'all',
            total: Array.isArray(subcategories) ? subcategories.length : 0,
        });
    } catch (err) {
        console.error('Subcategories fetch error:', err);
        return NextResponse.json(
            { error: 'Failed to fetch subcategories' },
            { status: 500 }
        );
    }
}
