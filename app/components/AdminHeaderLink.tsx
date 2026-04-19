'use client';

/**
 * app/components/AdminHeaderLink.tsx
 *
 * Tiny component that hits /api/admin/me once and shows an "Admin" link
 * only if the current user is an admin. Drop-in for the main page header.
 *
 * Usage:
 *   import { AdminHeaderLink } from './components/AdminHeaderLink';
 *   ...
 *   <AdminHeaderLink />
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

export function AdminHeaderLink() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/admin/me');
                const data = await res.json();
                if (!cancelled) setIsAdmin(!!data.isAdmin);
            } catch {
                if (!cancelled) setIsAdmin(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (!isAdmin) return null;

    return (
        <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8B84A] text-[#1E3A6E] rounded-lg text-sm font-medium hover:bg-[#d4a63a] transition-colors"
            title="Open Admin Console"
        >
            <Shield className="w-4 h-4" />
            <span className="hidden md:inline">Admin</span>
        </button>
    );
}
