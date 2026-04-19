'use client';

/**
 * app/admin/resources/components/VersionHistory.tsx
 *
 * Update log:
 *  - Phase B.3: onRollbackComplete now also receives the rolled-back version
 *               so the parent can build a useful success message when it
 *               navigates away.
 */

import { useState } from 'react';
import {
    History, RotateCcw, Loader2, Archive, Undo2, Edit3, CheckCircle2
} from 'lucide-react';

export interface Version {
    id: string;
    version_number: number;
    edit_summary: string;
    edit_kind: 'update' | 'archive' | 'restore' | 'rollback';
    created_at: string;
    edited_by: string | null;
    editor_name: string | null;
    editor_email: string | null;
}

interface Props {
    resourceId: string;
    versions: Version[];
    onRollbackComplete: (rolledBackTo: Version) => void;
}

export function VersionHistory({ resourceId, versions, onRollbackComplete }: Props) {
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleRestore(version: Version) {
        const ok = confirm(
            `Roll this resource back to version ${version.version_number}?\n\n` +
            `"${version.edit_summary}"\n\n` +
            `The current state will be saved as a new version so this can be undone.`
        );
        if (!ok) return;

        setRestoringId(version.id);
        setError(null);

        try {
            const res = await fetch(
                `/api/admin/resources/${resourceId}/versions/${version.id}/restore`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        edit_summary: `Rolled back to version ${version.version_number}`,
                    }),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Rollback failed');
                return;
            }
            // Hand the restored version to the parent so it can build a message
            onRollbackComplete(version);
        } catch (e: any) {
            setError(e?.message || 'Rollback failed');
        } finally {
            setRestoringId(null);
        }
    }

    if (versions.length === 0) {
        return (
            <aside className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Version History</h3>
                </div>
                <p className="text-sm text-gray-500 italic">
                    No versions yet. The first edit will create version history.
                </p>
            </aside>
        );
    }

    return (
        <aside className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Version History</h3>
                <span className="ml-auto text-xs text-gray-500">{versions.length}</span>
            </div>

            {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {error}
                </div>
            )}

            <ul className="space-y-3 max-h-[600px] overflow-y-auto">
                {versions.map((v, idx) => (
                    <li
                        key={v.id}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <KindBadge kind={v.edit_kind} />
                                <span className="text-xs font-medium text-gray-500">
                                    v{v.version_number}
                                </span>
                                {idx === 0 && (
                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide">
                                        Latest
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-sm text-gray-800 mb-1">{v.edit_summary}</p>
                        <p className="text-xs text-gray-500">
                            {v.editor_name || v.editor_email || 'Unknown'} •{' '}
                            {formatRelative(v.created_at)}
                        </p>

                        {idx !== 0 && (
                            <button
                                onClick={() => handleRestore(v)}
                                disabled={restoringId !== null}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#2E4A8E] hover:underline disabled:opacity-50"
                            >
                                {restoringId === v.id ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Rolling back...</>
                                ) : (
                                    <><RotateCcw className="w-3 h-3" /> Restore this version</>
                                )}
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </aside>
    );
}

function KindBadge({ kind }: { kind: Version['edit_kind'] }) {
    const map = {
        update:   { icon: Edit3,        label: 'Update',   cls: 'text-blue-700 bg-blue-100' },
        archive:  { icon: Archive,      label: 'Archive',  cls: 'text-red-700 bg-red-100' },
        restore:  { icon: CheckCircle2, label: 'Restore',  cls: 'text-green-700 bg-green-100' },
        rollback: { icon: Undo2,        label: 'Rollback', cls: 'text-amber-700 bg-amber-100' },
    };
    const { icon: Icon, label, cls } = map[kind] || map.update;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${cls}`}>
            <Icon className="w-3 h-3" />
            {label}
        </span>
    );
}

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
