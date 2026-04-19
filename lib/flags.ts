/**
 * lib/flags.ts
 *
 * Canonical definitions for flag categories, statuses, and validation.
 * Imported by:
 *   - user-facing flag modal (labels + dropdown options)
 *   - POST /api/flags (validates incoming category)
 *   - admin triage pages (filter + display labels)
 */

// ============================================================================
// Categories
// ============================================================================

export const FLAG_CATEGORIES = [
    { value: 'phone',        label: 'Wrong phone number' },
    { value: 'address',      label: 'Wrong address or location' },
    { value: 'hours',        label: 'Wrong hours' },
    { value: 'closed',       label: 'No longer operating / permanently closed' },
    { value: 'eligibility',  label: 'Eligibility info is wrong' },
    { value: 'services',     label: 'Service description is inaccurate' },
    { value: 'web_email',    label: 'Broken website or email' },
    { value: 'other',        label: 'Something else' },
] as const;

export type FlagCategoryValue = typeof FLAG_CATEGORIES[number]['value'];

const VALID_CATEGORIES = new Set(FLAG_CATEGORIES.map(c => c.value));

export function isValidCategory(v: unknown): v is FlagCategoryValue {
    return typeof v === 'string' && VALID_CATEGORIES.has(v as FlagCategoryValue);
}

export function categoryLabel(value: string): string {
    return FLAG_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

// ============================================================================
// Statuses
// ============================================================================

export const FLAG_STATUSES = [
    { value: 'open',        label: 'Open',        color: '#E8B84A' },
    { value: 'in_progress', label: 'In progress', color: '#2E4A8E' },
    { value: 'resolved',    label: 'Resolved',    color: '#30B27A' },
    { value: 'dismissed',   label: 'Dismissed',   color: '#6B7280' },
] as const;

export type FlagStatusValue = typeof FLAG_STATUSES[number]['value'];

const VALID_STATUSES = new Set(FLAG_STATUSES.map(s => s.value));

export function isValidStatus(v: unknown): v is FlagStatusValue {
    return typeof v === 'string' && VALID_STATUSES.has(v as FlagStatusValue);
}

export function statusLabel(value: string): string {
    return FLAG_STATUSES.find(s => s.value === value)?.label ?? value;
}

export function statusColor(value: string): string {
    return FLAG_STATUSES.find(s => s.value === value)?.color ?? '#6B7280';
}

// "Pending" == needs admin attention; used for dashboard count.
export const PENDING_STATUSES: FlagStatusValue[] = ['open', 'in_progress'];

// ============================================================================
// Validation — used by POST /api/flags
// ============================================================================

export interface FlagSubmission {
    resource_id: string;
    category: FlagCategoryValue;
    description: string;
    suggested_correction: string | null;
}

export interface FlagValidationError {
    field: string;
    message: string;
}

export function validateFlagSubmission(
    raw: Record<string, unknown>
): { data: FlagSubmission | null; errors: FlagValidationError[] } {
    const errors: FlagValidationError[] = [];

    const resource_id = typeof raw.resource_id === 'string' ? raw.resource_id.trim() : '';
    if (!resource_id) {
        errors.push({ field: 'resource_id', message: 'Resource ID is required' });
    }

    if (!isValidCategory(raw.category)) {
        errors.push({ field: 'category', message: 'Please select a category' });
    }

    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    if (!description) {
        errors.push({ field: 'description', message: 'Please describe what\u2019s wrong' });
    } else if (description.length < 5) {
        errors.push({ field: 'description', message: 'Description is too short (at least 5 characters)' });
    } else if (description.length > 2000) {
        errors.push({ field: 'description', message: 'Description is too long (max 2000)' });
    }

    const correction = typeof raw.suggested_correction === 'string'
        ? raw.suggested_correction.trim()
        : '';
    if (correction.length > 2000) {
        errors.push({ field: 'suggested_correction', message: 'Suggested correction is too long (max 2000)' });
    }

    if (errors.length) return { data: null, errors };

    return {
        data: {
            resource_id,
            category: raw.category as FlagCategoryValue,
            description,
            suggested_correction: correction || null,
        },
        errors: [],
    };
}

// ============================================================================
// Resolution note validation — used by PATCH /api/admin/flags/[id]
// ============================================================================

export function validateResolutionNote(
    raw: unknown
): { value: string | null; error: string | null } {
    if (raw === null || raw === undefined) {
        return { value: null, error: 'A note is required' };
    }
    const s = String(raw).trim();
    if (s.length === 0) return { value: null, error: 'A note is required' };
    if (s.length < 3)   return { value: null, error: 'Note is too short (at least 3 characters)' };
    if (s.length > 2000) return { value: null, error: 'Note is too long (max 2000)' };
    return { value: s, error: null };
}
