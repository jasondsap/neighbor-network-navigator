/**
 * lib/emoji.ts
 *
 * Emoji vocabulary for Messages — code-as-config (no admin UI needed for a
 * fixed reaction set). Client-safe pure module; the reactions API validates
 * against ALL_EMOJIS so the stored vocabulary stays controlled.
 *
 * Ported from the DDOR platform.
 */

/** Quick reactions shown on message hover, most-used first. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Picker groups for inline emoji insertion in the composer. */
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
    {
        label: 'Smileys',
        emojis: ['😀', '😄', '😁', '😊', '🙂', '😉', '😍', '😘', '😎', '🤗', '🤔', '😅', '😂', '🤣', '😮', '😯', '😢', '😭', '😡', '😴', '🤒', '🥳', '😇', '🙃'],
    },
    {
        label: 'Gestures',
        emojis: ['👍', '👎', '👏', '🙌', '🙏', '👌', '✌️', '🤝', '💪', '👋', '🤞', '✋'],
    },
    {
        label: 'Hearts & celebration',
        emojis: ['❤️', '💕', '💙', '💚', '💛', '🧡', '💜', '💔', '🎉', '🎊', '🎂', '⭐', '✨', '🔥', '💯', '🏆'],
    },
    {
        label: 'Objects',
        emojis: ['📞', '📧', '📅', '📋', '📌', '✅', '❌', '⚠️', '❓', '❗', '💡', '⏰'],
    },
];

/** Flat set of every emoji we accept as a stored reaction. */
export const ALL_EMOJIS = new Set<string>([
    ...QUICK_REACTIONS,
    ...EMOJI_GROUPS.flatMap((g) => g.emojis),
]);
