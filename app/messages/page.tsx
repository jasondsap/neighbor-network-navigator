'use client';

/**
 * app/messages/page.tsx
 *
 * Channels + direct messages with @-mentions (users and resources).
 * Three-pane layout ported/adapted from the DDOR platform. Polling-based
 * (messages 15s, channel list on send) — no websockets.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Hash, Lock, MessageSquare, Plus, Send, ArrowLeft, X, Trash2, Loader2, Users,
} from 'lucide-react';
import { MentionTextarea } from '@/app/components/MentionTextarea';
import { NotificationBell } from '@/app/components/NotificationBell';
import { parseMentions, renderMentions, type MentionSuggestion } from '@/lib/mentions';
import { timeAgo } from '@/lib/time';

interface UserRow { id: string; first_name: string | null; last_name: string | null; display_name: string | null; email: string; role: string; }
interface Channel {
    id: string; name: string; channel_type: string; description: string | null;
    is_private: boolean; created_by: string | null; unread_count: string;
    dm_partner: { id: string; name: string } | null;
}
interface Msg { id: string; sender_id: string; body: string; created_at: string; sender_name: string; }

function userName(u: UserRow) {
    return (u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email).trim();
}
function channelLabel(c: Channel) {
    return c.channel_type === 'dm' ? (c.dm_partner?.name || 'Direct Message') : c.name;
}

function MessagesInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [channels, setChannels] = useState<Channel[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);

    const [showNewChannel, setShowNewChannel] = useState(false);
    const [showNewDM, setShowNewDM] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const loadChannels = useCallback(async () => {
        const d = await fetch('/api/channels').then((r) => r.json());
        setChannels(d.channels || []);
        setUsers(d.users || []);
        setCurrentUserId(d.currentUserId || null);
        return d.channels as Channel[];
    }, []);

    const loadMessages = useCallback(async (channelId: string) => {
        const d = await fetch(`/api/channels/${channelId}/messages`).then((r) => r.json());
        setMessages(d.messages || []);
    }, []);

    const selectChannel = useCallback((channelId: string) => {
        setActiveId(channelId);
        setMessages([]);
        loadMessages(channelId);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(() => loadMessages(channelId), 15000);
    }, [loadMessages]);

    // initial load
    useEffect(() => {
        (async () => {
            const chs = await loadChannels();
            const wanted = searchParams.get('channel');
            if (wanted && chs.some((c) => c.id === wanted)) selectChannel(wanted);
            else if (chs.length) selectChannel(chs[0].id);
        })();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // react to ?channel= changes (e.g. clicking a notification while already here)
    useEffect(() => {
        const wanted = searchParams.get('channel');
        if (wanted && wanted !== activeId) selectChannel(wanted);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // @-mention suggestions: users (in memory) + resources (live search)
    const getSuggestions = useCallback(async (q: string): Promise<MentionSuggestion[]> => {
        const ql = q.toLowerCase();
        const userMatches: MentionSuggestion[] = users
            .filter((u) => u.id !== currentUserId)
            .map((u) => ({ type: 'user' as const, id: u.id, name: userName(u), subtitle: (u.role || '').replace('_', ' ') }))
            .filter((u) => !ql || u.name.toLowerCase().includes(ql))
            .slice(0, 5);

        let resourceMatches: MentionSuggestion[] = [];
        if (q.length >= 1) {
            try {
                const d = await fetch(`/api/resources/mention-search?q=${encodeURIComponent(q)}`).then((r) => r.json());
                resourceMatches = (d.results || []).map((r: any) => ({ type: 'resource' as const, id: r.id, name: r.name, subtitle: r.subtitle || '' }));
            } catch { /* ignore */ }
        }
        return [...userMatches, ...resourceMatches].slice(0, 10);
    }, [users, currentUserId]);

    async function send() {
        const text = draft.trim();
        if (!text || !activeId || sending) return;
        setSending(true);
        try {
            const mentions = parseMentions(text);
            await fetch(`/api/channels/${activeId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: text, mentions }),
            });
            setDraft('');
            await loadMessages(activeId);
            loadChannels();
        } finally {
            setSending(false);
        }
    }

    async function deleteMessage(id: string) {
        if (!activeId || !confirm('Delete this message?')) return;
        await fetch(`/api/channels/${activeId}/messages?messageId=${id}`, { method: 'DELETE' });
        loadMessages(activeId);
    }

    const groupChannels = channels.filter((c) => c.channel_type !== 'dm');
    const dmChannels = channels.filter((c) => c.channel_type === 'dm');
    const active = channels.find((c) => c.id === activeId) || null;

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* top bar */}
            <header className="bg-[#2E4A8E] text-white flex items-center justify-between px-4 py-3 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/')} className="p-1.5 rounded-lg hover:bg-white/10" title="Back to app">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="font-bold text-lg">Messages</h1>
                </div>
                <NotificationBell />
            </header>

            <div className="flex-1 flex min-h-0">
                {/* channel rail */}
                <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
                    <div className="p-3 flex gap-2">
                        <button onClick={() => setShowNewChannel(true)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-[#2E4A8E] text-white rounded-lg hover:bg-[#243d73]">
                            <Plus className="w-3.5 h-3.5" /> Channel
                        </button>
                        <button onClick={() => setShowNewDM(true)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            <Plus className="w-3.5 h-3.5" /> DM
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 pb-3">
                        <div className="text-[11px] font-semibold uppercase text-gray-400 px-2 mt-2 mb-1">Channels</div>
                        {groupChannels.map((c) => <ChannelRow key={c.id} c={c} active={activeId === c.id} onClick={() => selectChannel(c.id)} />)}
                        {groupChannels.length === 0 && <p className="px-2 text-xs text-gray-400">No channels yet.</p>}
                        <div className="text-[11px] font-semibold uppercase text-gray-400 px-2 mt-4 mb-1">Direct Messages</div>
                        {dmChannels.map((c) => <ChannelRow key={c.id} c={c} active={activeId === c.id} onClick={() => selectChannel(c.id)} />)}
                        {dmChannels.length === 0 && <p className="px-2 text-xs text-gray-400">No direct messages.</p>}
                    </div>
                </aside>

                {/* thread */}
                <main className="flex-1 flex flex-col min-w-0">
                    {active ? (
                        <>
                            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-2 shrink-0">
                                {active.channel_type === 'dm' ? <MessageSquare className="w-4 h-4 text-gray-400" /> : active.is_private ? <Lock className="w-4 h-4 text-gray-400" /> : <Hash className="w-4 h-4 text-gray-400" />}
                                <span className="font-semibold text-gray-900">{channelLabel(active)}</span>
                                {active.description && <span className="text-sm text-gray-400 truncate">— {active.description}</span>}
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                                {messages.map((m) => (
                                    <div key={m.id} className="group flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#2E4A8E]/10 text-[#2E4A8E] flex items-center justify-center text-xs font-semibold shrink-0">
                                            {(m.sender_name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-900">{m.sender_name}</span>
                                                <span className="text-[11px] text-gray-400">{timeAgo(m.created_at)}</span>
                                                {m.sender_id === currentUserId && (
                                                    <button onClick={() => deleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#8B2332]" title="Delete">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-700 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: renderMentions(m.body) }} />
                                        </div>
                                    </div>
                                ))}
                                {messages.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No messages yet. Say hello!</p>}
                                <div ref={endRef} />
                            </div>

                            <div className="p-3 border-t border-gray-200 bg-white flex items-end gap-2 shrink-0">
                                <MentionTextarea value={draft} onChange={setDraft} getSuggestions={getSuggestions} onSubmit={send} disabled={sending} />
                                <button onClick={send} disabled={sending || !draft.trim()} className="p-2.5 bg-[#2E4A8E] text-white rounded-xl hover:bg-[#243d73] disabled:opacity-40">
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">Select a channel to start messaging.</div>
                    )}
                </main>
            </div>

            {showNewChannel && (
                <NewChannelModal
                    users={users.filter((u) => u.id !== currentUserId)}
                    onClose={() => setShowNewChannel(false)}
                    onCreated={async (id) => { setShowNewChannel(false); await loadChannels(); selectChannel(id); }}
                />
            )}
            {showNewDM && (
                <NewDMModal
                    users={users.filter((u) => u.id !== currentUserId)}
                    onClose={() => setShowNewDM(false)}
                    onCreated={async (id) => { setShowNewDM(false); await loadChannels(); selectChannel(id); }}
                />
            )}
        </div>
    );
}

function ChannelRow({ c, active, onClick }: { c: Channel; active: boolean; onClick: () => void }) {
    const unread = Number(c.unread_count || 0);
    const Icon = c.channel_type === 'dm' ? MessageSquare : c.is_private ? Lock : Hash;
    return (
        <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${active ? 'bg-[#2E4A8E] text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-gray-400'}`} />
            <span className="flex-1 truncate text-left">{channelLabel(c)}</span>
            {unread > 0 && <span className="min-w-[18px] h-[18px] px-1 bg-[#8B2332] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
        </button>
    );
}

function NewChannelModal({ users, onClose, onCreated }: { users: UserRow[]; onClose: () => void; onCreated: (id: string) => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function create() {
        setBusy(true); setError(null);
        try {
            const res = await fetch('/api/channels', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, is_private: isPrivate, member_ids: isPrivate ? memberIds : [] }),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error || 'Failed to create channel'); return; }
            onCreated(d.channel.id);
        } finally { setBusy(false); }
    }

    return (
        <Modal title="New channel" onClose={onClose}>
            <input className={INPUT} placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={INPUT} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private (invite-only)
            </label>
            {isPrivate && (
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {users.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={memberIds.includes(u.id)}
                                onChange={(e) => setMemberIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id))} />
                            {userName(u)}
                        </label>
                    ))}
                </div>
            )}
            {error && <p className="text-sm text-[#8B2332]">{error}</p>}
            <ModalActions onClose={onClose} onConfirm={create} busy={busy} disabled={!name.trim()} confirmLabel="Create" />
        </Modal>
    );
}

