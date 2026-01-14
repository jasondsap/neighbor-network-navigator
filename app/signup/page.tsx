'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, User, AlertCircle, Users, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SignupPage() {
    const router = useRouter();
    const { signUp } = useAuth();
    
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await signUp(email, password, fullName);
            
            if (error) {
                setError(error.message || 'Failed to create account');
            } else {
                setSuccess(true);
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-nn-blue flex flex-col">
                {/* Header */}
                <header className="p-6">
                    <div className="max-w-7xl mx-auto flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-nn-gold flex items-center justify-center">
                            <Users className="w-5 h-5 text-nn-blue-dark" />
                        </div>
                        <span className="text-nn-cream font-semibold text-lg">Neighbor Network</span>
                    </div>
                </header>

                <main className="flex-1 flex items-center justify-center px-6 py-12">
                    <div className="w-full max-w-md">
                        <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                Welcome to the Network!
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Your account has been created. Please check your email to verify your account, then you can sign in.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block w-full py-3 bg-nn-blue text-white rounded-xl font-semibold hover:bg-nn-blue-light transition-colors"
                            >
                                Go to Sign In
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

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
                            Join the<br />Network.
                        </h1>
                        <p className="text-nn-cream/90 text-lg">
                            Create an account to access resources
                        </p>
                    </div>

                    {/* Signup Form */}
                    <div className="bg-white rounded-2xl p-8 shadow-xl">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}

                            <div>
                                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="fullName"
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Your name"
                                        required
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nn-blue focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

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
                                        minLength={6}
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nn-blue focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nn-blue focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-nn-red text-white rounded-xl font-semibold hover:bg-nn-red-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-600">
                                Already have an account?{' '}
                                <Link href="/login" className="text-nn-blue font-semibold hover:underline">
                                    Sign in
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
