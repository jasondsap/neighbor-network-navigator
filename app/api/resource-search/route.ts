/**
 * app/api/resource-search/route.ts
 *
 * Combined search endpoint:
 *   - Local resources from Neon (via lib/db.ts)
 *   - SAMHSA treatment facilities via live API (unchanged from Supabase version)
 *
 * Gated behind NextAuth — returns 401 if the caller isn't signed in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { searchResources, getCategories } from '@/lib/db';

// Louisville, KY — default geocode for SAMHSA radius search
const LOUISVILLE_LAT = 38.2527;
const LOUISVILLE_LNG = -85.7585;

// ============================================================================
// SAMHSA — live API, unchanged from the Supabase-era route
// ============================================================================
interface SAMHSAFacility {
    name1: string;
    name2: string | null;
    street1: string;
    street2: string | null;
    city: string;
    state: string;
    zip: string;
    phone: string;
    website: string | null;
    latitude: string;
    longitude: string;
    miles: number;
    type_facility: string;
    services: Array<{ f1: string; f2: string; f3: string }>;
}

function getServiceTypes(services: Array<{ f1: string; f2: string; f3: string }>): string {
    const setting = services.find(s => s.f2 === 'SET');
    return setting?.f3 || '';
}

function getServiceDescription(services: Array<{ f1: string; f2: string; f3: string }>): string {
    const typeOfCare = services.find(s => s.f2 === 'TC');
    const setting    = services.find(s => s.f2 === 'SET');
    return [typeOfCare?.f3, setting?.f3].filter(Boolean).join('. ') || 'Treatment services available';
}

function getQualifier(services: Array<{ f1: string; f2: string; f3: string }>, code: string): string | null {
    return services.find(s => s.f2 === code)?.f3 || null;
}

async function searchSAMHSA(query: string, lat: number, lng: number, radiusMiles = 50) {
    try {
        const radiusMeters = radiusMiles * 1609.34;

        // Pick service type based on query keywords
        let sType = 'both';
        const q = query.toLowerCase();
        if (q.includes('mental health') || q.includes('counseling') || q.includes('therapy')) {
            sType = 'mh';
        } else if (q.includes('substance') || q.includes('addiction') || q.includes('detox') ||
                   q.includes('mat') || q.includes('suboxone')) {
            sType = 'sa';
        }

        const url =
            `https://findtreatment.gov/locator/exportsAsJson/v2` +
            `?sAddr=${lat},${lng}&limitType=2&limitValue=${radiusMeters}` +
            `&sType=${sType}&pageSize=50&page=1&sort=0`;

        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 3600 },   // Edge cache for 1 hour
        });

        if (!response.ok) {
            console.error('SAMHSA API error:', response.status);
            return [];
        }

        const data = await response.json();

        return (data.rows || []).map((facility: SAMHSAFacility, index: number) => ({
            id: `samhsa-${index}-${facility.name1}-${facility.zip}`.replace(/\s+/g, '-').toLowerCase(),
            organization_name: facility.name1,
            program_name: facility.name2,
            category: facility.type_facility === 'MH' ? 'Mental Health' : 'Substance Use Treatment',
            subcategory: getServiceTypes(facility.services),
            service_description: getServiceDescription(facility.services),
            address: [facility.street1, facility.street2].filter(Boolean).join(', '),
            city: facility.city,
            state: facility.state,
            zip: facility.zip,
            phone: facility.phone,
            email: null,
            website: facility.website,
            hours: null,
            qualifier_geography: null,
            qualifier_age: getQualifier(facility.services, 'AGE'),
            qualifier_income: getQualifier(facility.services, 'PAY'),
            qualifier_cohort: getQualifier(facility.services, 'SG'),
            qualifier_misc: null,
            required_documents: null,
            tips_tricks: null,
            notes: null,
            languages: [],
            point_of_contact: null,
            source: 'SAMHSA',
            distance_miles: facility.miles,
            latitude: facility.latitude,
            longitude: facility.longitude,
            services_raw: facility.services,
        }));
    } catch (err) {
        console.error('SAMHSA search error:', err);
        return [];
    }
}

// ============================================================================
// Helpers
// ============================================================================
const TREATMENT_KEYWORDS = [
    'treatment', 'mental health', 'substance', 'addiction', 'detox', 'rehab',
    'therapy', 'counseling', 'mat', 'suboxone', 'methadone', 'recovery', 'crisis',
];

function shouldIncludeSAMHSA(source: string, category: string, query: string): boolean {
    if (source === 'samhsa') return true;
    if (['Health', 'Mental Health', 'Substance Use Treatment'].includes(category)) return true;
    const q = query.toLowerCase();
    if (TREATMENT_KEYWORDS.some(kw => q.includes(kw))) return true;
    if (query === '' && category === 'all') return true;    // General browse includes SAMHSA
    return false;
}

/** Map raw DB rows into the shape the frontend expects (source: 'Local'). */
function normalizeLocal(rows: any[]): any[] {
    return rows.map(r => ({ ...r, source: 'Local' }));
}

