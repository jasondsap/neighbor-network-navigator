'use client';

/**
 * app/components/FlagResourceModal.tsx
 *
 * Update log:
 *  - Phase C.1: use createPortal so the modal mounts on document.body,
 *               escaping any containing-block-creating parents (backdrop-filter,
 *               transform, etc.) on the resource detail modal.
 *               Also replaced \u2019 / \u2014 escape sequences with the actual
 *               characters — those only work in JS strings, not JSX text.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Flag, X, Loader2, AlertCircle, CheckCircle2, Send
} from 'lucide-react';
import { FLAG_CATEGORIES, type FlagCategoryValue } from '@/lib/flags';

interface Props {
    resourceId: string;
    resourceName: string;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function FlagResourceModal({
    resourceId, resourceName, open, onClose, onSuccess,
}: Props) {
    const [category, setCategory] = useState<FlagCategoryValue | ''>('');
    const [description, setDescription] = useState('');
    const [suggestedCorrection, setSuggestedCorrection] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [succeeded, setSucceeded] = useState(false);

    // Gate portal rendering behind client mount so SSR doesn't try to
    // use document.body (which doesn't exist server-side).
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Reset state each time the modal opens
    useEffect(() => {
        if (open) {
            setCategory('');
            setDescription('');
            setSuggestedCorrection('');
            setError(null);
            setFieldErrors({});
            setSucceeded(false);
        }
    }, [open, resourceId]);

    // Esc key closes the modal (unless mid-submit)
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, isSubmitting, onClose]);

    // Lock scroll on body while modal is open so background doesn't scroll
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open || !mounted) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resource_id: resourceId,
                    category,
                    description: description.trim(),
                    suggested_correction: suggestedCorrection.trim() || null,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || `Error ${res.status}`);
                if (data.fieldErrors) {
                    const asMap: Record<string, string> = {};
                    for (const fe of data.fieldErrors) asMap[fe.field] = fe.message;
                    setFieldErrors(asMap);
                }
                return;
            }

            setSucceeded(true);
            onSuccess?.();
            setTimeout(() => onClose(), 1400);
        } catch (err: any) {
            setError(err?.message || 'Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    }

    const canSubmit = !isSubmitting && category !== '' && description.trim().length >= 5;

    const modalJsx = (
        <div
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => !isSubmitting && onClose()}
        >
            <div
                className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-200">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#E8B84A]/20 flex items-center justify-center flex-shrink-0">
                            <Flag className="w-5 h-5 text-[#b5851a]" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-bold text-gray-900">Report an issue</h2>
                            <p className="text-sm text-gray-500 truncate">{resourceName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                {succeeded ? (
                    <div className="p-8 text-center">
                        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">Thank you</h3>
                        <p className="text-sm text-gray-600">
                            Your report has been sent to SLCM&rsquo;s admin team.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                What&rsquo;s wrong? <span className="text-red-600">*</span>
                            </label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value as FlagCategoryValue)}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                                    fieldErrors.category
                                        ? 'border-red-300 focus:ring-red-500'
                                        : 'border-gray-200 focus:ring-[#2E4A8E]'
                                }`}
                                required
                            >
                                <option value="">Select an issue...</option>
                                {FLAG_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            {fieldErrors.category && (
                                <p className="text-xs text-red-600 mt-1">{fieldErrors.category}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Describe the issue <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={4}
                                placeholder="e.g. Called the number listed and it was disconnected"
                                maxLength={2000}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                                    fieldErrors.description
                                        ? 'border-red-300 focus:ring-red-500'
                                        : 'border-gray-200 focus:ring-[#2E4A8E]'
                                }`}
                                required
                            />
                            {fieldErrors.description && (
                                <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Do you know the correct info?{' '}
                                <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <textarea
                                value={suggestedCorrection}
                                onChange={e => setSuggestedCorrection(e.target.value)}
                                rows={2}
                                placeholder="e.g. The real phone number is 502-555-1234"
                                maxLength={2000}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                If you know the right answer, share it &mdash; it helps the admin team fix it faster.
                            </p>
                        </div>

                        <div className="pt-2 flex gap-2 justify-end border-t border-gray-100">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                                ) : (
                                    <><Send className="w-4 h-4" /> Submit report</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    // Mount onto document.body so the fixed-positioned backdrop covers the
    // whole viewport regardless of where <FlagResourceButton /> is nested.
    return createPortal(modalJsx, document.body);
}

/**
 * FlagResourceButton — small wrapper that keeps modal state local.
 * Drop this into any resource detail view.
 */
export function FlagResourceButton({
    resourceId,
    resourceName,
    className = '',
}: {
    resourceId: string;
    resourceName: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-[#2E4A8E] transition-all ${className}`}
                title="Report an issue with this resource"
            >
                <Flag className="w-4 h-4" />
                Report issue
            </button>
            <FlagResourceModal
                resourceId={resourceId}
                resourceName={resourceName}
                open={open}
                onClose={() => setOpen(false)}
            />
        </>
    );
}
