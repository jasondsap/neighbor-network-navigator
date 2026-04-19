import type { NextAuthOptions } from 'next-auth';
import CognitoProvider from 'next-auth/providers/cognito';
import { getOrCreateUser } from '@/lib/db';

export const authOptions: NextAuthOptions = {
    providers: [
        CognitoProvider({
            clientId:     process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer:       process.env.COGNITO_ISSUER!,
            checks: ['pkce', 'state'],
        }),
    ],

    secret: process.env.NEXTAUTH_SECRET,

    session: {
        strategy: 'jwt',
        maxAge: 8 * 60 * 60,   // 8 hours
    },

    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === 'cognito') {
                    const cognitoSub = account.providerAccountId;
                    const email = user.email ?? null;
                    const name  = user.name ?? undefined;
                    if (email) {
                        await getOrCreateUser(cognitoSub, email, name);
                    } else {
                        console.warn('Cognito signIn: user.email missing; DB sync skipped.');
                    }
                }
                return true;
            } catch (err) {
                console.error('signIn callback error:', err);
                // Don't block login on DB sync failure — sync can self-heal later
                return true;
            }
        },

        async jwt({ token, account }) {
            if (account?.provider === 'cognito') {
                token.sub = account.providerAccountId;
                (token as any).accessToken = account.access_token;
                (token as any).idToken     = account.id_token;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub as string;
            }
            return session;
        },
    },

    pages: {
        signIn: '/auth/signin',
        error:  '/auth/error',
    },

    debug: process.env.NODE_ENV === 'development',
};
