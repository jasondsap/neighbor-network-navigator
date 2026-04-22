/**
 * lib/access-reports.ts
 *
 * Canonical definitions for access report fields. All multi-select options,
 * single-select options, and statuses live here so the user modal and the
 * admin queue agree on vocabulary.
 *
 * Stored shape (in Postgres):
 *   barriers:         JSONB array of barrier codes (string[])
 *   attempt_methods:  JSONB array of method codes   (string[])
 *   improvements:     JSONB array of improvement codes (string[])
 *   other scalars:    plain columns
 */

// ============================================================================
// Q1 — What happened (multi-select)
// ============================================================================
export const BARRIER_OPTIONS = [
    { value: 'unreachable',       label: 'Unable to reach program staff (no response, voicemail, email bounce)' },
    { value: 'not_accepting',     label: 'Program is not currently accepting applications' },
    { value: 'waitlist',          label: 'There is a waitlist' },
    { value: 'ineligible',        label: 'Client was determined ineligible' },
    { value: 'unclear_eligibility', label: 'Eligibility requirements were unclear or inconsistent' },
    { value: 'complex_process',   label: 'Application process was too complex or burdensome' },
    { value: 'documentation',     label: 'Required documentation was a barrier' },
    { value: 'logistics',         label: 'Transportation, location, or hours created a barrier' },
    { value: 'referred_away',     label: 'Referred to another program' },
    { value: 'inaccurate_info',   label: 'Information listed here was inaccurate or outdated' },
    { value: 'other',             label: 'Other' },
] as const;

export type BarrierValue = typeof BARRIER_OPTIONS[number]['value'];
const BARRIER_SET = new Set(BARRIER_OPTIONS.map(b => b.value));

export function barrierLabel(value: string): string {
    return BARRIER_OPTIONS.find(b => b.value === value)?.label ?? value;
}

// ============================================================================
// Q3 — How access was attempted (multi-select)
// ============================================================================
export const ATTEMPT_METHODS = [
    { value: 'phone',       label: 'Phone call' },
    { value: 'online',      label: 'Online application or website' },
    { value: 'email',       label: 'Email' },
    { value: 'in_person',   label: 'In-person visit' },
    { value: 'warm_referral', label: 'Warm referral (direct connection from provider)' },
    { value: 'cold_referral', label: 'Cold referral (information provided to client)' },
] as const;

export type AttemptMethodValue = typeof ATTEMPT_METHODS[number]['value'];
const METHOD_SET = new Set(ATTEMPT_METHODS.map(m => m.value));

export function attemptMethodLabel(value: string): string {
    return ATTEMPT_METHODS.find(m => m.value === value)?.label ?? value;
}

// ============================================================================
// Q4 — Number of attempts (single-select)
// ============================================================================
export const ATTEMPT_COUNT_OPTIONS = [
    { value: '1',       label: '1 attempt' },
    { value: '2-3',     label: '2\u20133 attempts' },
    { value: '4+',      label: '4+ attempts' },
    { value: 'ongoing', label: 'Ongoing attempts' },
] as const;

const ATTEMPT_COUNT_SET = new Set(ATTEMPT_COUNT_OPTIONS.map(o => o.value));

export function attemptCountLabel(value: string): string {
    return ATTEMPT_COUNT_OPTIONS.find(o => o.value === value)?.label ?? value;
}

// ============================================================================
// Q5 — Final outcome (single-select)
// ============================================================================
export const FINAL_OUTCOMES = [
    { value: 'not_accessed', label: 'Client did not access the resource' },
    { value: 'in_process',   label: 'Client is still in process' },
    { value: 'redirected',   label: 'Client was redirected to another resource' },
    { value: 'unknown',      label: 'Outcome unknown' },
] as const;

const OUTCOME_SET = new Set(FINAL_OUTCOMES.map(o => o.value));

export function finalOutcomeLabel(value: string): string {
    return FINAL_OUTCOMES.find(o => o.value === value)?.label ?? value;
}

// ============================================================================
// Q6 — What would have helped (multi-select)
// ============================================================================
export const IMPROVEMENT_OPTIONS = [
    { value: 'direct_contact',     label: 'Direct contact information for program staff' },
    { value: 'clear_eligibility',  label: 'Clear, up-to-date eligibility criteria' },
    { value: 'realtime_capacity',  label: 'Real-time updates on availability or capacity' },
    { value: 'simpler_process',    label: 'Streamlined or simplified application process' },
    { value: 'doc_help',           label: 'Assistance with documentation requirements' },
    { value: 'warm_referral',      label: 'Ability to make a direct/warm referral' },
    { value: 'responsive_program', label: 'More responsive communication from program' },
    { value: 'alternatives',       label: 'Alternative resources with similar services' },
    { value: 'followups',          label: 'Follow-up or status updates after referral' },
    { value: 'other',              label: 'Other' },
] as const;

export type ImprovementValue = typeof IMPROVEMENT_OPTIONS[number]['value'];
const IMPROVEMENT_SET = new Set(IMPROVEMENT_OPTIONS.map(i => i.value));

export function improvementLabel(value: string): string {
    return IMPROVEMENT_OPTIONS.find(i => i.value === value)?.label ?? value;
}

