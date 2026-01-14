import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Louisville coordinates
const LOUISVILLE_LAT = 38.2527;
const LOUISVILLE_LNG = -85.7585;

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

interface LocalResource {
    id: string;
    organization_name: string;
    program_name: string | null;
    category: string;
    subcategory: string | null;
    service_description: string | null;
    address: string | null;
    city: string;
    state: string;
    zip: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    hours: string | null;
    qualifier_geography: string | null;
    qualifier_age: string | null;
    qualifier_income: string | null;
    qualifier_cohort: string | null;
    qualifier_misc: string | null;
    required_documents: string | null;
    tips_tricks: string | null;
    notes: string | null;
    point_of_contact: string | null;
    source: string;
}

// Search SAMHSA API for treatment facilities
async function searchSAMHSA(query: string, lat: number, lng: number, radiusMiles: number = 50): Promise<any[]> {
    try {
        // Convert miles to meters (1 mile = 1609.34 meters)
        const radiusMeters = radiusMiles * 1609.34;
        
        // Determine service type based on query
        let sType = 'both'; // substance abuse and mental health
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('mental health') || lowerQuery.includes('counseling') || lowerQuery.includes('therapy')) {
            sType = 'mh';
        } else if (lowerQuery.includes('substance') || lowerQuery.includes('addiction') || lowerQuery.includes('detox') || lowerQuery.includes('mat') || lowerQuery.includes('suboxone')) {
            sType = 'sa';
        }

        const url = `https://findtreatment.gov/locator/exportsAsJson/v2?sAddr=${lat},${lng}&limitType=2&limitValue=${radiusMeters}&sType=${sType}&pageSize=50&page=1&sort=0`;
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            console.error('SAMHSA API error:', response.status);
            return [];
        }

        const data = await response.json();
        
        // Transform SAMHSA data to match our format
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
            point_of_contact: null,
            source: 'SAMHSA',
            distance_miles: facility.miles,
            latitude: facility.latitude,
            longitude: facility.longitude,
            services_raw: facility.services
        }));
    } catch (error) {
        console.error('SAMHSA search error:', error);
        return [];
    }
}

function getServiceTypes(services: Array<{ f1: string; f2: string; f3: string }>): string {
    const setting = services.find(s => s.f2 === 'SET');
    return setting?.f3 || '';
}

function getServiceDescription(services: Array<{ f1: string; f2: string; f3: string }>): string {
    const typeOfCare = services.find(s => s.f2 === 'TC');
    const setting = services.find(s => s.f2 === 'SET');
    const parts = [typeOfCare?.f3, setting?.f3].filter(Boolean);
    return parts.join('. ') || 'Treatment services available';
}

function getQualifier(services: Array<{ f1: string; f2: string; f3: string }>, code: string): string | null {
    const service = services.find(s => s.f2 === code);
    return service?.f3 || null;
}

// Search local resources in Supabase
async function searchLocalResources(query: string, category?: string, limit: number = 50): Promise<LocalResource[]> {
    try {
        let queryBuilder = supabase
            .from('local_resources')
            .select('*')
            .eq('is_active', true);

        // Category filter
        if (category && category !== 'all') {
            queryBuilder = queryBuilder.eq('category', category);
        }

        // Text search if query provided
        if (query && query.trim()) {
            // Use full-text search
            queryBuilder = queryBuilder.or(
                `organization_name.ilike.%${query}%,` +
                `program_name.ilike.%${query}%,` +
                `service_description.ilike.%${query}%,` +
                `category.ilike.%${query}%,` +
                `subcategory.ilike.%${query}%`
            );
        }

        const { data, error } = await queryBuilder.limit(limit);

        if (error) {
            console.error('Local search error:', error);
            return [];
        }

        return (data || []).map(r => ({ ...r, source: r.source || 'Local' }));
    } catch (error) {
        console.error('Local search error:', error);
        return [];
    }
}

