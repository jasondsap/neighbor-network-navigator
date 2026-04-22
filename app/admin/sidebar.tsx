'use client';

/**
 * app/admin/sidebar.tsx
 *
 * Update log:
 *  - Phase D: Access Reports added, with its own pending badge (gold).
 *             Badge counts are fetched in parallel from both summary endpoints.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    Flag,
    AlertTriangle,
    Download,
    Users,
} from 'lucide-react';

interface NavItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    disabled?: boolean;
    badge?: string;
    pendingKey?: 'flags' | 'access';
}

const NAV: NavItem[] = [
    { href: '/admin',                 label: 'Dashboard',       icon: LayoutDashboard },
    { href: '/admin/resources',       label: 'Resources',       icon: Package },
    { href: '/admin/flags',           label: 'Flags',           icon: Flag,           pendingKey: 'flags' },
    { href: '/admin/access-reports',  label: 'Access Reports',  icon: AlertTriangle,  pendingKey: 'access' },
    { href: '/admin/users',           label: 'Users',           icon: Users,          disabled: true, badge: 'Later' },
    { href: '/admin/export',          label: 'Export',          icon: Download,       disabled: true, badge: 'Phase E' },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const [pending, setPending] = useState<{ flags: number | null; access: number | null }>({
        flags: null, access: null,
    });

    // Fetch pending counts in parallel on mount + every nav change
    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([
            fetch('/api/admin/flags/summary').then(r => r.ok ? r.json() : null),
            fetch('/api/admin/access-reports/summary').then(r => r.ok ? r.json() : null),
        ]).then(([flagsRes, accessRes]) => {
            if (cancelled) return;
            const flags  = flagsRes.status === 'fulfilled' && flagsRes.value
                ? flagsRes.value.pending : null;
            const access = accessRes.status === 'fulfilled' && accessRes.value
                ? accessRes.value.pending : null;
            setPending({ flags, access });
        });
        return () => { cancelled = true; };
    }, [pathname]);

    return (
        <aside className="w-56 flex-shrink-0">
            <nav className="space-y-1">
                {NAV.map(item => {
                    const isActive =
                        item.href === '/admin'
                            ? pathname === '/admin'
                            : pathname?.startsWith(item.href);
                    const Icon = item.icon;

                    if (item.disabled) {
                        return (
                            <div
                                key={item.href}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 cursor-not-allowed select-none"
                                title="Coming soon"
                            >
                                <Icon className="w-4 h-4" />
                                <span className="flex-1">{item.label}</span>
                                {item.badge && (
                                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                        );
                    }

                    const pendingCount = item.pendingKey
                        ? pending[item.pendingKey]
                        : null;
                    const showPending = typeof pendingCount === 'number' && pendingCount > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                    ? 'bg-[#2E4A8E] text-white shadow-sm'
                                    : 'text-gray-700 hover:bg-white hover:text-[#2E4A8E]'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="flex-1">{item.label}</span>
                            {showPending && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isActive
                                        ? 'bg-white text-[#2E4A8E]'
                                        : 'bg-[#E8B84A] text-[#1E3A6E]'
                                }`}>
                                    {pendingCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
