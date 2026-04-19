'use client';

/**
 * app/admin/resources/new/page.tsx
 *
 * Create a new resource.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ResourceForm, EMPTY_FORM, type FieldError } from '../components/ResourceForm';

export default function NewResourcePage() {
    const router = useRouter();

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
                <h2 className="text-2xl font-bold text-gray-900">New Resource</h2>
                <p className="text-sm text-gray-500">
                    Add a community resource to the database.
                </p>
            </div>

            <ResourceForm
                mode="create"
                initial={EMPTY_FORM}
                onCancel={() => router.push('/admin/resources')}
                onSubmit={async payload => {
                    const res = await fetch('/api/admin/resources', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        return {
                            success: false as const,
                            error: data.error || 'Failed to create',
                            fieldErrors: data.fieldErrors as FieldError[] | undefined,
                        };
                    }
                    router.push(`/admin/resources/${data.resource.id}`);
                    return { success: true as const };
                }}
            />
        </div>
    );
}
