'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, AlertCircle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { error } = await signIn(email, password);
            
            if (error) {
                setError(error.message || 'Failed to sign in');
            } else {
                router.push('/');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-nn-blue flex flex-col">
            {/* Header */}
            <header className="p-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-nn-gold flex items-center justify-center">
                            <Users className="w-5 h-5 text-nn-blue-dark" />
                        </div>
                        <span className="text-nn-cream font-semibold text-lg">Neighbor Network</span>
                    </div>
                    <a 
                        href="https://www.louisvilleneighbornetwork.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-nn-cream/80 hover:text-nn-cream text-sm transition-colors"
                    >
                        Visit Main Site →
                    </a>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">
                    {/* Welcome Text */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl md:text-5xl font-display text-nn-gold mb-4">
                            Welcome,<br />Neighbor.
                        </h1>
                        <p className="text-nn-cream/90 text-lg">
                            Sign in to access the Resource Navigator
                        </p>
                    </div>

                    {/* Login Form */}
                    <div className="bg-white rounded-2xl p-8 shadow-xl">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="neighbor@example.com"
                                        required
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nn-blue focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nn-blue focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-[#8B2332] text-white rounded-xl font-semibold hover:bg-[#A53342] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-600">
                                Don't have an account?{' '}
                                <Link href="/signup" className="text-nn-blue font-semibold hover:underline">
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Tagline */}
                    <p className="text-center text-nn-cream/70 text-sm mt-8">
                        Reconnect • Rethink • Rebuild
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-6 text-center">
                <p className="text-nn-cream/60 text-sm">
                    Louisville Neighbor Network • South Louisville Community Ministries
                </p>
            </footer>
        </div>
    );
}
