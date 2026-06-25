'use client';

/**
 * app/admin/resources/[id]/page.tsx
 *
 * Update log:
 *  - Phase B.3: navigate to list on save AND on rollback.
 *               Rollback also uses ?saved=<message> so the list shows a toast.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Archive } from 'lucide-react';
import {
    ResourceForm,
    EMPTY_FORM,
    type ResourceFormData,
    type FieldError,
} from '../components/ResourceForm';
import { VersionHistory, type Version } from '../components/VersionHistory';
import { LinksEditor, type AdminLink } from '../components/LinksEditor';

interface Resource extends ResourceFormData {
    id: string;
    is_active: boolean;
}

export default function EditResourcePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [resource, setResource] = useState<Resource | null>(null);
    const [versions, setVersions] = useState<Version[]>([]);
    const [links, setLinks] = useState<AdminLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const res = await fetch(`/api/admin/resources/${id}`);
            const data = await res.json();
            if (!res.ok) {
                setLoadError(data.error || `Error ${res.status}`);
                return;
            }
            const r = data.resource;
            setResource({
                ...EMPTY_FORM,
                ...Object.fromEntries(
                    Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)])
                ),
                id: r.id,
                is_active: r.is_active,
                last_updated_at: r.last_updated_at
                    ? new Date(r.last_updated_at).toISOString().slice(0, 10)
                    : '',
            } as Resource);
            setVersions(data.versions);
            setLinks(data.links ?? []);
        } catch (e: any) {
            setLoadError(e?.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                Loading resource...
            </div>
        );
    }

    if (loadError) {
        return (
            <div>
                <Link
                    href="/admin/resources"
                    className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to resources
                </Link>
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
                    {loadError}
                </div>
            </div>
        );
    }

    if (!resource) return null;

    const { id: _rid, is_active, ...formData } = resource;
    const orgName = resource.organization_name;

    return (
        <div>
            <div className="mb-6">
                <Link
                    href="/admin/resources"
                    className="inline-flex items-center gap-1 text-sm text-[#2E4A8E] hover:underline mb-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to resources
                </Link>
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {orgName}
                    </h2>
                    {!is_active && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs font-medium">
                            <Archive className="w-3 h-3" />
                            Archived
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-500">
                    Edit resource fields. Every save is versioned.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                <div>
                    <ResourceForm
                        mode="edit"
                        initial={formData as ResourceFormData}
                        onCancel={() => router.push('/admin/resources')}
                        onSubmit={async payload => {
                            const res = await fetch(`/api/admin/resources/${id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                                return {
                                    success: false as const,
                                    error: data.error || 'Failed to save',
                                    fieldErrors: data.fieldErrors as FieldError[] | undefined,
                                };
                            }
                            // Success → bounce to list with a flash message keyed to this resource
                            router.push(`/admin/resources?saved=${encodeURIComponent(orgName)}`);
                            return { success: true as const };
                        }}
                    />
                </div>
                <VersionHistory
                    resourceId={id}
                    versions={versions}
                    onRollbackComplete={(rolledBackTo) => {
                        // After rollback, mirror the save flow — go back to list with a toast
                        const msg = `${orgName} rolled back to version ${rolledBackTo.version_number}`;
                        router.push(`/admin/resources?saved=${encodeURIComponent(msg)}`);
                    }}
                />
            </div>

            <div className="mt-6 max-w-3xl">
                <LinksEditor resourceId={id} initialLinks={links} />
            </div>
        </div>
    );
}
