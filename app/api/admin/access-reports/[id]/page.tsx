'use client';

/**
 * app/admin/access-reports/[id]/page.tsx
 *
 * Full detail of a single access report. Shows every answer the navigator
 * provided, the resource context, and admin actions to move the report
 * through Open → Reviewed → Addressed → Archived (with required notes).
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    AlertTriangle, Loader2, ArrowLeft, Edit3, User, Clock, Mail,
    Eye, CheckCircle2, Archive, Undo2, AlertCircle, ExternalLink,
} from 'lucide-react';
import {
    barrierLabel, attemptMethodLabel, attemptCountLabel,
    finalOutcomeLabel, improvementLabel,
    accessStatusLabel, accessStatusColor,
} from '@/lib/access-reports';

interface ReportDetail {
    id: string;
    status: 'open' | 'reviewed' | 'addressed' | 'archived';
    created_at: string;
    updated_at: string;
    admin_notes: string | null;
    status_changed_at: string | null;
    status_changer_name: string | null;

    barriers: string[];
    barriers_other: string | null;

    waitlist_time_given: boolean | null;
    waitlist_estimate: string | null;
    waitlist_client_added: string | null;

    attempt_methods: string[];
    attempt_count: string | null;
    final_outcome: string | null;

    improvements: string[];
    improvements_other: string | null;

    similar_accessed: string | null;
    similar_where: string | null;

    additional_notes: string | null;

    resource_id: string;
    resource_name: string;
    resource_program_name: string | null;
    resource_category: string;
    resource_subcategory: string | null;
    resource_phone: string | null;
    resource_email: string | null;
    resource_website: string | null;
    resource_address: string | null;
    resource_hours: string | null;
    resource_is_active: boolean;

    reporter_name: string | null;
    reporter_email: string | null;
}

export default function AdminAccessReportDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [report, setReport] = useState<ReportDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/access-reports/${id}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || `Error ${res.status}`);
                return;
            }
            setReport(data.report);
        } catch (e: any) {
            setError(e?.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    async function transition(nextStatus: string, friendly: string) {
        const note = prompt(
            `${friendly}\n\nAdd a note for the record (required):`
        );
        if (!note || note.trim().length < 3) {
            if (note !== null) alert('A note of at least 3 characters is required.');
            return;
        }
        try {
            const res = await fetch(`/api/admin/access-reports/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus, admin_notes: note.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Update failed');
                return;
            }
            router.push(`/admin/access-reports?updated=${encodeURIComponent(friendly)}`);
        } catch (e: any) {
            alert(e?.message || 'Update failed');
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                Loading report...
            </div>
        );
    }

    if (error || !report) {
        return (
            <div>
                <Link
                    href="/admin/access-reports"
                    className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to access reports
                </Link>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {error || 'Report not found'}
                </div>
            </div>
        );
    }

    const status = report.status;
    const isOpen      = status === 'open';
    const isReviewed  = status === 'reviewed';
    const isAddressed = status === 'addressed';
    const isArchived  = status === 'archived';

    return (
        <div>
            <Link
                href="/admin/access-reports"
                className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline mb-2"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to access reports
            </Link>

            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-[#C0392B]/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-[#C0392B]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Access Report</h2>
                            <p className="text-sm text-gray-500">Reported {formatDate(report.created_at)}</p>
                        </div>
                    </div>
                </div>
                <StatusPill status={report.status} large />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                <div className="space-y-5">
                    {/* Section: barriers */}
                    <Section title="What happened">
                        {report.barriers.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No barriers specified.</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {report.barriers.map(b => (
                                    <li key={b} className="flex items-start gap-2">
                                        <span className="text-[#C0392B] flex-shrink-0">\u2022</span>
                                        <span className="text-sm text-gray-800">{barrierLabel(b)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {report.barriers_other && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs font-medium text-gray-500 mb-1">Other:</p>
                                <p className="text-sm text-gray-800">{report.barriers_other}</p>
                            </div>
                        )}
                    </Section>

                    {/* Waitlist */}
                    {report.barriers.includes('waitlist') && (
                        <Section title="Waitlist details">
                            <dl className="space-y-2 text-sm">
                                <FieldRow
                                    label="Estimated wait time provided?"
                                    value={
                                        report.waitlist_time_given === null
                                            ? null
                                            : report.waitlist_time_given
                                                ? (report.waitlist_estimate ? `Yes \u2014 ${report.waitlist_estimate}` : 'Yes')
                                                : 'No'
                                    }
                                />
                                <FieldRow
                                    label="Was the client added to the waitlist?"
                                    value={report.waitlist_client_added
                                        ? capitalize(report.waitlist_client_added)
                                        : null}
                                />
                            </dl>
                        </Section>
                    )}

                    {/* Access attempt */}
                    <Section title="Access attempt">
                        <dl className="space-y-2 text-sm">
                            <FieldRow
                                label="How access was attempted"
                                value={report.attempt_methods.length > 0
                                    ? report.attempt_methods.map(m => attemptMethodLabel(m)).join(', ')
                                    : null}
                            />
                            <FieldRow
                                label="Number of attempts"
                                value={report.attempt_count ? attemptCountLabel(report.attempt_count) : null}
                            />
                            <FieldRow
                                label="Final outcome"
                                value={report.final_outcome ? finalOutcomeLabel(report.final_outcome) : null}
                            />
                        </dl>
                    </Section>

                    {/* Improvements */}
                    {(report.improvements.length > 0 || report.improvements_other) && (
                        <Section title="What would have helped">
                            <ul className="space-y-1.5">
                                {report.improvements.map(i => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="text-[#30B27A] flex-shrink-0">\u2713</span>
                                        <span className="text-sm text-gray-800">{improvementLabel(i)}</span>
                                    </li>
                                ))}
                            </ul>
                            {report.improvements_other && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs font-medium text-gray-500 mb-1">Other:</p>
                                    <p className="text-sm text-gray-800">{report.improvements_other}</p>
                                </div>
                            )}
                        </Section>
                    )}

                    {/* Similar resource */}
                    {report.similar_accessed && (
                        <Section title="Similar resource elsewhere">
                            <p className="text-sm text-gray-800">
                                {capitalize(report.similar_accessed)}
                                {report.similar_where && (
                                    <>
                                        {' \u2014 '}
                                        <span className="text-gray-600">{report.similar_where}</span>
                                    </>
                                )}
                            </p>
                        </Section>
                    )}

                    {/* Additional notes */}
                    {report.additional_notes && (
                        <Section title="Additional notes">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.additional_notes}</p>
                        </Section>
                    )}

                    {/* Resource context */}
                    <Section
                        title="Resource"
                        action={
                            <Link
                                href={`/admin/resources/${report.resource_id}`}
                                className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                Edit resource
                            </Link>
                        }
                    >
                        <p className="font-medium text-gray-900 mb-1">
                            {report.resource_name}
                            {!report.resource_is_active && (
                                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                    Archived
                                </span>
                            )}
                        </p>
                        <p className="text-sm text-gray-500 mb-3">
                            {report.resource_category}
                            {report.resource_subcategory ? ` \u2022 ${report.resource_subcategory}` : ''}
                        </p>

                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <FieldRow label="Phone"   value={report.resource_phone} />
                            <FieldRow label="Email"   value={report.resource_email} />
                            <FieldRow
                                label="Website"
                                value={report.resource_website}
                                link={report.resource_website}
                            />
                            <FieldRow label="Hours"   value={report.resource_hours} />
                            <FieldRow label="Address" value={report.resource_address} fullWidth />
                        </dl>
                    </Section>

                    {/* Admin action history */}
                    {(isAddressed || isArchived || isReviewed) && report.admin_notes && (
                        <Section title="Admin notes">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
                                {report.admin_notes}
                            </p>
                            <p className="text-xs text-gray-500">
                                {report.status_changer_name || 'Unknown'}
                                {report.status_changed_at && ` \u2022 ${formatDate(report.status_changed_at)}`}
                            </p>
                        </Section>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="space-y-4">
                    <section className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Reported by
                        </h3>
                        <div className="flex items-start gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-gray-900 font-medium truncate">
                                    {report.reporter_name || '(no name set)'}
                                </p>
                                {report.reporter_email && (
                                    <a
                                        href={`mailto:${report.reporter_email}`}
                                        className="text-xs text-[#2E4A8E] hover:underline inline-flex items-center gap-1 break-all"
                                    >
                                        <Mail className="w-3 h-3" />
                                        {report.reporter_email}
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(report.created_at)}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-200 p-5">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Actions
                        </h3>
                        <div className="space-y-2">
                            {isOpen && (
                                <ActionButton
                                    icon={Eye}
                                    label="Mark as reviewed"
                                    onClick={() => transition('reviewed', 'Marked as reviewed')}
                                />
                            )}
                            {(isOpen || isReviewed) && (
                                <ActionButton
                                    icon={CheckCircle2}
                                    label="Mark as addressed"
                                    variant="primary"
                                    onClick={() => transition('addressed', 'Marked as addressed')}
                                />
                            )}
                            {!isArchived && (
                                <ActionButton
                                    icon={Archive}
                                    label="Archive"
                                    variant="muted"
                                    onClick={() => transition('archived', 'Archived')}
                                />
                            )}
                            {isArchived && (
                                <ActionButton
                                    icon={Undo2}
                                    label="Reopen"
                                    onClick={() => transition('open', 'Reopened')}
                                />
                            )}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

// ============================================================================
// Subcomponents
// ============================================================================
function Section({
    title, action, children,
}: {
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

function FieldRow({
    label, value, fullWidth, link,
}: {
    label: string;
    value: string | null;
    fullWidth?: boolean;
    link?: string | null;
}) {
    return (
        <div className={fullWidth ? 'md:col-span-2' : ''}>
            <dt className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">{label}</dt>
            <dd className={`text-gray-900 ${value ? '' : 'text-gray-400 italic'}`}>
                {value || '\u2014'}
                {link && value && (
                    <a
                        href={link.startsWith('http') ? link : `https://${link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-[#2E4A8E] inline-flex items-center"
                    >
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </dd>
        </div>
    );
}

function ActionButton({
    icon: Icon, label, onClick, variant = 'default',
}: {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'muted';
}) {
    const classes = {
        default: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
        primary: 'bg-[#30B27A] text-white hover:bg-[#26945f]',
        muted:   'border border-gray-200 text-gray-500 hover:bg-gray-50',
    }[variant];

    return (
        <button
            onClick={onClick}
            className={`w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${classes}`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

function StatusPill({ status, large }: { status: string; large?: boolean }) {
    const color = accessStatusColor(status);
    return (
        <span
            className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ${
                large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
            }`}
            style={{ backgroundColor: `${color}20`, color }}
        >
            {accessStatusLabel(status)}
        </span>
    );
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}