// ============================================================================
// GET — search, categories, or by-category fetch
// ============================================================================
export async function GET(request: NextRequest) {
    try {
        await requireAuth();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const query       = sp.get('q')           || '';
    const category    = sp.get('category')    || 'all';
    const subcategory = sp.get('subcategory') || undefined;
    const zip         = sp.get('zip')         || undefined;
    const language    = sp.get('language')    || undefined;
    const source      = sp.get('source')      || 'all';
    const action      = sp.get('action')      || 'search';
    const lat         = parseFloat(sp.get('lat')    || String(LOUISVILLE_LAT));
    const lng         = parseFloat(sp.get('lng')    || String(LOUISVILLE_LNG));
    const radius      = parseInt(  sp.get('radius') || '50');

    try {
        // Categories listing
        if (action === 'categories') {
            const categories = await getCategories();
            return NextResponse.json({ categories });
        }

        // All resources in a single category
        if (action === 'by-category' && category !== 'all') {
            const rows = await searchResources({ category, limit: 1000 });
            return NextResponse.json({
                resources: normalizeLocal(rows as any[]),
                total: rows.length,
                category,
            });
        }

        // Default: combined search
        let local: any[] = [];
        let samhsa: any[] = [];

        if (source === 'all' || source === 'local') {
            const rows = await searchResources({ query, category, subcategory, zip, language, limit: 1000 });
            local = normalizeLocal(rows as any[]);
        }

        if ((source === 'all' || source === 'samhsa') && shouldIncludeSAMHSA(source, category, query)) {
            samhsa = await searchSAMHSA(query, lat, lng, radius);
        }

        // Local first, then alphabetical by org name
        const all = [...local, ...samhsa].sort((a, b) => {
            if (a.source === 'Local' && b.source !== 'Local') return -1;
            if (a.source !== 'Local' && b.source === 'Local') return 1;
            return (a.organization_name || '').localeCompare(b.organization_name || '');
        });

        return NextResponse.json({
            resources: all,
            total: all.length,
            localCount: local.length,
            samhsaCount: samhsa.length,
            query,
            category,
        });
    } catch (err) {
        console.error('Resource search error:', err);
        return NextResponse.json({ error: 'Failed to search resources' }, { status: 500 });
    }
}

// ============================================================================
// POST — same behaviour as GET but accepts a richer body (filters object, etc.)
// ============================================================================
export async function POST(request: NextRequest) {
    try {
        await requireAuth();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            query = '',
            category = 'all',
            subcategory,
            filters = {},
            lat = LOUISVILLE_LAT,
            lng = LOUISVILLE_LNG,
            radius = 50,
            source = 'all',
        } = body;

        let local: any[] = [];
        if (source === 'all' || source === 'local') {
            const rows = await searchResources({
                query,
                category,
                subcategory,
                zip: filters.zipCode,
                language: filters.language,
                limit: filters.limit ?? 1000,
            });
            local = normalizeLocal(rows as any[]);
        }

        let samhsa: any[] = [];
        if ((source === 'all' || source === 'samhsa') && shouldIncludeSAMHSA(source, category, query)) {
            samhsa = await searchSAMHSA(query, lat, lng, radius);
        }

        const all = [...local, ...samhsa];
        return NextResponse.json({
            resources: all,
            total: all.length,
            localCount: local.length,
            samhsaCount: samhsa.length,
        });
    } catch (err) {
        console.error('Resource search error:', err);
        return NextResponse.json({ error: 'Failed to search resources' }, { status: 500 });
    }
}
