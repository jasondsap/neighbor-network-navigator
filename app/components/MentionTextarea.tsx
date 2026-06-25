'use client';

/**
 * app/components/MentionTextarea.tsx
 *
 * Plain <textarea> with an @-mention autocomplete dropdown (ported from DDOR).
 * The data policy lives in the caller via the async `getSuggestions(query)`
 * callback, so this component is agnostic about users vs resources.
 *
 * Typing "@" opens a dropdown; choosing an item inserts the token
 * "@[Name](type:id)" (via formatMention). Enter sends (unless the dropdown is
 * open, where Enter picks the highlighted suggestion).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { formatMention, type MentionSuggestion } from '@/lib/mentions';

const TYPE_BADGE: Record<string, string> = {
    user: 'bg-[#2A8B8B]/15 text-[#1f6b6b]',
    resource: 'bg-[#2E4A8E]/15 text-[#2E4A8E]',
};

export function MentionTextarea({
    value,
    onChange,
    getSuggestions,
    onSubmit,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    getSuggestions: (query: string) => Promise<MentionSuggestion[]>;
    onSubmit?: () => void;
    placeholder?: string;
    disabled?: boolean;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [show, setShow] = useState(false);
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<MentionSuggestion[]>([]);
    const [active, setActive] = useState(0);

    const detect = useCallback((val: string) => {
        const lastAt = val.lastIndexOf('@');
        if (lastAt >= 0) {
            const after = val.substring(lastAt + 1);
            if (!after.includes(' ') && !after.includes('\n') && after.length < 30) {
                setShow(true);
                setSearch(after);
                return;
            }
        }
        setShow(false);
    }, []);

    useEffect(() => {
        if (!show) return;
        let cancelled = false;
        getSuggestions(search)
            .then((s) => { if (!cancelled) { setItems(s); setActive(0); } })
            .catch(() => { if (!cancelled) setItems([]); });
        return () => { cancelled = true; };
    }, [show, search, getSuggestions]);

    function handleChange(val: string) {
        onChange(val);
        detect(val);
    }

    function insert(item: MentionSuggestion) {
        const lastAt = value.lastIndexOf('@');
        const before = lastAt >= 0 ? value.substring(0, lastAt) : value;
        onChange(before + formatMention(item) + ' ');
        setShow(false);
        ref.current?.focus();
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (show && items.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(items[active]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setShow(false); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.();
        }
    }

    return (
        <div className="relative flex-1">
            {show && items.length > 0 && (
                <div className="absolute bottom-full mb-2 left-0 w-80 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    {items.map((item, i) => (
                        <button
                            key={`${item.type}:${item.id}`}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); insert(item); }}
                            onMouseEnter={() => setActive(i)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left ${i === active ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                        >
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGE[item.type] || 'bg-gray-100 text-gray-600'}`}>
                                {item.type === 'resource' ? 'RESOURCE' : 'USER'}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm text-gray-900 truncate">{item.name}</span>
                                {item.subtitle && <span className="block text-xs text-gray-400 truncate">{item.subtitle}</span>}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            <textarea
                ref={ref}
                value={value}
                disabled={disabled}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || 'Write a message…  (@ to mention)'}
                rows={2}
                className="w-full resize-none px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent text-sm"
            />
        </div>
    );
}
