/**
 * lib/resource-admin.ts
 *
 * Server-side helpers for admin resource operations:
 *   - setEditorContext() — tells the Postgres trigger who's editing and why
 *   - validateResourceInput() — shape-checks payloads coming from the admin UI
 *
 * Used by /api/admin/resources/* routes.
 */

import { sql } from './db';

// ============================================================================
// Editor context for the Postgres versioning trigger
// ============================================================================

/**
 * Sets transaction-local session vars that fn_snapshot_resource() reads
 * to stamp the version row with editor_id, summary, and edit_kind.
 *
 * Must be called IN THE SAME TRANSACTION as the UPDATE. With Neon serverless
 * this means we wrap both calls in a single sql.transaction([...]) block —
 * see the resources PUT route for the pattern.
 *
 * Because Neon serverless doesn't support traditional BEGIN/COMMIT blocks
 * across multiple awaits, we instead use set_config(..., true) where `true`
 * means "transaction-scoped, expires at commit." Coupled with sending both
 * statements in one transaction batch, the trigger sees our values.
 */
export function buildEditorContextStatements(
    editorId: string,
    editSummary: string,
    editKind: 'update' | 'archive' | 'restore' | 'rollback' = 'update'
) {
    // sql.transaction() in Neon accepts an array of queries built with sql``
    return [
        sql`SELECT set_config('app.editor_id',    ${editorId},   true)`,
        sql`SELECT set_config('app.edit_summary', ${editSummary}, true)`,
        sql`SELECT set_config('app.edit_kind',    ${editKind},    true)`,
    ];
}

// ============================================================================
// Input validation — catches empty / malformed payloads before they hit the DB
// ============================================================================

export interface ResourceInput {
    organization_name:   string;                    // required
    program_name?:       string | null;
    category:            string;                    // required
    subcategory?:        string | null;
    service_type?:       string | null;
    service_description?: string | null;
    capacity?:           string | null;
    last_updated_at?:    string | null;             // ISO date
    address?:            string | null;
    city?:               string | null;
    state?:              string | null;
    zip?:                string | null;
    latitude?:           number | null;
    longitude?:          number | null;
    phone?:              string | null;
    email?:              string | null;
    website?:            string | null;
    hours?:              string | null;
    point_of_contact?:   string | null;
    qualifier_geography?: string | null;
    qualifier_age?:      string | null;
    qualifier_income?:   string | null;
    qualifier_cohort?:   string | null;
    qualifier_misc?:     string | null;
    required_documents?: string | null;
    tips_tricks?:        string | null;
    notes?:              string | null;
    is_active?:          boolean;
}

export interface ValidationError {
    field: string;
    message: string;
}

/** Trim strings and coerce empty strings → null, so "" and whitespace don't leak in. */
function clean(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

export function normalizeResourceInput(
    raw: Record<string, unknown>
): { data: ResourceInput; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    const organization_name = clean(raw.organization_name);
    if (!organization_name) {
        errors.push({ field: 'organization_name', message: 'Organization name is required' });
    } else if (organization_name.length > 500) {
        errors.push({ field: 'organization_name', message: 'Organization name is too long (max 500)' });
    }

    const category = clean(raw.category);
    if (!category) {
        errors.push({ field: 'category', message: 'Category is required' });
    }

    // Email validation — intentionally lenient (some rows have "email1; email2")
    const email = clean(raw.email);
    if (email && email.length > 0 && !email.includes('@')) {
        errors.push({ field: 'email', message: 'Email looks malformed' });
    }

    const lat = raw.latitude === null || raw.latitude === undefined || raw.latitude === ''
        ? null
        : Number(raw.latitude);
    if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
        errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90' });
    }

    const lng = raw.longitude === null || raw.longitude === undefined || raw.longitude === ''
        ? null
        : Number(raw.longitude);
    if (lng !== null && (isNaN(lng) || lng < -180 || lng > 180)) {
        errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180' });
    }

    const data: ResourceInput = {
        organization_name: organization_name || '',
        program_name: clean(raw.program_name),
        category: category || '',
        subcategory: clean(raw.subcategory),
        service_type: clean(raw.service_type),
        service_description: clean(raw.service_description),
        capacity: clean(raw.capacity),
        last_updated_at: clean(raw.last_updated_at),
        address: clean(raw.address),
        city: clean(raw.city) || 'Louisville',
        state: clean(raw.state) || 'KY',
        zip: clean(raw.zip),
        latitude: lat,
        longitude: lng,
        phone: clean(raw.phone),
        email,
        website: clean(raw.website),
        hours: clean(raw.hours),
        point_of_contact: clean(raw.point_of_contact),
        qualifier_geography: clean(raw.qualifier_geography),
        qualifier_age: clean(raw.qualifier_age),
        qualifier_income: clean(raw.qualifier_income),
        qualifier_cohort: clean(raw.qualifier_cohort),
        qualifier_misc: clean(raw.qualifier_misc),
        required_documents: clean(raw.required_documents),
        tips_tricks: clean(raw.tips_tricks),
        notes: clean(raw.notes),
        is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    };

    return { data, errors };
}

/** Ensures the edit summary is present and reasonable. */
export function validateEditSummary(
    raw: unknown
): { value: string | null; error: string | null } {
    if (raw === null || raw === undefined) {
        return { value: null, error: 'Edit summary is required' };
    }
    const s = String(raw).trim();
    if (s.length === 0) {
        return { value: null, error: 'Edit summary is required' };
    }
    if (s.length < 3) {
        return { value: null, error: 'Edit summary is too short (at least 3 characters)' };
    }
    if (s.length > 500) {
        return { value: null, error: 'Edit summary is too long (max 500 characters)' };
    }
    return { value: s, error: null };
}
