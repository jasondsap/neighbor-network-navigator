'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Loader2, Shield, Search, Sparkles, Bus, Users } from 'lucide-react';

function SignInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const [isLoading, setIsLoading] = useState(false);

    const callbackUrl = searchParams.get('callbackUrl') || '/';
    const error = searchParams.get('error');

    useEffect(() => {
        if (session) {
            router.push(callbackUrl);
        }
    }, [session, router, callbackUrl]);

    const handleSignIn = async () => {
        setIsLoading(true);
        await signIn('cognito', { callbackUrl });
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#2E4A8E] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#E8B84A]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gray-50">
            {/* Left side — sign-in form */}
            <div className="flex-1 flex items-center justify-center px-8 py-12">
                <div className="max-w-md w-full">
                    {/* Logo / brand */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-[#E8B84A] flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Users className="w-8 h-8 text-[#1E3A6E]" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#2E4A8E]">Welcome, Navigator</h1>
                        <p className="text-gray-600 mt-2">
                            Sign in to access the Louisville Neighbor Network resource database
                        </p>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error === 'OAuthSignin' && 'Error starting sign in process. Please try again.'}
                            {error === 'OAuthCallback' && 'Error during sign in callback. Please try again.'}
                            {error === 'OAuthCreateAccount' && 'Error creating your account.'}
                            {error === 'Callback' && 'Error during callback.'}
                            {error === 'AccessDenied' && 'Access denied. Please contact your administrator.'}
                            {error === 'Configuration' && 'Server configuration error. Please contact support.'}
                            {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'Callback', 'AccessDenied', 'Configuration'].includes(error) &&
                                'An error occurred during sign in. Please try again.'}
                        </div>
                    )}

                    {/* Sign in button */}
                    <button
                        onClick={handleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#2E4A8E] text-white rounded-xl hover:bg-[#243d73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium shadow-md"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                                </svg>
                                Sign In / Create Account
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="my-8 flex items-center gap-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-sm text-gray-500">Secure Authentication</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Trust badge */}
                    <div className="flex items-center justify-center gap-2 text-[#2E4A8E] bg-[#2E4A8E]/5 border border-[#2E4A8E]/10 rounded-lg py-3">
                        <Shield className="w-5 h-5" />
                        <span className="font-medium text-sm">Encrypted &amp; Secure</span>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 text-center text-sm text-gray-500">
                        <p>South Louisville Community Ministries</p>
                        <p className="text-[#E8B84A] font-medium mt-1">Reconnect • Rethink • Rebuild</p>
                    </div>
                </div>
            </div>

            {/* Right side — features */}
            <div className="hidden lg:flex flex-1 bg-[#2E4A8E] items-center justify-center px-12 relative">
                {/* Subtle background accent */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#2E4A8E] to-[#1E3A6E]" />

                <div className="relative max-w-md text-[#F5F0E6]">
                    <div className="mb-2">
                        <span className="text-[#E8B84A] font-serif text-sm tracking-widest uppercase">
                            Louisville Neighbor Network
                        </span>
                    </div>
                    <h2 className="text-3xl font-serif text-[#E8B84A] mb-4">
                        Everything you need to help your neighbors.
                    </h2>
                    <p className="text-[#F5F0E6]/90 mb-10">
                        A single toolkit for SLCM navigators — find, filter, and connect neighbors
                        to the resources they need.
                    </p>

                    <div className="space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-[#E8B84A]/20 flex items-center justify-center flex-shrink-0">
                                <Search className="w-5 h-5 text-[#E8B84A]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#F5F0E6]">600+ Local Resources</h3>
                                <p className="text-[#F5F0E6]/80 text-sm">
                                    Housing, food, health, legal, and more — all searchable in one place.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-[#E8B84A]/20 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-[#E8B84A]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#F5F0E6]">AI Navigator Assistant</h3>
                                <p className="text-[#F5F0E6]/80 text-sm">
                                    Get personalized guidance, scripts, and next steps for each neighbor&apos;s situation.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-[#E8B84A]/20 flex items-center justify-center flex-shrink-0">
                                <Bus className="w-5 h-5 text-[#E8B84A]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#F5F0E6]">TARC Bus Directions</h3>
                                <p className="text-[#F5F0E6]/80 text-sm">
                                    Step-by-step transit directions to every resource, built right in.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-lg bg-[#E8B84A]/20 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-5 h-5 text-[#E8B84A]" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[#F5F0E6]">Secure &amp; Private</h3>
                                <p className="text-[#F5F0E6]/80 text-sm">
                                    Cognito-backed authentication. Your searches and notes stay protected.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#2E4A8E] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#E8B84A]" />
                </div>
            }
        >
            <SignInContent />
        </Suspense>
    );
}
