'use client';

/**
 * app/admin/access-reports/page.tsx
 *
 * Queue view. Clare requested card-based so each response feels like a
 * discrete item to "work through" rather than a crowded spreadsheet row.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    AlertTriangle, Loader2, ChevronRight, X as XIcon, CheckCircle2,
    ChevronLeft, ChevronRight as ChevronRightIcon, AlertCircle,
} from 'lucide-react';
import {
    ACCESS_REPORT_STATUSES, BARRIER_OPTIONS,
    barrierLabel, accessStatusLabel, accessStatusColor,
} from '@/lib/access-reports';

interface ReportRow {
    id: string;
    status: 'open' | 'reviewed' | 'addressed' | 'archived';
    created_at: string;

    barriers: string[];
    barriers_other: string | null;
    attempt_methods: string[];
    attempt_count: string | null;
    final_outcome: string | null;
    improvements: string[];
    additional_notes: string | null;

    resource_id: string;
    resource_name: string;
    resource_category: string;
    resource_is_active: boolean;

    reporter_name: string | null;
    reporter_email: string | null;
}

export default function AdminAccessReportsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [rows, setRows] = useState<ReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [status, setStatus] = useState(searchParams?.get('status') || 'pending');
    const [barrier, setBarrier] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [summary, setSummary] = useState<{
        byStatus: Record<string, number>;
        pending: number;
        total: number;
    } | null>(null);

    // Flash banner from ?updated=<msg>
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
            status, page: String(page), pageSize: '25',
        });
        if (barrier !== 'all') params.set('barrier', barrier);

        try {
            const [listRes, summaryRes] = await Promise.all([
                fetch(`/api/admin/access-reports?${params}`),
                fetch('/api/admin/access-reports/summary'),
            ]);
            const list = await listRes.json();
            const sum  = await summaryRes.json();
            if (!listRes.ok) {
                setError(list.error || `Error ${listRes.status}`);
                setRows([]);
                return;
            }
            setRows(list.reports);
            setTotalPages(list.totalPages);
            setTotal(list.total);
            if (summaryRes.ok) setSummary(sum);
        } catch (e: any) {
            setError(e?.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [status, barrier, page]);

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
                    <h2 className="text-2xl font-bold text-gray-900">Access Reports</h2>
                    <p className="text-sm text-gray-500">
                        Barrier reports from navigators who couldn&rsquo;t connect clients to resources.
                        {summary && ` ${summary.pending} pending, ${summary.total} total.`}
                    </p>
                </div>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2 mb-4">
                {[
                    { value: 'pending', label: 'Pending' },
                    ...ACCESS_REPORT_STATUSES.map(s => ({ value: s.value, label: s.label })),
                    { value: 'all', label: 'All' },
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
                                <span className={`text-xs ${status === opt.value ? 'text-white/70' : 'text-gray-500'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Barrier filter */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="flex items-end gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Filter by barrier
                        </label>
                        <select
                            value={barrier}
                            onChange={e => { setBarrier(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[280px]"
                        >
                            <option value="all">All barriers</option>
                            {BARRIER_OPTIONS.map(b => (
                                <option key={b.value} value={b.value}>{b.label}</option>
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

            {/* Card grid */}
            {isLoading ? (
                <div className="text-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </div>
            ) : rows.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 text-center py-16">
                    <AlertTriangle className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No access reports match these filters.</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {rows.map(row => (
                        <li key={row.id}>
                            <Link
                                href={`/admin/access-reports/${row.id}`}
                                className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#2E4A8E]/40 hover:shadow-sm transition-all"
                            >
                                <div className="flex items-start gap-3 mb-2">
                                    <StatusPill status={row.status} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">
                                            {row.resource_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {row.resource_category}
                                            {!row.resource_is_active && ' \u2022 Archived resource'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {row.barriers.slice(0, 3).map(b => (
                                        <span
                                            key={b}
                                            className="inline-flex px-2 py-0.5 bg-[#C0392B]/10 text-[#C0392B] text-xs rounded-full"
                                        >
                                            {barrierLabel(b)}
                                        </span>
                                    ))}
                                    {row.barriers.length > 3 && (
                                        <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                            +{row.barriers.length - 3} more
                                        </span>
                                    )}
                                </div>

                                {row.additional_notes && (
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                                        {row.additional_notes}
                                    </p>
                                )}

                                <p className="text-xs text-gray-400">
                                    Reported by {row.reporter_name || row.reporter_email || 'Unknown'} \u2022{' '}
                                    {formatRelative(row.created_at)}
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

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
    const color = accessStatusColor(status);
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold flex-shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
        >
            {accessStatusLabel(status)}
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
