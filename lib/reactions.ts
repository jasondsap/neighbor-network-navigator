/**
 * lib/reactions.ts
 *
 * Message reaction grouping — shared by the channel messages GET (bulk) and the
 * reaction toggle route (single message) so both return the same shape.
 *
 * Ported from the DDOR platform.
 */

export interface ReactionRow {
    message_id: string;
    emoji: string;
    user_id: string;
    user_name: string;
}

export interface ReactionGroup {
    emoji: string;
    count: number;
    /** Did the current user add this reaction (click again to remove)? */
    mine: boolean;
    /** Reactor names for the hover tooltip. */
    users: string[];
}

/** Group raw rows into per-message reaction pills, most popular first. */
export function groupReactions(
    rows: ReactionRow[],
    currentUserId: string
): Record<string, ReactionGroup[]> {
    const byMessage: Record<string, Map<string, ReactionGroup>> = {};
    for (const r of rows) {
        const msg = (byMessage[r.message_id] ||= new Map());
        const g = msg.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false, users: [] };
        g.count++;
        g.users.push(r.user_name);
        if (r.user_id === currentUserId) g.mine = true;
        msg.set(r.emoji, g);
    }
    const out: Record<string, ReactionGroup[]> = {};
    for (const [messageId, groups] of Object.entries(byMessage)) {
        out[messageId] = Array.from(groups.values()).sort((a, b) => b.count - a.count);
    }
    return out;
}