// ============================================================================
// Q2 / Q7 — small single-selects
// ============================================================================
export const YES_NO_UNSURE = [
    { value: 'yes',    label: 'Yes' },
    { value: 'no',     label: 'No' },
    { value: 'unsure', label: 'Unsure' },
] as const;

export const YES_NO_UNKNOWN = [
    { value: 'yes',     label: 'Yes' },
    { value: 'no',      label: 'No' },
    { value: 'unknown', label: 'Unknown' },
] as const;

// ============================================================================
// Admin workflow statuses
// ============================================================================
export const ACCESS_REPORT_STATUSES = [
    { value: 'open',      label: 'Open',      color: '#E8B84A' },
    { value: 'reviewed',  label: 'Reviewed',  color: '#2E4A8E' },
    { value: 'addressed', label: 'Addressed', color: '#30B27A' },
    { value: 'archived',  label: 'Archived',  color: '#6B7280' },
] as const;

export type AccessReportStatus = typeof ACCESS_REPORT_STATUSES[number]['value'];
const STATUS_SET = new Set(ACCESS_REPORT_STATUSES.map(s => s.value));

export function isValidAccessStatus(v: unknown): v is AccessReportStatus {
    return typeof v === 'string' && STATUS_SET.has(v as AccessReportStatus);
}

export function accessStatusLabel(value: string): string {
    return ACCESS_REPORT_STATUSES.find(s => s.value === value)?.label ?? value;
}

export function accessStatusColor(value: string): string {
    return ACCESS_REPORT_STATUSES.find(s => s.value === value)?.color ?? '#6B7280';
}

// ============================================================================
// Submission validation
// ============================================================================

export interface AccessReportSubmission {
    resource_id: string;
    barriers: string[];
    barriers_other: string | null;
    waitlist_time_given: boolean | null;
    waitlist_estimate: string | null;
    waitlist_client_added: string | null;
    attempt_methods: string[];
    attempt_count: string | null;
    final_outcome: string | null;
    improvements: string[];
    improvements_other: string | null;
    similar_accessed: string | null;
    similar_where: string | null;
    additional_notes: string | null;
}

export interface FieldError {
    field: string;
    message: string;
}

/** Filter array entries to only known codes. */
function sanitizeCodes(raw: unknown, allowed: Set<string>): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(v => typeof v === 'string' && allowed.has(v))
        .map(v => v as string);
}

function cleanText(raw: unknown, max = 2000): string | null {
    if (typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    return s.length > max ? s.slice(0, max) : s;
}

export function validateAccessReportSubmission(
    raw: Record<string, unknown>
): { data: AccessReportSubmission | null; errors: FieldError[] } {
    const errors: FieldError[] = [];

    const resource_id = typeof raw.resource_id === 'string' ? raw.resource_id.trim() : '';
    if (!resource_id) errors.push({ field: 'resource_id', message: 'Resource is required' });

    const barriers = sanitizeCodes(raw.barriers, BARRIER_SET);
    if (barriers.length === 0) {
        errors.push({ field: 'barriers', message: 'Please select at least one issue you ran into' });
    }

    const methods = sanitizeCodes(raw.attempt_methods, METHOD_SET);
    const improvements = sanitizeCodes(raw.improvements, IMPROVEMENT_SET);

    // Optional scalar fields — tolerate unknown values by coercing to null
    const attempt_count = typeof raw.attempt_count === 'string' && ATTEMPT_COUNT_SET.has(raw.attempt_count)
        ? raw.attempt_count : null;
    const final_outcome = typeof raw.final_outcome === 'string' && OUTCOME_SET.has(raw.final_outcome)
        ? raw.final_outcome : null;

    const waitlist_time_given = typeof raw.waitlist_time_given === 'boolean'
        ? raw.waitlist_time_given
        : null;
    const waitlist_client_added = typeof raw.waitlist_client_added === 'string'
        && ['yes','no','unsure'].includes(raw.waitlist_client_added)
        ? raw.waitlist_client_added : null;

    const similar_accessed = typeof raw.similar_accessed === 'string'
        && ['yes','no','unknown'].includes(raw.similar_accessed)
        ? raw.similar_accessed : null;

    if (errors.length) return { data: null, errors };

    return {
        data: {
            resource_id,
            barriers,
            barriers_other:     cleanText(raw.barriers_other),
            waitlist_time_given,
            waitlist_estimate:  cleanText(raw.waitlist_estimate, 200),
            waitlist_client_added,
            attempt_methods:    methods,
            attempt_count,
            final_outcome,
            improvements,
            improvements_other: cleanText(raw.improvements_other),
            similar_accessed,
            similar_where:      cleanText(raw.similar_where, 500),
            additional_notes:   cleanText(raw.additional_notes, 4000),
        },
        errors: [],
    };
}

export function validateAdminNote(
    raw: unknown
): { value: string | null; error: string | null } {
    if (raw === null || raw === undefined) {
        return { value: null, error: 'A note is required' };
    }
    const s = String(raw).trim();
    if (s.length === 0) return { value: null, error: 'A note is required' };
    if (s.length < 3)   return { value: null, error: 'Note is too short (at least 3 characters)' };
    if (s.length > 2000) return { value: null, error: 'Note is too long (max 2000 characters)' };
    return { value: s, error: null };
}
