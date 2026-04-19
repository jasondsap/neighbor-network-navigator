'use client';

/**
 * app/admin/flags/page.tsx
 *
 * Triage queue. Default view = "pending" (open + in_progress), most-urgent
 * first. Admins can filter by status + category and click into detail.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Flag, Loader2, ChevronRight, X as XIcon, CheckCircle2,
    ChevronLeft, ChevronRight as ChevronRightIcon, AlertCircle
} from 'lucide-react';
import {
    FLAG_CATEGORIES, FLAG_STATUSES,
    categoryLabel, statusLabel, statusColor,
} from '@/lib/flags';

interface FlagRow {
    id: string;
    category: string;
    description: string;
    suggested_correction: string | null;
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
    created_at: string;
    resolved_at: string | null;
    resolution_note: string | null;

    resource_id: string;
    resource_name: string;
    resource_is_active: boolean;

    flagger_name: string | null;
    flagger_email: string | null;

    resolver_name: string | null;
}

export default function AdminFlagsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [rows, setRows] = useState<FlagRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [status, setStatus] = useState(searchParams?.get('status') || 'pending');
    const [category, setCategory] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [summary, setSummary] = useState<{
        byStatus: Record<string, number>;
        pending: number;
        total: number;
    } | null>(null);

    // ?updated=<id> flash message after returning from detail view
    const updatedParam = searchParams?.get('updated');
    const [updatedBanner, setUpdatedBanner] = useState<string | null>(null);
    useEffect(() => {
        if (updatedParam) {
            setUpdatedBanner(decodeURIComponent(updatedParam));
            const url = new URL(window.location.href);
            url.searchParams.delete('updated');
            router.replace(url.pathname + url.search);
            const t = setTimeout(() => setUpdatedBanner(null), 4000);
            return () => clearTimeout(t);
        }
    }, [updatedParam, router]);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams({
            status, category,
            page: String(page),
            pageSize: '25',
        });
        try {
            const [listRes, summaryRes] = await Promise.all([
                fetch(`/api/admin/flags?${params}`),
                fetch('/api/admin/flags/summary'),
            ]);
            const list = await listRes.json();
            const sum = await summaryRes.json();
            if (!listRes.ok) {
                setError(list.error || `Error ${listRes.status}`);
                setRows([]);
                return;
            }
            setRows(list.flags);
            setTotalPages(list.totalPages);
            setTotal(list.total);
            if (summaryRes.ok) setSummary(sum);
        } catch (e: any) {
            setError(e?.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [status, category, page]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            {updatedBanner && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="flex-1 text-sm text-green-800">{updatedBanner}</p>
                    <button
                        onClick={() => setUpdatedBanner(null)}
                        className="text-green-700 hover:text-green-900"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Flags</h2>
                    <p className="text-sm text-gray-500">
                        {summary
                            ? `${summary.pending} pending · ${summary.total} total`
                            : 'Loading...'}
                    </p>
                </div>
            </div>

            {/* Quick status filter pills */}
            <div className="flex flex-wrap gap-2 mb-4">
                {[
                    { value: 'pending',     label: 'Pending' },
                    ...FLAG_STATUSES.map(s => ({ value: s.value, label: s.label })),
                    { value: 'all',         label: 'All' },
                ].map(opt => {
                    const count = opt.value === 'pending'
                        ? summary?.pending
                        : opt.value === 'all'
                            ? summary?.total
                            : summary?.byStatus[opt.value];
                    return (
                        <button
                            key={opt.value}
                            onClick={() => { setStatus(opt.value); setPage(1); }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                status === opt.value
                                    ? 'bg-[#2E4A8E] text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:border-[#2E4A8E]'
                            }`}
                        >
                            {opt.label}
                            {typeof count === 'number' && (
                                <span className={`text-xs ${
                                    status === opt.value ? 'text-white/70' : 'text-gray-500'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Category filter */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="flex items-end gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                        <select
                            value={category}
                            onChange={e => { setCategory(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[260px]"
                        >
                            <option value="all">All categories</option>
                            {FLAG_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {isLoading ? (
                    <div className="text-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-16">
                        <Flag className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No flags match these filters.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {rows.map(row => (
                            <li key={row.id}>
                                <Link
                                    href={`/admin/flags/${row.id}`}
                                    className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <StatusPill status={row.status} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900 truncate">
                                                {row.resource_name}
                                            </span>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                {categoryLabel(row.category)}
                                            </span>
                                            {!row.resource_is_active && (
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                                    Archived
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                                            {row.description}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Reported by {row.flagger_name || row.flagger_email || 'Unknown'} ·{' '}
                                            {formatRelative(row.created_at)}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                        >
                            Next <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const color = statusColor(status);
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold"
            style={{ backgroundColor: `${color}20`, color }}
        >
            {statusLabel(status)}
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
