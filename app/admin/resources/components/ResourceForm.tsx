'use client';

/**
 * app/admin/resources/components/ResourceForm.tsx
 *
 * Update log:
 *  - Phase B.2: save feedback (green banner) + dirty tracking
 *  - Phase B.3: smarter "why is save disabled?" hint — specifically calls out
 *               missing summary when form is dirty. Removed auto-scroll since
 *               the parent now navigates away on save.
 */

import { useState, useEffect } from 'react';
import { Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const CATEGORY_OPTIONS = [
    'Adult Education',
    'Basic Needs',
    'Childcare & Parenting',
    'Eviction Prevention',
    'Financial Stability',
    'Food',
    'Health',
    'Homelessness Navigation',
    'Housing Navigation',
    'Human Trafficking',
    'IPV/DV Support',
    'LGBTQ+',
    'Legal Aid',
    'Pregnancy & Postpartum',
    'Relocation & Moving',
    'Transportation',
    'Utilities',
    'Workforce',
];

export interface ResourceFormData {
    organization_name: string;
    program_name: string;
    category: string;
    subcategory: string;
    service_type: string;
    service_description: string;
    capacity: string;
    last_updated_at: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    email: string;
    website: string;
    hours: string;
    point_of_contact: string;
    qualifier_geography: string;
    qualifier_age: string;
    qualifier_income: string;
    qualifier_cohort: string;
    qualifier_misc: string;
    required_documents: string;
    tips_tricks: string;
    notes: string;
}

export const EMPTY_FORM: ResourceFormData = {
    organization_name: '',
    program_name: '',
    category: '',
    subcategory: '',
    service_type: '',
    service_description: '',
    capacity: '',
    last_updated_at: '',
    address: '',
    city: 'Louisville',
    state: 'KY',
    zip: '',
    phone: '',
    email: '',
    website: '',
    hours: '',
    point_of_contact: '',
    qualifier_geography: '',
    qualifier_age: '',
    qualifier_income: '',
    qualifier_cohort: '',
    qualifier_misc: '',
    required_documents: '',
    tips_tricks: '',
    notes: '',
};

export interface FieldError {
    field: string;
    message: string;
}

interface Props {
    mode: 'create' | 'edit';
    initial: ResourceFormData;
    onSubmit: (payload: ResourceFormData & { edit_summary: string }) => Promise<
        { success: true } | { success: false; error: string; fieldErrors?: FieldError[] }
    >;
    onCancel?: () => void;
}

export function ResourceForm({ mode, initial, onSubmit, onCancel }: Props) {
    const [form, setForm] = useState<ResourceFormData>(initial);
    const [editSummary, setEditSummary] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Sync form state when parent re-fetches (rare now that we navigate away on save,
    // but still hit by the rollback-then-reload path).
    useEffect(() => {
        setForm(initial);
        setIsDirty(false);
    }, [initial]);

    function update<K extends keyof ResourceFormData>(key: K, value: string) {
        setForm(f => ({ ...f, [key]: value }));
        setIsDirty(true);
        if (fieldErrors[key]) {
            setFieldErrors(prev => {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!editSummary.trim() || editSummary.trim().length < 3) {
            setError('Edit summary is required (at least 3 characters).');
            return;
        }

        setIsSubmitting(true);
        const result = await onSubmit({ ...form, edit_summary: editSummary.trim() });
        setIsSubmitting(false);

        if (!result.success) {
            setError(result.error);
            if (result.fieldErrors) {
                const asMap: Record<string, string> = {};
                for (const fe of result.fieldErrors) asMap[fe.field] = fe.message;
                setFieldErrors(asMap);
            }
            return;
        }

        // Success — the parent navigates away, so we just clear local state in
        // case the component somehow stays mounted (e.g. parent changed its mind).
        setEditSummary('');
        setIsDirty(false);
    }

    // Save button is enabled only when every prerequisite is satisfied.
    // Ordering matters for the hint below — we show the FIRST unmet condition.
    const summaryOK = editSummary.trim().length >= 3;
    const dirtyOK   = mode === 'create' || isDirty;
    const canSubmit = !isSubmitting && summaryOK && dirtyOK;

    // Progressive hint: tells the user exactly what's blocking save
    let hint: string;
    if (mode === 'edit' && !isDirty) {
        hint = 'Make a change above to enable save.';
    } else if (!summaryOK) {
        hint = isDirty || mode === 'create'
            ? 'Describe what changed (at least 3 characters) to enable save.'
            : 'This note becomes part of the version history.';
    } else {
        hint = 'Ready to save. This note becomes part of the version history.';
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error banner */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-800 text-sm">Couldn&apos;t save</p>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            <Section title="Identity">
                <Field label="Organization Name" required error={fieldErrors.organization_name}>
                    <input
                        type="text"
                        value={form.organization_name}
                        onChange={e => update('organization_name', e.target.value)}
                        className={inputClass(fieldErrors.organization_name)}
                        required
                    />
                </Field>
                <Field label="Program Name">
                    <input
                        type="text"
                        value={form.program_name}
                        onChange={e => update('program_name', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            <Section title="Classification">
                <Field label="Category" required error={fieldErrors.category}>
                    <select
                        value={form.category}
                        onChange={e => update('category', e.target.value)}
                        className={inputClass(fieldErrors.category)}
                        required
                    >
                        <option value="">Select a category...</option>
                        {CATEGORY_OPTIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Subcategory" hint="Free text — groups within the category, e.g. 'Clothing' in Basic Needs">
                    <input
                        type="text"
                        value={form.subcategory}
                        onChange={e => update('subcategory', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Service Type" hint="Short descriptive tag, e.g. 'food pantry', 'case management'">
                    <input
                        type="text"
                        value={form.service_type}
                        onChange={e => update('service_type', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            <Section title="Description">
                <Field label="Service Description" fullWidth>
                    <textarea
                        value={form.service_description}
                        onChange={e => update('service_description', e.target.value)}
                        rows={3}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Capacity" hint="Y / N / ? / or describe">
                    <input
                        type="text"
                        value={form.capacity}
                        onChange={e => update('capacity', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Last Verified" hint="YYYY-MM-DD">
                    <input
                        type="date"
                        value={form.last_updated_at}
                        onChange={e => update('last_updated_at', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            <Section title="Contact">
                <Field label="Phone">
                    <input
                        type="text"
                        value={form.phone}
                        onChange={e => update('phone', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Email" error={fieldErrors.email}>
                    <input
                        type="text"
                        value={form.email}
                        onChange={e => update('email', e.target.value)}
                        className={inputClass(fieldErrors.email)}
                    />
                </Field>
                <Field label="Website" fullWidth>
                    <input
                        type="text"
                        value={form.website}
                        onChange={e => update('website', e.target.value)}
                        className={inputClass()}
                        placeholder="example.org or https://example.org"
                    />
                </Field>
                <Field label="Hours" fullWidth>
                    <input
                        type="text"
                        value={form.hours}
                        onChange={e => update('hours', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Point of Contact" fullWidth>
                    <input
                        type="text"
                        value={form.point_of_contact}
                        onChange={e => update('point_of_contact', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            <Section title="Location">
                <Field label="Address" fullWidth>
                    <input
                        type="text"
                        value={form.address}
                        onChange={e => update('address', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="City">
                    <input
                        type="text"
                        value={form.city}
                        onChange={e => update('city', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="State">
                    <input
                        type="text"
                        value={form.state}
                        onChange={e => update('state', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
                <Field label="ZIP">
                    <input
                        type="text"
                        value={form.zip}
                        onChange={e => update('zip', e.target.value)}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            <Section title="Eligibility">
                <Field label="Geography">
                    <textarea
                        value={form.qualifier_geography}
                        onChange={e => update('qualifier_geography', e.target.value)}
                        rows={2}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Age">
                    <textarea
                        value={form.qualifier_age}
                        onChange={e => update('qualifier_age', e.target.value)}
                        rows={2}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Income">
                    <textarea
                        value={form.qualifier_income}
                        onChange={e => update('qualifier_income', e.target.value)}
                        rows={2}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Cohort" hint="Who this serves (e.g. survivors, veterans)">
                    <textarea
                        value={form.qualifier_cohort}
                        onChange={e => update('qualifier_cohort', e.target.value)}
                        rows={2}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Miscellaneous" fullWidth>
                    <textarea
                        value={form.qualifier_misc}
                        onChange={e => update('qualifier_misc', e.target.value)}
                        rows={2}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            <Section title="Process Guidance">
                <Field label="Required Documents" fullWidth>
                    <textarea
                        value={form.required_documents}
                        onChange={e => update('required_documents', e.target.value)}
                        rows={2}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Tips & Tricks" fullWidth>
                    <textarea
                        value={form.tips_tricks}
                        onChange={e => update('tips_tricks', e.target.value)}
                        rows={3}
                        className={inputClass()}
                    />
                </Field>
                <Field label="Notes" fullWidth>
                    <textarea
                        value={form.notes}
                        onChange={e => update('notes', e.target.value)}
                        rows={3}
                        className={inputClass()}
                    />
                </Field>
            </Section>

            {/* Edit summary — REQUIRED, sticky bottom */}
            <div className="sticky bottom-0 bg-white border-t-2 border-[#2E4A8E] p-5 -mx-6 -mb-6 rounded-b-xl shadow-lg">
                <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                        What changed? <span className="text-red-600">*</span>
                    </label>
                    <input
                        type="text"
                        value={editSummary}
                        onChange={e => setEditSummary(e.target.value)}
                        placeholder={
                            mode === 'create'
                                ? "e.g. 'Added new food pantry referred by partner org'"
                                : "e.g. 'Updated phone number after call', 'New hours for winter'"
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                        required
                        minLength={3}
                        maxLength={500}
                    />
                    <p className={`text-xs mt-1 ${canSubmit ? 'text-green-700' : 'text-gray-500'}`}>
                        {canSubmit && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
                        {hint}
                    </p>
                </div>
                <div className="flex gap-3 justify-end items-center">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : (
                            <><Save className="w-4 h-4" /> {mode === 'create' ? 'Create Resource' : 'Save Changes'}</>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children}
            </div>
        </section>
    );
}

function Field({
    label,
    children,
    required,
    hint,
    error,
    fullWidth,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    hint?: string;
    error?: string;
    fullWidth?: boolean;
}) {
    return (
        <div className={fullWidth ? 'md:col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-600 ml-0.5">*</span>}
            </label>
            {children}
            {hint && !error && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
    );
}

function inputClass(err?: string) {
    return `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
        err
            ? 'border-red-300 focus:ring-red-500'
            : 'border-gray-200 focus:ring-[#2E4A8E]'
    }`;
}
