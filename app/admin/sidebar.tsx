'use client';

/**
 * app/admin/sidebar.tsx
 *
 * Update log:
 *  - Phase C: Flags item enabled, shows pending count badge when non-zero.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Package,
    Flag,
    Download,
    Users,
} from 'lucide-react';

interface NavItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
    badge?: string;
}

const NAV: NavItem[] = [
    { href: '/admin',           label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/resources', label: 'Resources', icon: Package },
    { href: '/admin/flags',     label: 'Flags',     icon: Flag },
    { href: '/admin/users',     label: 'Users',     icon: Users,    disabled: true, badge: 'Later'   },
    { href: '/admin/export',    label: 'Export',    icon: Download, disabled: true, badge: 'Phase D' },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const [pending, setPending] = useState<number | null>(null);

    // Fetch pending flag count once on mount — cheap, shows a live badge
    useEffect(() => {
        let cancelled = false;
        fetch('/api/admin/flags/summary')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (!cancelled && data) setPending(data.pending); })
            .catch(() => { /* silent */ });
        return () => { cancelled = true; };
    }, [pathname]);  // re-fetch when navigating between admin pages

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

                    // Live pending count badge for Flags
                    const showPendingBadge =
                        item.href === '/admin/flags' &&
                        typeof pending === 'number' &&
                        pending > 0;

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
                            {showPendingBadge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isActive
                                        ? 'bg-white text-[#2E4A8E]'
                                        : 'bg-[#E8B84A] text-[#1E3A6E]'
                                }`}>
                                    {pending}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
