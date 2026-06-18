/**
 * lib/users-admin.ts
 *
 * Canonical role vocabulary + validation for the admin Users panel. Two groups:
 *   - 'admin'     → "Admin User"  (full access to the admin console)
 *   - 'navigator' → "User"        (standard app user, no admin console)
 *
 * The DB `users.role` column stores the raw role; the UI shows the label.
 * Imported by /api/admin/users routes and app/admin/users/page.tsx.
 */

export const USER_ROLES = [
    { value: 'admin',     label: 'Admin User', description: 'Full access to the admin console' },
    { value: 'navigator', label: 'User',       description: 'Standard app user — no admin console' },
] as const;

export type UserRoleValue = typeof USER_ROLES[number]['value'];

const VALID_ROLES = new Set<string>(USER_ROLES.map(r => r.value));

export function isValidRole(v: unknown): v is UserRoleValue {
    return typeof v === 'string' && VALID_ROLES.has(v);
}

export function roleLabel(value: string): string {
    return USER_ROLES.find(r => r.value === value)?.label ?? value;
}

export interface NewUserSubmission {
    email: string;
    first_name: string;
    last_name: string;
    role: UserRoleValue;
}

export interface UserFieldError {
    field: string;
    message: string;
}

/** Validate + normalize the create-user payload (email lowercased, names trimmed). */
export function validateNewUser(
    raw: Record<string, unknown>
): { data: NewUserSubmission | null; errors: UserFieldError[] } {
    const errors: UserFieldError[] = [];

    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
    if (!email) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!email.includes('@') || email.length > 320) {
        errors.push({ field: 'email', message: 'Email looks malformed' });
    }

    const first_name = typeof raw.first_name === 'string' ? raw.first_name.trim() : '';
    if (!first_name) errors.push({ field: 'first_name', message: 'First name is required' });

    const last_name = typeof raw.last_name === 'string' ? raw.last_name.trim() : '';
    if (!last_name) errors.push({ field: 'last_name', message: 'Last name is required' });

    // Default to the lower-privilege role when none/invalid is supplied.
    const role: UserRoleValue = isValidRole(raw.role) ? raw.role : 'navigator';

    if (errors.length) return { data: null, errors };
    return { data: { email, first_name, last_name, role }, errors: [] };
}
