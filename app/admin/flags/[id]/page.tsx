'use client';

/**
 * app/admin/flags/[id]/page.tsx
 *
 * Single-flag triage view. Shows:
 *   - the flag (category, description, suggested correction)
 *   - the reported resource (with a link to /admin/resources/[id] for editing)
 *   - flagger info
 *   - if resolved/dismissed: who handled it + their note
 *
 * Action buttons transition the flag state:
 *   Open          → In Progress (no note)
 *   Open/InProg   → Resolved    (requires note)
 *   Open/InProg   → Dismissed   (requires note)
 *   Resolved/Dism → Reopen      (no note)
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    Flag, Loader2, ArrowLeft, Edit3, User, Clock, CheckCircle2, XCircle,
    PlayCircle, RotateCcw, ExternalLink, AlertCircle, Mail
} from 'lucide-react';
import {
    categoryLabel, statusLabel, statusColor,
} from '@/lib/flags';

interface FlagDetail {
    id: string;
    category: string;
    description: string;
    suggested_correction: string | null;
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolution_note: string | null;

    resource_id: string;
    resource_name: string;
    resource_category: string;
    resource_phone: string | null;
    resource_address: string | null;
    resource_website: string | null;
    resource_email: string | null;
    resource_hours: string | null;
    resource_is_active: boolean;

    flagger_name: string | null;
    flagger_email: string | null;

    resolver_name: string | null;
    resolver_email: string | null;
}

export default function AdminFlagDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [flag, setFlag] = useState<FlagDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/flags/${id}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || `Error ${res.status}`);
                return;
            }
            setFlag(data.flag);
        } catch (e: any) {
            setError(e?.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    async function transition(
        nextStatus: 'in_progress' | 'resolved' | 'dismissed' | 'open',
        promptForNote: boolean,
        friendlyAction: string,
    ) {
        let resolution_note: string | null = null;
        if (promptForNote) {
            const note = prompt(
                `${friendlyAction}\n\nAdd a note for the record (required):`,
            );
            if (!note || note.trim().length < 3) {
                alert('A note of at least 3 characters is required.');
                return;
            }
            resolution_note = note.trim();
        }

        try {
            const res = await fetch(`/api/admin/flags/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus, resolution_note }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Update failed');
                return;
            }
            const msg =
                nextStatus === 'resolved'    ? 'Flag marked resolved' :
                nextStatus === 'dismissed'   ? 'Flag dismissed' :
                nextStatus === 'in_progress' ? 'Flag marked in progress' :
                                               'Flag reopened';
            router.push(`/admin/flags?updated=${encodeURIComponent(msg)}`);
        } catch (e: any) {
            alert(e?.message || 'Update failed');
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                Loading flag...
            </div>
        );
    }

    if (error || !flag) {
        return (
            <div>
                <Link
                    href="/admin/flags"
                    className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to flags
                </Link>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error || 'Flag not found'}
                </div>
            </div>
        );
    }

    const isOpen       = flag.status === 'open';
    const isInProgress = flag.status === 'in_progress';
    const isClosed     = flag.status === 'resolved' || flag.status === 'dismissed';

    return (
        <div>
            <Link
                href="/admin/flags"
                className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline mb-2"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to flags
            </Link>

            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-[#E8B84A]/20 flex items-center justify-center">
                            <Flag className="w-5 h-5 text-[#b5851a]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {categoryLabel(flag.category)}
                            </h2>
                            <p className="text-sm text-gray-500">
                                Reported {formatDate(flag.created_at)}
                            </p>
                        </div>
                    </div>
                </div>
                <StatusPill status={flag.status} large />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                <div className="space-y-5">
                    {/* The flag itself */}
                    <section className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Report
                        </h3>
                        <p className="text-gray-800 whitespace-pre-wrap mb-4">
                            {flag.description}
                        </p>

                        {flag.suggested_correction && (
                            <div className="p-3 bg-[#E8B84A]/10 border border-[#E8B84A]/30 rounded-lg">
                                <p className="text-xs font-semibold text-[#7a5a0e] uppercase tracking-wide mb-1">
                                    Suggested correction
                                </p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                    {flag.suggested_correction}
                                </p>
                            </div>
                        )}
                    </section>

                    {/* The resource */}
                    <section className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-start justify-between gap-2 mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                Resource
                            </h3>
                            <Link
                                href={`/admin/resources/${flag.resource_id}`}
                                className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit resource
                            </Link>
                        </div>

                        <p className="font-medium text-gray-900 mb-1">
                            {flag.resource_name}
                            {!flag.resource_is_active && (
                                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                    Archived
                                </span>
                            )}
                        </p>
                        <p className="text-sm text-gray-500 mb-4">{flag.resource_category}</p>

                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <Row label="Phone"   value={flag.resource_phone} />
                            <Row label="Email"   value={flag.resource_email} />
                            <Row label="Website" value={flag.resource_website} />
                            <Row label="Address" value={flag.resource_address} />
                            <Row label="Hours"   value={flag.resource_hours} fullWidth />
                        </dl>
                    </section>

                    {/* Resolution, if closed */}
                    {isClosed && (
                        <section className={`bg-white rounded-xl border p-5 ${
                            flag.status === 'resolved' ? 'border-green-200' : 'border-gray-200'
                        }`}>
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                                {flag.status === 'resolved' ? 'Resolution' : 'Dismissal'}
                            </h3>
                            <p className="text-gray-800 whitespace-pre-wrap mb-2">
                                {flag.resolution_note}
                            </p>
                            <p className="text-xs text-gray-500">
                                By {flag.resolver_name || flag.resolver_email || 'Unknown'}
                                {flag.resolved_at && ` · ${formatDate(flag.resolved_at)}`}
                            </p>
                        </section>
                    )}
                </div>

                {/* Sidebar: flagger info + actions */}
                <aside className="space-y-4">
                    <section className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Reported by
                        </h3>
                        <div className="flex items-start gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-gray-900 font-medium truncate">
                                    {flag.flagger_name || '(no name set)'}
                                </p>
                                {flag.flagger_email && (
                                    <a
                                        href={`mailto:${flag.flagger_email}`}
                                        className="text-xs text-[#2E4A8E] hover:underline inline-flex items-center gap-1 break-all"
                                    >
                                        <Mail className="w-3 h-3" />
                                        {flag.flagger_email}
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(flag.created_at)}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Actions
                        </h3>
                        <div className="space-y-2">
                            {isOpen && (
                                <ActionButton
                                    icon={PlayCircle}
                                    label="Mark as in progress"
                                    onClick={() => transition('in_progress', false, 'Mark as in progress')}
                                />
                            )}
                            {(isOpen || isInProgress) && (
                                <>
                                    <ActionButton
                                        icon={CheckCircle2}
                                        label="Resolve"
                                        variant="primary"
                                        onClick={() => transition('resolved', true, 'Resolve this flag')}
                                    />
                                    <ActionButton
                                        icon={XCircle}
                                        label="Dismiss"
                                        variant="danger"
                                        onClick={() => transition('dismissed', true, 'Dismiss this flag')}
                                    />
                                </>
                            )}
                            {isClosed && (
                                <ActionButton
                                    icon={RotateCcw}
                                    label="Reopen"
                                    onClick={() => transition('open', false, 'Reopen this flag')}
                                />
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

// ============================================================================
// Subcomponents
// ============================================================================
function StatusPill({ status, large }: { status: string; large?: boolean }) {
    const color = statusColor(status);
    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${
                large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
            }`}
            style={{ backgroundColor: `${color}20`, color }}
        >
            {statusLabel(status)}
        </span>
    );
}

function Row({
    label, value, fullWidth,
}: {
    label: string;
    value: string | null;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'md:col-span-2' : ''}>
            <dt className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">{label}</dt>
            <dd className={`text-gray-900 ${value ? '' : 'text-gray-400 italic'}`}>
                {value || '—'}
                {value && label === 'Website' && value.startsWith('http') && (
                    <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-[#2E4A8E] inline-flex items-center"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </dd>
        </div>
    );
}

function ActionButton({
    icon: Icon,
    label,
    onClick,
    variant = 'default',
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'danger';
}) {
    const classes = {
        default: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
        primary: 'bg-[#30B27A] text-white hover:bg-[#26945f]',
        danger:  'border border-red-300 text-red-700 hover:bg-red-50',
    }[variant];

    return (
        <button
            onClick={onClick}
            className={`w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${classes}`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
