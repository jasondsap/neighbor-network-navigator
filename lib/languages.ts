/**
 * lib/languages.ts
 *
 * Canonical vocabulary for the resources.languages column (text[]).
 * Shared by the admin ResourceForm (checkboxes), the navigator search
 * filter, and server-side validation in lib/resource-admin.ts — add or
 * rename options here and all three stay in sync.
 *
 * Client-safe: no server-only imports (this is loaded into client bundles).
 */

// Ordered roughly by how often navigators encounter them in Louisville;
// display order everywhere follows this list.
export const LANGUAGE_OPTIONS: readonly string[] = [
    'Spanish',
    'Arabic',
    'Somali',
    'Swahili',
    'Kinyarwanda',
    'French',
    'Nepali',
    'Vietnamese',
    'Mandarin',
    'Dari',
    'Pashto',
    'Russian',
    'Ukrainian',
    'Haitian Creole',
    'ASL',
    'Interpretation services available',
];

/**
 * Normalize a raw `languages` payload into a clean string[]:
 * trims, drops empties, dedupes, and re-sorts into canonical order.
 * Unknown values are a validation error (the vocabulary is controlled
 * so the search filter stays reliable).
 */
export function normalizeLanguages(
    raw: unknown
): { value: string[]; error: string | null } {
    if (raw === null || raw === undefined) return { value: [], error: null };
    if (!Array.isArray(raw)) {
        return { value: [], error: 'Languages must be a list' };
    }

    const out: string[] = [];
    for (const item of raw) {
        const s = String(item).trim();
        if (!s) continue;
        if (!LANGUAGE_OPTIONS.includes(s)) {
            return { value: [], error: `Unknown language option: ${s}` };
        }
        if (!out.includes(s)) out.push(s);
    }

    out.sort((a, b) => LANGUAGE_OPTIONS.indexOf(a) - LANGUAGE_OPTIONS.indexOf(b));
    return { value: out, error: null };
}
