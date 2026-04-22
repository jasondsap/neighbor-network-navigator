'use client';

/**
 * app/admin/page.tsx
 *
 * Update log:
 *  - Phase D: added "Pending Access Reports" as a fourth summary tile.
 *             Grid changes from 3 → 4 columns at lg+.
 */

import { useEffect, useState } from 'react';
import {
    Package, Flag, History, AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react';

interface DashboardData {
    total: number;
    categoryCounts: Array<{ category: string; count: number }>;
    recentEdits: Array<{
        id: string;
        organization_name: string;
        category: string;
        updated_at: string;
        editor: string | null;
    }>;
    staleCount: number;
    pendingFlags: number;
    pendingAccessReports: number;
}

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAllCategories, setShowAllCategories] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/admin/dashboard');
                if (!res.ok) {
                    setError(`Failed to load dashboard (${res.status})`);
                    return;
                }
                setData(await res.json());
            } catch (e: any) {
                setError(e?.message || 'Unknown error');
            }
        })();
    }, []);

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-800">
                <p className="font-semibold mb-1">Error loading dashboard</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                Loading dashboard...
            </div>
        );
    }

    const topCategories = showAllCategories
        ? data.categoryCounts
        : data.categoryCounts.slice(0, 5);

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-500 text-sm">
                    Overview of the Neighbor Network resource database.
                </p>
            </div>

            {/* Summary tiles — 4 across at lg+, 2 across at md, 1 below */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <SummaryTile
                    icon={Package}
                    label="Active Resources"
                    value={data.total.toLocaleString()}
                    color="#2E4A8E"
                />
                <SummaryTile
                    icon={Flag}
                    label="Pending Flags"
                    value={data.pendingFlags.toLocaleString()}
                    color="#E8B84A"
                    sublabel={data.pendingFlags === 0 ? 'All caught up' : 'Need review'}
                />
                <SummaryTile
                    icon={AlertTriangle}
                    label="Access Reports"
                    value={data.pendingAccessReports.toLocaleString()}
                    color="#C0392B"
                    sublabel={data.pendingAccessReports === 0 ? 'All caught up' : 'Pending triage'}
                />
                <SummaryTile
                    icon={AlertTriangle}
                    label="Possibly Stale"
                    value={data.staleCount.toLocaleString()}
                    color="#6B7280"
                    sublabel="Not updated in 6+ months"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category breakdown */}
                <section className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Resources by Category</h3>
                        {data.categoryCounts.length > 5 && (
                            <button
                                onClick={() => setShowAllCategories(v => !v)}
                                className="text-xs text-[#2E4A8E] hover:underline"
                            >
                                {showAllCategories
                                    ? 'Show top 5'
                                    : `See all ${data.categoryCounts.length}`}
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {topCategories.map(c => (
                            <CategoryBar
                                key={c.category}
                                label={c.category}
                                count={c.count}
                                max={data.categoryCounts[0]?.count || 1}
                            />
                        ))}
                    </div>
                </section>

                {/* Recent edits */}
                <section className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <History className="w-4 h-4 text-gray-500" />
                        <h3 className="font-semibold text-gray-900">Recent Edits</h3>
                    </div>
                    {data.recentEdits.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">
                            No recent edits yet.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {data.recentEdits.map(edit => (
                                <li
                                    key={edit.id}
                                    className="flex items-center justify-between gap-3 text-sm"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 truncate">
                                            {edit.organization_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {edit.category}
                                            {edit.editor ? ` \u2022 ${edit.editor}` : ''}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">
                                        {formatRelative(edit.updated_at)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {/* What's next block */}
            <div className="mt-8 p-5 bg-gradient-to-br from-[#2E4A8E]/5 to-[#E8B84A]/5 border border-[#2E4A8E]/10 rounded-xl">
                <div className="flex items-start gap-3">
                    <ChevronRight className="w-5 h-5 text-[#2E4A8E] flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-gray-900">Coming soon</h4>
                        <p className="text-sm text-gray-600 mt-1">
                            Phase E adds Excel export so SLCM can download a snapshot of the
                            resource database as a multi-tab workbook for backups or external sharing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Subcomponents
// ============================================================================
function SummaryTile({
    icon: Icon,
    label,
    value,
    color,
    sublabel,
}: {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    value: string;
    color: string;
    sublabel?: string;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}15` }}
                >
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    {label}
                </p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
        </div>
    );
}

function CategoryBar({
    label,
    count,
    max,
}: {
    label: string;
    count: number;
    max: number;
}) {
    const pct = Math.max(3, (count / max) * 100);
    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700">{label}</span>
                <span className="text-gray-500 font-medium">{count}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[#2E4A8E] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
