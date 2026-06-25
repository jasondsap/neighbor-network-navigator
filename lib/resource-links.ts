/**
 * lib/resource-links.ts
 *
 * Canonical vocabulary + validation for resource_links — the structured
 * hyperlinks pulled out of the SLCM spreadsheets (Tips/Tricks forms,
 * income-guideline PDFs, application links, etc.).
 *
 * Shared by the admin links API (/api/admin/resources/[id]/links/*) and the
 * admin LinksEditor component so labels/options/validation stay in one place.
 */

/**
 * The spreadsheet "Source Column" a link came from. Kept verbatim from the
 * sheets so existing rows match; `label` is what curators and navigators see.
 */
export const LINK_SOURCE_FIELDS: { value: string; label: string }[] = [
    { value: 'Program/Org Website',   label: 'Website' },
    { value: 'Tips/Tricks',           label: 'How to apply' },
    { value: 'Required Documents',    label: 'Documents / forms' },
    { value: 'Qualifier - Income',    label: 'Income guidelines' },
    { value: 'Qualifier - Geography', label: 'Service area' },
    { value: 'Qualifier - Cohort',    label: 'Eligibility' },
    { value: 'Qualifier - Misc',      label: 'Eligibility (other)' },
    { value: 'Service Description',   label: 'More info' },
    { value: 'Notes',                 label: 'More info (notes)' },
    { value: 'Address(es)',           label: 'Locations' },
    { value: 'Email(s)',              label: 'Email / contact' },
    { value: 'Phone #(s)',            label: 'Phone / contact' },
    { value: 'Hours',                 label: 'Hours' },
    { value: 'Other',                 label: 'Other' },
];

const VALID_FIELDS = new Set(LINK_SOURCE_FIELDS.map(f => f.value));

export interface ResourceLinkInput {
    source_field: string;
    link_text: string | null;
    url: string;
    sort_order: number;
}

export interface LinkValidationError {
    field: string;
    message: string;
}

function clean(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

/**
 * Validate + normalize a link payload from the admin UI.
 * URL is required; we accept http(s)://, mailto:, or a bare domain
 * (bare domains are left as-is — the UI prepends https:// when rendering).
 */
export function normalizeLinkInput(
    raw: Record<string, unknown>
): { data: ResourceLinkInput; errors: LinkValidationError[] } {
    const errors: LinkValidationError[] = [];

    const source_field = clean(raw.source_field) || 'Other';
    if (!VALID_FIELDS.has(source_field)) {
        errors.push({ field: 'source_field', message: 'Unknown link category' });
    }

    const url = clean(raw.url);
    if (!url) {
        errors.push({ field: 'url', message: 'URL is required' });
    } else if (url.length > 2000) {
        errors.push({ field: 'url', message: 'URL is too long (max 2000)' });
    } else if (/\s/.test(url)) {
        errors.push({ field: 'url', message: 'URL must not contain spaces' });
    } else if (!/^(https?:\/\/|mailto:|[a-z0-9-]+\.[a-z]{2,})/i.test(url)) {
        errors.push({ field: 'url', message: 'Enter a valid URL (https://…) or email link' });
    }

    const link_text = clean(raw.link_text);
    if (link_text && link_text.length > 2000) {
        errors.push({ field: 'link_text', message: 'Link text is too long (max 2000)' });
    }

    const rawSort = raw.sort_order;
    const sort_order =
        rawSort === null || rawSort === undefined || rawSort === '' ? 0 : Number(rawSort);
    if (Number.isNaN(sort_order)) {
        errors.push({ field: 'sort_order', message: 'Sort order must be a number' });
    }

    return {
        data: { source_field, link_text, url: url || '', sort_order: Number.isNaN(sort_order) ? 0 : sort_order },
        errors,
    };
}
