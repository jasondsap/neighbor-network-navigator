'use client';

/**
 * app/admin/resources/components/LinksEditor.tsx
 *
 * Admin CRUD for a resource's structured links (resource_links).
 * Lives on the resource edit page. Independent of the versioned resource
 * form — each add/edit/delete hits /api/admin/resources/[id]/links[/linkId]
 * immediately. Links are not versioned.
 */

import { useState } from 'react';
import { Link2, Plus, Trash2, Pencil, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { LINK_SOURCE_FIELDS } from '@/lib/resource-links';

export interface AdminLink {
    id: string;
    source_field: string;
    link_text: string | null;
    url: string;
    sort_order: number;
}

const LABEL = new Map(LINK_SOURCE_FIELDS.map(f => [f.value, f.label]));
const INPUT =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent text-sm';

interface DraftLink {
    source_field: string;
    link_text: string;
    url: string;
    sort_order: string;
}

const BLANK: DraftLink = { source_field: 'Tips/Tricks', link_text: '', url: '', sort_order: '0' };

export function LinksEditor({
    resourceId,
    initialLinks,
}: {
    resourceId: string;
    initialLinks: AdminLink[];
}) {
    const [links, setLinks] = useState<AdminLink[]>(initialLinks);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState<DraftLink>(BLANK);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function startAdd() {
        setError(null);
        setEditingId(null);
        setDraft(BLANK);
        setAdding(true);
    }

    function startEdit(l: AdminLink) {
        setError(null);
        setAdding(false);
        setEditingId(l.id);
        setDraft({
            source_field: l.source_field,
            link_text: l.link_text ?? '',
            url: l.url,
            sort_order: String(l.sort_order ?? 0),
        });
    }

    function cancel() {
        setAdding(false);
        setEditingId(null);
        setError(null);
    }

    async function save() {
        setBusy(true);
        setError(null);
        const isEdit = editingId !== null;
        const url = isEdit
            ? `/api/admin/resources/${resourceId}/links/${editingId}`
            : `/api/admin/resources/${resourceId}/links`;
        try {
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_field: draft.source_field,
                    link_text: draft.link_text,
                    url: draft.url,
                    sort_order: draft.sort_order,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.fieldErrors?.[0]?.message || data.error || 'Failed to save link');
                return;
            }
            setLinks(prev => {
                const next = isEdit
                    ? prev.map(l => (l.id === editingId ? data.link : l))
                    : [...prev, data.link];
                return next.sort(
                    (a, b) => a.sort_order - b.sort_order || a.source_field.localeCompare(b.source_field)
                );
            });
            cancel();
        } catch {
            setError('Network error saving link');
        } finally {
            setBusy(false);
        }
    }

    async function remove(l: AdminLink) {
        if (!confirm(`Delete this ${LABEL.get(l.source_field) ?? l.source_field} link?\n\n${l.url}`)) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/resources/${resourceId}/links/${l.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || 'Failed to delete link');
                return;
            }
            setLinks(prev => prev.filter(x => x.id !== l.id));
        } catch {
            setError('Network error deleting link');
        } finally {
            setBusy(false);
        }
    }

    const editor = (
        <div className="space-y-2 p-3 bg-[#2E4A8E]/5 rounded-lg border border-[#2E4A8E]/20">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                <select
                    className={INPUT}
                    value={draft.source_field}
                    onChange={e => setDraft({ ...draft, source_field: e.target.value })}
                >
                    {LINK_SOURCE_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>
                <input
                    className={INPUT}
                    placeholder="https://… or mailto:name@org.org"
                    value={draft.url}
                    onChange={e => setDraft({ ...draft, url: e.target.value })}
                />
            </div>
            <input
                className={INPUT}
                placeholder="Link label / description (optional)"
                value={draft.link_text}
                onChange={e => setDraft({ ...draft, link_text: e.target.value })}
            />
            <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Sort</label>
                <input
                    type="number"
                    className={`${INPUT} w-20`}
                    value={draft.sort_order}
                    onChange={e => setDraft({ ...draft, sort_order: e.target.value })}
                />
                <div className="flex-1" />
                <button
                    onClick={cancel}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                    <X className="w-4 h-4" /> Cancel
                </button>
                <button
                    onClick={save}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73] disabled:opacity-50"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-[#2E4A8E]" />
                    <h3 className="font-semibold text-gray-900">Links &amp; Forms</h3>
                    <span className="text-xs text-gray-400">({links.length})</span>
                </div>
                {!adding && editingId === null && (
                    <button
                        onClick={startAdd}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73]"
                    >
                        <Plus className="w-4 h-4" /> Add link
                    </button>
                )}
            </div>

            <p className="text-xs text-gray-500 mb-3">
                Extra links shown on the resource card (application forms, income guidelines, etc.).
                Not versioned — changes save immediately.
            </p>

            {error && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            <ul className="space-y-2">
                {links.length === 0 && !adding && (
                    <li className="text-sm text-gray-400 italic">No links yet.</li>
                )}
                {links.map(l =>
                    editingId === l.id ? (
                        <li key={l.id}>{editor}</li>
                    ) : (
                        <li
                            key={l.id}
                            className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-[#2E4A8E]">
                                    {LABEL.get(l.source_field) ?? l.source_field}
                                </div>
                                {l.link_text && (
                                    <div className="text-sm text-gray-700 truncate">{l.link_text}</div>
                                )}
                                <a
                                    href={/^(https?:\/\/|mailto:)/i.test(l.url) ? l.url : `https://${l.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-gray-500 hover:text-[#2E4A8E] underline break-all"
                                >
                                    {l.url}
                                </a>
                            </div>
                            <button
                                onClick={() => startEdit(l)}
                                disabled={busy}
                                className="p-1.5 text-gray-400 hover:text-[#2E4A8E] hover:bg-white rounded"
                                title="Edit"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => remove(l)}
                                disabled={busy}
                                className="p-1.5 text-gray-400 hover:text-[#8B2332] hover:bg-white rounded"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    )
                )}
                {adding && <li>{editor}</li>}
            </ul>
        </div>
    );
}
