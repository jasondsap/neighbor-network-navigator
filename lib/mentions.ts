/**
 * lib/mentions.ts
 *
 * Hand-rolled @-mention support for channel messages (ported from the DDOR
 * platform, adapted to mention RESOURCES instead of clients).
 *
 * Storage format inside a message body: @[Display Name](type:id)
 * Example:
 *   "Ask @[Erin Henle](user:abc-123) about @[Dare to Care](resource:xyz-789)"
 *
 * Two mention types:
 *   - user      → another app user (navigator/admin); creates a notification
 *   - resource  → a resource card; renders as a deep-link, notifies no one
 *
 * Used by both server (parse/preview) and client (format/render) — no
 * server-only imports here.
 */

export type MentionType = 'user' | 'resource';

export interface Mention {
    type: MentionType;
    name: string;
    id: string;
}

export interface MentionSuggestion {
    type: MentionType;
    name: string;
    id: string;
    subtitle?: string;
}

// @[Name](type:id) — name may contain anything except ']'; id anything except ')'.
const MENTION_REGEX = /@\[([^\]]+)\]\(([a-z_]+):([^)]+)\)/g;

const VALID_TYPES: ReadonlySet<string> = new Set<MentionType>(['user', 'resource']);

/** The token to embed in the body when a suggestion is chosen. */
export function formatMention(item: { type: MentionType; name: string; id: string }): string {
    return `@[${item.name}](${item.type}:${item.id})`;
}

/** Extract structured mentions from a body. Only whitelisted types are returned. */
export function parseMentions(body: string): Mention[] {
    const out: Mention[] = [];
    if (!body) return out;
    for (const m of body.matchAll(MENTION_REGEX)) {
        const [, name, type, id] = m;
        if (VALID_TYPES.has(type)) {
            out.push({ type: type as MentionType, name, id });
        }
    }
    return out;
}

/** Replace tokens with plain "@Name" (for previews / notification snippets). */
export function stripMentions(body: string): string {
    if (!body) return '';
    return body.replace(MENTION_REGEX, (_full, name) => `@${name}`);
}

/** ≤140-char plain-text preview with mentions stripped. */
export function toPreview(body: string): string {
    const plain = stripMentions(body).replace(/\s+/g, ' ').trim();
    return plain.length > 140 ? plain.slice(0, 139) + '…' : plain;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Render a body to safe HTML (caller uses dangerouslySetInnerHTML).
 * Escapes everything first, then turns tokens into links/spans.
 *   - resource → <a href="/?resource={id}"> (opens the resource modal on the home page)
 *   - user     → <span> (no per-user profile page)
 */
export function renderMentions(body: string): string {
    if (!body) return '';
    const safe = escapeHtml(body);
    return safe.replace(MENTION_REGEX, (_full, name: string, type: string, id: string) => {
        const safeName = escapeHtml(String(name));
        const safeId = encodeURIComponent(String(id));
        if (type === 'resource') {
            return `<a href="/?resource=${safeId}" style="color:#2E4A8E;font-weight:600;text-decoration:none;">@${safeName}</a>`;
        }
        if (type === 'user') {
            return `<span style="color:#2A8B8B;font-weight:600;">@${safeName}</span>`;
        }
        return `@${safeName}`;
    });
}