// Get all categories
async function getCategories() {
    try {
        const { data, error } = await supabase
            .from('resource_categories')
            .select('*')
            .eq('is_active', true)
            .order('display_order');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Categories fetch error:', error);
        return [];
    }
}

// Get resources by category
async function getResourcesByCategory(category: string) {
    try {
        const { data, error } = await supabase
            .from('local_resources')
            .select('*')
            .eq('category', category)
            .eq('is_active', true)
            .order('organization_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Category resources error:', error);
        return [];
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'all';
    const source = searchParams.get('source') || 'all'; // 'local', 'samhsa', 'all'
    const action = searchParams.get('action') || 'search'; // 'search', 'categories', 'by-category'
    const lat = parseFloat(searchParams.get('lat') || String(LOUISVILLE_LAT));
    const lng = parseFloat(searchParams.get('lng') || String(LOUISVILLE_LNG));
    const radius = parseInt(searchParams.get('radius') || '50');

    try {
        // Get categories
        if (action === 'categories') {
            const categories = await getCategories();
            return NextResponse.json({ categories });
        }

        // Get resources by specific category
        if (action === 'by-category' && category !== 'all') {
            const resources = await getResourcesByCategory(category);
            return NextResponse.json({ 
                resources,
                total: resources.length,
                category 
            });
        }

        // Combined search
        let localResults: any[] = [];
        let samhsaResults: any[] = [];

        // Search local resources
        if (source === 'all' || source === 'local') {
            localResults = await searchLocalResources(query, category);
        }

        // Search SAMHSA for treatment-related queries
        if (source === 'all' || source === 'samhsa') {
            const treatmentKeywords = ['treatment', 'mental health', 'substance', 'addiction', 'detox', 'rehab', 'therapy', 'counseling', 'mat', 'suboxone', 'methadone', 'recovery', 'crisis'];
            const shouldSearchSAMHSA = 
                source === 'samhsa' || 
                category === 'Health' ||
                category === 'Mental Health' ||
                category === 'Substance Use Treatment' ||
                treatmentKeywords.some(kw => query.toLowerCase().includes(kw)) ||
                (query === '' && category === 'all'); // Include SAMHSA in general browse

            if (shouldSearchSAMHSA) {
                samhsaResults = await searchSAMHSA(query, lat, lng, radius);
            }
        }

        // Combine and deduplicate results
        const allResults = [...localResults, ...samhsaResults];
        
        // Sort: local first, then by name
        allResults.sort((a, b) => {
            if (a.source === 'Local' && b.source !== 'Local') return -1;
            if (a.source !== 'Local' && b.source === 'Local') return 1;
            return (a.organization_name || '').localeCompare(b.organization_name || '');
        });

        return NextResponse.json({
            resources: allResults,
            total: allResults.length,
            localCount: localResults.length,
            samhsaCount: samhsaResults.length,
            query,
            category
        });

    } catch (error) {
        console.error('Resource search error:', error);
        return NextResponse.json(
            { error: 'Failed to search resources' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    // For more complex searches with body params
    try {
        const body = await request.json();
        const { query, category, filters, lat, lng, radius } = body;

        const localResults = await searchLocalResources(
            query || '', 
            category || 'all'
        );

        let samhsaResults: any[] = [];
        if (!category || category === 'all' || category === 'Health') {
            samhsaResults = await searchSAMHSA(
                query || '',
                lat || LOUISVILLE_LAT,
                lng || LOUISVILLE_LNG,
                radius || 50
            );
        }

        // Apply additional filters if provided
        let results = [...localResults, ...samhsaResults];

        if (filters?.zipCode) {
            results = results.filter(r => r.zip?.startsWith(filters.zipCode));
        }

        return NextResponse.json({
            resources: results,
            total: results.length
        });

    } catch (error) {
        console.error('Resource search error:', error);
        return NextResponse.json(
            { error: 'Failed to search resources' },
            { status: 500 }
        );
    }
}
