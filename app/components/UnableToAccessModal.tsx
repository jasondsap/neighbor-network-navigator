'use client';

/**
 * app/components/UnableToAccessModal.tsx
 *
 * Structured access-barriers report modal. 7 main questions, some with
 * conditional sub-questions (Q2 only shows if Q1 includes 'waitlist', Q7's
 * "where?" only shows if "yes"). Uses createPortal to escape parent modal
 * containing blocks (same pattern as FlagResourceModal).
 *
 * Parent usage:
 *   <UnableToAccessButton resourceId={r.id} resourceName={r.organization_name} />
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    AlertTriangle, X, Loader2, AlertCircle, CheckCircle2, Send,
} from 'lucide-react';
import {
    BARRIER_OPTIONS,
    ATTEMPT_METHODS,
    ATTEMPT_COUNT_OPTIONS,
    FINAL_OUTCOMES,
    IMPROVEMENT_OPTIONS,
    YES_NO_UNSURE,
    YES_NO_UNKNOWN,
} from '@/lib/access-reports';

interface Props {
    resourceId: string;
    resourceName: string;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

function emptyForm() {
    return {
        barriers: [] as string[],
        barriers_other: '',
        waitlist_time_given: null as boolean | null,
        waitlist_estimate: '',
        waitlist_client_added: '' as '' | 'yes' | 'no' | 'unsure',
        attempt_methods: [] as string[],
        attempt_count: '',
        final_outcome: '',
        improvements: [] as string[],
        improvements_other: '',
        similar_accessed: '' as '' | 'yes' | 'no' | 'unknown',
        similar_where: '',
        additional_notes: '',
    };
}

export function UnableToAccessModal({
    resourceId, resourceName, open, onClose, onSuccess,
}: Props) {
    const [form, setForm] = useState(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [succeeded, setSucceeded] = useState(false);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (open) {
            setForm(emptyForm());
            setError(null);
            setSucceeded(false);
        }
    }, [open, resourceId]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, isSubmitting, onClose]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open || !mounted) return null;

    // ----- Handlers -----
    function toggle(list: string[], value: string): string[] {
        return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (form.barriers.length === 0) {
            setError('Please select at least one issue you ran into (question 1).');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/access-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resource_id: resourceId,
                    barriers: form.barriers,
                    barriers_other: form.barriers_other.trim() || null,
                    waitlist_time_given: form.waitlist_time_given,
                    waitlist_estimate: form.waitlist_estimate.trim() || null,
                    waitlist_client_added: form.waitlist_client_added || null,
                    attempt_methods: form.attempt_methods,
                    attempt_count: form.attempt_count || null,
                    final_outcome: form.final_outcome || null,
                    improvements: form.improvements,
                    improvements_other: form.improvements_other.trim() || null,
                    similar_accessed: form.similar_accessed || null,
                    similar_where: form.similar_where.trim() || null,
                    additional_notes: form.additional_notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || `Error ${res.status}`);
                return;
            }
            setSucceeded(true);
            onSuccess?.();
            setTimeout(() => onClose(), 1500);
        } catch (err: any) {
            setError(err?.message || 'Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    }

    const showWaitlistSection = form.barriers.includes('waitlist');
    const showBarriersOther   = form.barriers.includes('other');
    const showImprovementsOther = form.improvements.includes('other');
    const showSimilarWhere    = form.similar_accessed === 'yes';

    const modalJsx = (
        <div
            className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
            onClick={() => !isSubmitting && onClose()}
        >
            <div
                className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#C0392B]/10 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-[#C0392B]" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="font-bold text-gray-900">Unable to access this resource?</h2>
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

                {succeeded ? (
                    <div className="p-10 text-center">
                        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">Thank you</h3>
                        <p className="text-sm text-gray-600">
                            Your report has been sent to the SLCM team. It helps us understand
                            what&rsquo;s working and what isn&rsquo;t.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <p className="text-sm text-gray-600 -mt-2">
                            Help SLCM understand where community resources fall short by sharing what happened.
                            Only the first question is required; the rest are optional but valuable.
                        </p>

                        {/* Q1 */}
                        <Question
                            number={1}
                            title="What happened when you or the client attempted to access this resource?"
                            hint="Select all that apply"
                            required
                        >
                            <CheckboxGroup
                                options={BARRIER_OPTIONS.filter(b => b.value !== 'other')}
                                selected={form.barriers}
                                onToggle={v => setForm(f => ({ ...f, barriers: toggle(f.barriers, v) }))}
                            />
                            <label className="flex items-start gap-2 mt-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.barriers.includes('other')}
                                    onChange={() => setForm(f => ({ ...f, barriers: toggle(f.barriers, 'other') }))}
                                    className="mt-0.5"
                                />
                                <span className="text-sm text-gray-700">Other</span>
                            </label>
                            {showBarriersOther && (
                                <input
                                    type="text"
                                    value={form.barriers_other}
                                    onChange={e => setForm(f => ({ ...f, barriers_other: e.target.value }))}
                                    placeholder="Describe the other issue..."
                                    className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                    maxLength={2000}
                                />
                            )}
                        </Question>

                        {/* Q2 — conditional on waitlist */}
                        {showWaitlistSection && (
                            <Question number={2} title="If there was a waitlist:">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Was an estimated wait time provided?
                                        </label>
                                        <div className="flex gap-4 flex-wrap">
                                            <Radio
                                                name="waitlist_time_given"
                                                label="Yes"
                                                checked={form.waitlist_time_given === true}
                                                onChange={() => setForm(f => ({ ...f, waitlist_time_given: true }))}
                                            />
                                            <Radio
                                                name="waitlist_time_given"
                                                label="No"
                                                checked={form.waitlist_time_given === false}
                                                onChange={() => setForm(f => ({ ...f, waitlist_time_given: false, waitlist_estimate: '' }))}
                                            />
                                        </div>
                                        {form.waitlist_time_given === true && (
                                            <input
                                                type="text"
                                                value={form.waitlist_estimate}
                                                onChange={e => setForm(f => ({ ...f, waitlist_estimate: e.target.value }))}
                                                placeholder="e.g. 3 weeks, 2 months"
                                                className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                                maxLength={200}
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Was the client added to the waitlist?
                                        </label>
                                        <div className="flex gap-4 flex-wrap">
                                            {YES_NO_UNSURE.map(opt => (
                                                <Radio
                                                    key={opt.value}
                                                    name="waitlist_client_added"
                                                    label={opt.label}
                                                    checked={form.waitlist_client_added === opt.value}
                                                    onChange={() => setForm(f => ({ ...f, waitlist_client_added: opt.value }))}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Question>
                        )}

                        {/* Q3 */}
                        <Question
                            number={3}
                            title="How was access attempted?"
                            hint="Select all that apply"
                        >
                            <CheckboxGroup
                                options={ATTEMPT_METHODS}
                                selected={form.attempt_methods}
                                onToggle={v => setForm(f => ({ ...f, attempt_methods: toggle(f.attempt_methods, v) }))}
                            />
                        </Question>

                        {/* Q4 */}
                        <Question number={4} title="How many attempts were made before access was unsuccessful?">
                            <div className="flex flex-col gap-2">
                                {ATTEMPT_COUNT_OPTIONS.map(opt => (
                                    <Radio
                                        key={opt.value}
                                        name="attempt_count"
                                        label={opt.label}
                                        checked={form.attempt_count === opt.value}
                                        onChange={() => setForm(f => ({ ...f, attempt_count: opt.value }))}
                                    />
                                ))}
                            </div>
                        </Question>

                        {/* Q5 */}
                        <Question number={5} title="What was the final outcome of this attempt?">
                            <div className="flex flex-col gap-2">
                                {FINAL_OUTCOMES.map(opt => (
                                    <Radio
                                        key={opt.value}
                                        name="final_outcome"
                                        label={opt.label}
                                        checked={form.final_outcome === opt.value}
                                        onChange={() => setForm(f => ({ ...f, final_outcome: opt.value }))}
                                    />
                                ))}
                            </div>
                        </Question>

                        {/* Q6 */}
                        <Question
                            number={6}
                            title="What would have improved the likelihood of a successful connection?"
                            hint="Select all that apply"
                        >
                            <CheckboxGroup
                                options={IMPROVEMENT_OPTIONS.filter(i => i.value !== 'other')}
                                selected={form.improvements}
                                onToggle={v => setForm(f => ({ ...f, improvements: toggle(f.improvements, v) }))}
                            />
                            <label className="flex items-start gap-2 mt-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.improvements.includes('other')}
                                    onChange={() => setForm(f => ({ ...f, improvements: toggle(f.improvements, 'other') }))}
                                    className="mt-0.5"
                                />
                                <span className="text-sm text-gray-700">Other</span>
                            </label>
                            {showImprovementsOther && (
                                <input
                                    type="text"
                                    value={form.improvements_other}
                                    onChange={e => setForm(f => ({ ...f, improvements_other: e.target.value }))}
                                    placeholder="Describe..."
                                    className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                    maxLength={2000}
                                />
                            )}
                        </Question>

                        {/* Q7 */}
                        <Question number={7} title="Was the client able to access a similar resource elsewhere?">
                            <div className="flex gap-4 flex-wrap">
                                {YES_NO_UNKNOWN.map(opt => (
                                    <Radio
                                        key={opt.value}
                                        name="similar_accessed"
                                        label={opt.label}
                                        checked={form.similar_accessed === opt.value}
                                        onChange={() => setForm(f => ({ ...f, similar_accessed: opt.value }))}
                                    />
                                ))}
                            </div>
                            {showSimilarWhere && (
                                <input
                                    type="text"
                                    value={form.similar_where}
                                    onChange={e => setForm(f => ({ ...f, similar_where: e.target.value }))}
                                    placeholder="Where? (name or type of resource)"
                                    className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                    maxLength={500}
                                />
                            )}
                        </Question>

                        {/* Q8 */}
                        <Question number={8} title="Anything else that would help us understand this barrier?">
                            <textarea
                                value={form.additional_notes}
                                onChange={e => setForm(f => ({ ...f, additional_notes: e.target.value }))}
                                rows={3}
                                maxLength={4000}
                                placeholder="Optional: context, details, or observations"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                            />
                        </Question>

                        <div className="pt-4 flex gap-2 justify-end border-t border-gray-100">
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
                                disabled={isSubmitting || form.barriers.length === 0}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#C0392B] text-white rounded-lg hover:bg-[#9f2f24] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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

    return createPortal(modalJsx, document.body);
}

// ============================================================================
// Subcomponents
// ============================================================================
function Question({
    number, title, hint, required, children,
}: {
    number: number;
    title: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-2">
                <p className="font-medium text-gray-900">
                    <span className="text-gray-400 mr-2">{number}.</span>
                    {title}
                    {required && <span className="text-red-600 ml-1">*</span>}
                </p>
                {hint && <p className="text-xs text-gray-500 mt-0.5 ml-6">{hint}</p>}
            </div>
            <div className="ml-6">{children}</div>
        </div>
    );
}

function CheckboxGroup({
    options, selected, onToggle,
}: {
    options: readonly { value: string; label: string }[];
    selected: string[];
    onToggle: (v: string) => void;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            {options.map(opt => (
                <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={selected.includes(opt.value)}
                        onChange={() => onToggle(opt.value)}
                        className="mt-0.5"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
            ))}
        </div>
    );
}

function Radio({
    name, label, checked, onChange,
}: {
    name: string;
    label: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
            />
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    );
}

// ============================================================================
// Convenience button wrapper
// ============================================================================
export function UnableToAccessButton({
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B] hover:bg-[#C0392B]/10 hover:border-[#C0392B]/60 transition-all ${className}`}
                title="Report that you couldn't access this resource"
            >
                <AlertTriangle className="w-4 h-4" />
                Unable to access
            </button>
            <UnableToAccessModal
                resourceId={resourceId}
                resourceName={resourceName}
                open={open}
                onClose={() => setOpen(false)}
            />
        </>
    );
}
