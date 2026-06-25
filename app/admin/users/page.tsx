'use client';

/**
 * app/admin/users/page.tsx
 *
 * Admin Users panel. Two groups: "Admin User" (role=admin) and "User"
 * (role=navigator). Create writes the DB row AND a Cognito login in one step
 * (temp password Slcm!1234, no email). Remove deletes the row and disables the
 * Cognito login. You cannot demote or remove your own account.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
    Users, UserPlus, Plus, Loader2, Search, X, Save, Edit3, Trash2,
    CheckCircle2, AlertCircle, ShieldCheck, KeyRound,
} from 'lucide-react';
import { USER_ROLES, roleLabel } from '@/lib/users-admin';

interface UserRow {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    role: string;
    has_login: boolean;
    last_login_at: string | null;
    created_at: string;
}

const roleBadgeClass = (role: string) =>
    role === 'admin'
        ? 'bg-[#2E4A8E]/10 text-[#2E4A8E]'
        : 'bg-gray-100 text-gray-600';

export default function AdminUsersPage() {
    const { data: session } = useSession();
    const myEmail = (session?.user?.email || '').toLowerCase();

    const [users, setUsers] = useState<UserRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'navigator'>('all');

    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', role: 'navigator' });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ first_name: string; last_name: string; role: string }>({
        first_name: '', last_name: '', role: 'navigator',
    });

    const flashSuccess = (msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 6000);
    };

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/users');
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || `Error ${res.status}`);
                setUsers([]);
                return;
            }
            setUsers(data.users || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCreate() {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to create user');
                return;
            }
            setShowCreate(false);
            setNewUser({ first_name: '', last_name: '', email: '', role: 'navigator' });
            {
                const name = `${data.user.first_name} ${data.user.last_name}`.trim();
                const emailNote = data.email_sent
                    ? ` A welcome email with their login details was sent to ${data.user.email}.`
                    : ` ⚠️ The welcome email could not be sent${data.email_error ? ` (${data.email_error})` : ''} — share the login details manually.`;
                flashSuccess(
                    (data.cognito?.status === 'already_exists'
                        ? `${name} added — an existing Cognito login was linked.`
                        : `${name} created. Temporary password: Slcm!1234 (they'll set their own on first login).`) + emailNote
                );
            }
            load();
        } catch (e: any) {
            setError(e?.message || 'Failed to create user');
        } finally {
            setSaving(false);
        }
    }

    function startEdit(u: UserRow) {
        setEditingId(u.id);
        setEditForm({
            first_name: u.first_name || '',
            last_name: u.last_name || '',
            role: u.role,
        });
    }

    async function handleUpdate() {
        if (!editingId) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/users/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to update user');
                return;
            }
            setEditingId(null);
            flashSuccess('User updated.');
            load();
        } catch (e: any) {
            setError(e?.message || 'Failed to update user');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(u: UserRow) {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
        if (!confirm(`Remove ${name}? This deletes their record and disables their login. This cannot be undone.`)) {
            return;
        }
        setError(null);
        try {
            const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || 'Failed to remove user');
                return;
            }
            flashSuccess(`${name} removed.`);
            load();
        } catch (e: any) {
            setError(e?.message || 'Failed to remove user');
        }
    }

    const filtered = users.filter(u => {
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        const hay = `${u.first_name || ''} ${u.last_name || ''} ${u.email}`.toLowerCase();
        const matchSearch = !search || hay.includes(search.toLowerCase());
        return matchRole && matchSearch;
    });

    const adminCount = users.filter(u => u.role === 'admin').length;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Users</h2>
                    <p className="text-sm text-gray-500">
                        {isLoading ? 'Loading...' : `${users.length} user${users.length === 1 ? '' : 's'} • ${adminCount} admin`}
                    </p>
                </div>
                <button
                    onClick={() => { setShowCreate(v => !v); setError(null); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73] font-medium"
                >
                    <UserPlus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="flex-1 text-sm text-red-700">{error}</p>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="flex-1 text-sm text-green-800">{success}</p>
                    <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Create form */}
            {showCreate && (
                <div className="bg-white rounded-xl border-2 border-[#2E4A8E]/20 p-5 mb-5">
                    <h3 className="font-semibold text-gray-900 mb-4">New User</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Field label="First name *">
                            <input
                                value={newUser.first_name}
                                onChange={e => setNewUser(p => ({ ...p, first_name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                placeholder="Jane"
                            />
                        </Field>
                        <Field label="Last name *">
                            <input
                                value={newUser.last_name}
                                onChange={e => setNewUser(p => ({ ...p, last_name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                placeholder="Doe"
                            />
                        </Field>
                        <Field label="Email *">
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                                placeholder="jane@slcm.org"
                            />
                        </Field>
                        <Field label="Role">
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            >
                                {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </Field>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                        <KeyRound className="w-3.5 h-3.5" />
                        A Cognito login is created automatically with temp password <code className="font-mono text-gray-700">Slcm!1234</code> — no email is sent.
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={saving || !newUser.first_name || !newUser.last_name || !newUser.email}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E4A8E] text-white rounded-lg text-sm font-medium hover:bg-[#243d73] disabled:opacity-40"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Create User
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Name or email..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Group</label>
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                        <option value="all">All groups</option>
                        <option value="admin">Admin Users</option>
                        <option value="navigator">Users</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <Th>User</Th>
                            <Th className="w-40">Group</Th>
                            <Th className="w-44">Login</Th>
                            <Th className="w-44 text-right">Actions</Th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {isLoading ? (
                            <tr><td colSpan={4} className="text-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-12 text-gray-500">
                                No users match these filters.
                            </td></tr>
                        ) : (
                            filtered.map(u => {
                                const isEditing = editingId === u.id;
                                const isSelf = !!myEmail && u.email.toLowerCase() === myEmail;
                                return (
                                    <tr key={u.id} className={isEditing ? 'bg-[#2E4A8E]/5' : 'hover:bg-gray-50'}>
                                        <Td>
                                            {isEditing ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        value={editForm.first_name}
                                                        onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))}
                                                        className="w-28 px-2 py-1.5 border border-gray-200 rounded text-sm"
                                                        placeholder="First"
                                                    />
                                                    <input
                                                        value={editForm.last_name}
                                                        onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))}
                                                        className="w-28 px-2 py-1.5 border border-gray-200 rounded text-sm"
                                                        placeholder="Last"
                                                    />
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                                                        {`${u.first_name || ''} ${u.last_name || ''}`.trim() || <span className="text-gray-400 italic">No name</span>}
                                                        {isSelf && <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">You</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-500">{u.email}</div>
                                                </div>
                                            )}
                                        </Td>
                                        <Td>
                                            {isEditing ? (
                                                <select
                                                    value={editForm.role}
                                                    onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                                                    disabled={isSelf}
                                                    title={isSelf ? "You can't change your own group" : undefined}
                                                    className="px-2 py-1.5 border border-gray-200 rounded text-sm disabled:bg-gray-50 disabled:text-gray-400"
                                                >
                                                    {USER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(u.role)}`}>
                                                    {u.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                                                    {roleLabel(u.role)}
                                                </span>
                                            )}
                                        </Td>
                                        <Td>
                                            {u.has_login ? (
                                                <span className="text-xs text-gray-600">
                                                    {u.last_login_at
                                                        ? `Last login ${formatRelative(u.last_login_at)}`
                                                        : 'Never signed in'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                                                    <AlertCircle className="w-3 h-3" /> No login
                                                </span>
                                            )}
                                        </Td>
                                        <Td className="text-right">
                                            {isEditing ? (
                                                <div className="flex gap-1 justify-end">
                                                    <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50">
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleUpdate}
                                                        disabled={saving}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#30B27A] text-white rounded disabled:opacity-40"
                                                    >
                                                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-3 justify-end">
                                                    <button
                                                        onClick={() => startEdit(u)}
                                                        className="inline-flex items-center gap-1 text-[#2E4A8E] hover:underline text-sm"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(u)}
                                                        disabled={isSelf}
                                                        title={isSelf ? "You can't remove your own account" : undefined}
                                                        className="inline-flex items-center gap-1 text-red-700 hover:underline text-sm disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Remove
                                                    </button>
                                                </div>
                                            )}
                                        </Td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Group legend */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">Groups</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {USER_ROLES.map(r => (
                        <div key={r.value} className="flex items-start gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${roleBadgeClass(r.value)}`}>{r.label}</span>
                            <span className="text-xs text-gray-500">{r.description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            {children}
        </div>
    );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <th className={`text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
