/**
 * app/admin/layout.tsx
 *
 * Server component. Runs the admin role check BEFORE rendering any admin
 * children — this prevents flash-of-unauth-content even if the client JS
 * is slow to load. Non-admins are bounced to /admin/unauthorized.
 *
 * Renders the shared admin shell: top bar + left sidebar + content area.
 * The sidebar's interactive bits (active-link highlighting) live in a
 * small client component below.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { tryRequireAdmin } from '@/lib/admin';
import { AdminSidebar } from './sidebar';
import { Shield } from 'lucide-react';

export const metadata = {
    title: 'Admin — Neighbor Network Navigator',
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const admin = await tryRequireAdmin();
    if (!admin) {
        redirect('/admin/unauthorized');
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top bar */}
            <header className="bg-[#1E3A6E] text-[#F5F0E6] sticky top-0 z-40 shadow">
                <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#E8B84A] flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#1E3A6E]" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-lg leading-tight">Admin Console</h1>
                            <p className="text-xs text-[#F5F0E6]/70">Neighbor Network Navigator</p>
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="text-sm text-[#F5F0E6]/90 hover:text-[#E8B84A] transition-colors"
                    >
                        ← Back to App
                    </Link>
                </div>
            </header>

            {/* Body: sidebar + content */}
            <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
                <AdminSidebar />
                <main className="flex-1 min-w-0">{children}</main>
            </div>
        </div>
    );
}
