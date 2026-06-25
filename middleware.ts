/**
 * middleware.ts (project root)
 *
 * Runs before every matching request. For /admin/* routes we do two layers:
 *
 *   Layer 1 (this file): check that a NextAuth session cookie exists.
 *     Runs on the edge — fast, but can't hit Neon to verify role.
 *
 *   Layer 2 (each admin route / layout): verify role=admin server-side.
 *     Happens in the app/admin/layout.tsx and individual API routes
 *     via requireAdmin() from lib/admin.ts.
 *
 * We deliberately keep Layer 1 minimal (session presence only) so we don't
 * have to bundle Neon/DB code into the edge runtime.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Check session cookie existence. getToken is edge-compatible and just
    // validates the JWT signature — it does NOT hit the DB.
    const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
        // API routes under /admin: return 401 JSON so fetch() callers
        // can handle it cleanly without following HTML redirects.
        if (pathname.startsWith('/api/admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // UI routes: redirect to sign-in with a callbackUrl so they come back here
        const signInUrl = new URL('/auth/signin', req.url);
        signInUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(signInUrl);
    }

    // Session valid — let the request through. Role will be checked
    // downstream by requireAdmin() in the route / layout.
    return NextResponse.next();
}

export const config = {
    // Matches /admin and everything under it, plus /api/admin/* API routes,
    // and the messaging page (redirect to sign-in when logged out).
    matcher: ['/admin/:path*', '/api/admin/:path*', '/messages/:path*'],
};