function NewDMModal({ users, onClose, onCreated }: { users: UserRow[]; onClose: () => void; onCreated: (id: string) => void }) {
    const [busy, setBusy] = useState(false);
    const [q, setQ] = useState('');
    async function start(uid: string) {
        setBusy(true);
        try {
            const res = await fetch('/api/channels', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_type: 'dm', dm_target_id: uid }),
            });
            const d = await res.json();
            if (res.ok) onCreated(d.channel.id);
        } finally { setBusy(false); }
    }
    const filtered = users.filter((u) => userName(u).toLowerCase().includes(q.toLowerCase()));
    return (
        <Modal title="New direct message" onClose={onClose}>
            <input className={INPUT} placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-60 overflow-y-auto -mx-1">
                {filtered.map((u) => (
                    <button key={u.id} disabled={busy} onClick={() => start(u.id)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 text-left text-sm">
                        <Users className="w-4 h-4 text-gray-400" /> {userName(u)}
                    </button>
                ))}
                {filtered.length === 0 && <p className="px-2 py-3 text-sm text-gray-400">No matches.</p>}
            </div>
        </Modal>
    );
}

const INPUT = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent text-sm';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ModalActions({ onClose, onConfirm, busy, disabled, confirmLabel }: { onClose: () => void; onConfirm: () => void; busy: boolean; disabled?: boolean; confirmLabel: string }) {
    return (
        <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={onConfirm} disabled={busy || disabled} className="px-4 py-2 bg-[#2E4A8E] text-white rounded-lg text-sm hover:bg-[#243d73] disabled:opacity-50 flex items-center gap-1">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
            </button>
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
            <MessagesInner />
        </Suspense>
    );
}
