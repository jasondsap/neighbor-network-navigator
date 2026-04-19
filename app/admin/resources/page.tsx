'use client';

/**
 * app/admin/resources/page.tsx
 *
 * Update log:
 *  - Phase B.3: reads ?saved=<name> query param and shows a brief success
 *               banner when returning from an edit. Auto-dismisses after 4s.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Search, Plus, Loader2, Archive, Undo2, Edit3,
    ChevronLeft, ChevronRight, CheckCircle2, X
} from 'lucide-react';

interface Row {
    id: string;
    organization_name: string;
    program_name: string | null;
    category: string;
    subcategory: string | null;
    phone: string | null;
    address: string | null;
    is_active: boolean;
    updated_at: string;
}

const CATEGORIES = [
    'Adult Education', 'Basic Needs', 'Childcare & Parenting', 'Eviction Prevention',
    'Financial Stability', 'Food', 'Health', 'Homelessness Navigation', 'Housing Navigation',
    'Human Trafficking', 'IPV/DV Support', 'LGBTQ+', 'Legal Aid', 'Pregnancy & Postpartum',
    'Relocation & Moving', 'Transportation', 'Utilities', 'Workforce',
];

export default function AdminResourcesPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [rows, setRows] = useState<Row[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [q, setQ] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Success banner from ?saved= query string (set by edit page on save)
    const savedParam = searchParams?.get('saved');
    const [savedBanner, setSavedBanner] = useState<string | null>(null);
    useEffect(() => {
        if (savedParam) {
            setSavedBanner(decodeURIComponent(savedParam));
            // Clean the URL so the banner doesn't come back on refresh
            const url = new URL(window.location.href);
            url.searchParams.delete('saved');
            router.replace(url.pathname + url.search);
            // Auto-dismiss
            const t = setTimeout(() => setSavedBanner(null), 4000);
            return () => clearTimeout(t);
        }
    }, [savedParam, router]);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams({
            q, category, status,
            page: String(page),
            pageSize: '25',
        });
        try {
            const res = await fetch(`/api/admin/resources?${params}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || `Error ${res.status}`);
                setRows([]);
                return;
            }
            setRows(data.resources);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        } catch (e: any) {
            setError(e?.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [q, category, status, page]);

    useEffect(() => { load(); }, [load]);

    function submitSearch(e: React.FormEvent) {
        e.preventDefault();
        setQ(searchInput);
        setPage(1);
    }

    async function handleArchive(row: Row) {
        const summary = prompt(
            `Archive "${row.organization_name}"?\n\nNote about why (required):`
        );
        if (!summary || summary.trim().length < 3) return;
        const res = await fetch(
            `/api/admin/resources/${row.id}?edit_summary=${encodeURIComponent(summary.trim())}`,
            { method: 'DELETE' }
        );
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Archive failed');
            return;
        }
        load();
    }

    async function handleRestore(row: Row) {
        const summary = prompt(
            `Restore "${row.organization_name}" to active?\n\nNote about why (required):`
        );
        if (!summary || summary.trim().length < 3) return;
        const res = await fetch(`/api/admin/resources/${row.id}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ edit_summary: summary.trim() }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Restore failed');
            return;
        }
        load();
    }

    return (
        <div>
            {/* Success flash from edit save */}
            {savedBanner && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="flex-1 text-sm text-green-800">
                        <span className="font-semibold">{savedBanner}</span> saved. A new version was added to the history.
                    </p>
                    <button
                        onClick={() => setSavedBanner(null)}
                        className="text-green-700 hover:text-green-900"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Resources</h2>
                    <p className="text-sm text-gray-500">
                        {isLoading ? 'Loading...' : `${total} resource${total === 1 ? '' : 's'}`}
                        {status !== 'all' && ` (${status})`}
                    </p>
                </div>
                <Link
                    href="/admin/resources/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73] font-medium"
                >
                    <Plus className="w-4 h-4" />
                    New Resource
                </Link>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <form onSubmit={submitSearch} className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Organization, program, description..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                        <select
                            value={category}
                            onChange={e => { setCategory(e.target.value); setPage(1); }}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                            <option value="all">All categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                        <select
                            value={status}
                            onChange={e => { setStatus(e.target.value as any); setPage(1); }}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                            <option value="all">All</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-[#2E4A8E] text-white rounded-lg font-medium text-sm hover:bg-[#243d73]"
                    >
                        Search
                    </button>
                </form>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <Th>Organization</Th>
                            <Th>Category</Th>
                            <Th>Phone</Th>
                            <Th className="w-32">Status</Th>
                            <Th className="w-48 text-right">Actions</Th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                            </td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                                No resources match these filters.
                            </td></tr>
                        ) : (
                            rows.map(r => (
                                <tr key={r.id} className={`hover:bg-gray-50 ${!r.is_active ? 'opacity-60' : ''}`}>
                                    <Td>
                                        <div className="font-medium text-gray-900">{r.organization_name}</div>
                                        {r.program_name && <div className="text-xs text-gray-500">{r.program_name}</div>}
                                    </Td>
                                    <Td>
                                        <div className="text-gray-700">{r.category}</div>
                                        {r.subcategory && <div className="text-xs text-gray-500">{r.subcategory}</div>}
                                    </Td>
                                    <Td>{r.phone || <span className="text-gray-300">—</span>}</Td>
                                    <Td>
                                        {r.is_active ? (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                                                Archived
                                            </span>
                                        )}
                                    </Td>
                                    <Td className="text-right">
                                        <Link
                                            href={`/admin/resources/${r.id}`}
                                            className="inline-flex items-center gap-1 text-[#2E4A8E] hover:underline text-sm mr-4"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            Edit
                                        </Link>
                                        {r.is_active ? (
                                            <button
                                                onClick={() => handleArchive(r)}
                                                className="inline-flex items-center gap-1 text-red-700 hover:underline text-sm"
                                            >
                                                <Archive className="w-3.5 h-3.5" />
                                                Archive
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleRestore(r)}
                                                className="inline-flex items-center gap-1 text-green-700 hover:underline text-sm"
                                            >
                                                <Undo2 className="w-3.5 h-3.5" />
                                                Restore
                                            </button>
                                        )}
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </span>
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
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <th className={`text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
