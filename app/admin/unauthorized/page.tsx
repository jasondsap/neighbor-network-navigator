/**
 * app/admin/unauthorized/page.tsx
 *
 * Friendly "you're signed in but not an admin" page. Middleware sends
 * unauthenticated users to /auth/signin, but users who ARE signed in but
 * lack the admin role land here via the server-side check in layout.tsx.
 */

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const metadata = {
    title: 'Not Authorized — Neighbor Network Navigator',
};

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen bg-[#2E4A8E] flex items-center justify-center px-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#C0392B]/10 flex items-center justify-center mx-auto mb-5">
                    <ShieldAlert className="w-8 h-8 text-[#C0392B]" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h1>
                <p className="text-gray-600 mb-6">
                    The Admin Console is limited to SLCM staff who manage the resource
                    database. If you think you should have access, contact your
                    administrator.
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#2E4A8E] text-white rounded-xl font-medium hover:bg-[#243d73] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Resource Navigator
                </Link>
            </div>
        </div>
    );
}
