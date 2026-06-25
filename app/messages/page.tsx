'use client';

/**
 * app/messages/page.tsx
 *
 * Channels + direct messages with @-mentions (users and resources), emoji
 * reactions, message editing, member management, channel edit/archive, and a
 * global message search. Three-pane layout ported/adapted from the DDOR
 * platform. Polling-based (messages 15s, channel list on send) — no websockets.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Hash, Lock, MessageSquare, Plus, Send, ArrowLeft, X, Trash2, Loader2, Users,
    Smile, Pencil, Settings, UserPlus, UserMinus, Search,
} from 'lucide-react';
import { MentionTextarea } from '@/app/components/MentionTextarea';
import { NotificationBell } from '@/app/components/NotificationBell';
import { parseMentions, renderMentions, type MentionSuggestion } from '@/lib/mentions';
import { QUICK_REACTIONS, EMOJI_GROUPS } from '@/lib/emoji';
import { timeAgo } from '@/lib/time';

interface UserRow { id: string; first_name: string | null; last_name: string | null; display_name: string | null; email: string; role: string; }
interface ReactionGroup { emoji: string; count: number; mine: boolean; users: string[]; }
interface Channel {
    id: string; name: string; channel_type: string; description: string | null;
    is_private: boolean; created_by: string | null; unread_count: string; member_count?: string;
    dm_partner: { id: string; name: string } | null;
}
interface Msg { id: string; sender_id: string; body: string; created_at: string; sender_name: string; is_edited?: boolean; reactions?: ReactionGroup[]; }
interface SearchResult { id: string; channel_id: string; body: string; created_at: string; sender_name: string; channel_type: string; channel_name: string | null; dm_partner_name: string | null; }

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
    const [showMembers, setShowMembers] = useState(false);
    const [showEditChannel, setShowEditChannel] = useState(false);

    // emoji picker target: a message id (react to that message), 'composer', or null
    const [picker, setPicker] = useState<string | null>(null);
    // inline message editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState('');

    // message search
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    const myRole = users.find((u) => u.id === currentUserId)?.role || null;
    const amAdmin = myRole === 'admin';

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
        setEditingId(null);
        setPicker(null);
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

    // debounced global message search
    useEffect(() => {
        const q = search.trim();
        if (q.length < 2) { setResults([]); setSearching(false); return; }
        setSearching(true);
        const t = setTimeout(async () => {
            try {
                const d = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
                setResults(d.results || []);
            } catch { setResults([]); }
            finally { setSearching(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

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

    function startEdit(m: Msg) {
        setEditingId(m.id);
        setEditDraft(m.body);
        setPicker(null);
    }

    async function saveEdit(id: string) {
        const text = editDraft.trim();
        if (!text || !activeId) return;
        const mentions = parseMentions(text);
        const res = await fetch(`/api/channels/${activeId}/messages?messageId=${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: text, mentions }),
        });
        const d = await res.json();
        if (res.ok && d.message) {
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...d.message } : m)));
        }
        setEditingId(null);
    }

    async function toggleReaction(messageId: string, emoji: string) {
        if (!activeId) return;
        setPicker(null);
        const res = await fetch(`/api/channels/${activeId}/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id: messageId, emoji }),
        });
        const d = await res.json();
        if (res.ok) {
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: d.reactions } : m)));
        }
    }

    async function archiveChannel() {
        if (!active || !confirm(`Archive ${channelLabel(active)}? It will disappear for everyone.`)) return;
        await fetch(`/api/channels/${active.id}`, { method: 'DELETE' });
        setActiveId(null);
        setMessages([]);
        const chs = await loadChannels();
        if (chs.length) selectChannel(chs[0].id);
    }

    const groupChannels = channels.filter((c) => c.channel_type !== 'dm');
    const dmChannels = channels.filter((c) => c.channel_type === 'dm');
    const active = channels.find((c) => c.id === activeId) || null;
    const canManageChannel = !!active && active.channel_type !== 'dm' && (active.created_by === currentUserId || amAdmin);
    const canArchive = !!active && (active.channel_type === 'dm' || active.created_by === currentUserId || amAdmin);
    const searching2 = search.trim().length >= 2;

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
                    <div className="p-3 pb-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search messages…"
                                className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2E4A8E] focus:border-transparent"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {searching2 ? (
                        <div className="flex-1 overflow-y-auto px-2 pb-3">
                            <div className="text-[11px] font-semibold uppercase text-gray-400 px-2 mt-2 mb-1">
                                {searching ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}
                            </div>
                            {results.map((r) => (
                                <button key={r.id} onClick={() => { setSearch(''); selectChannel(r.channel_id); }}
                                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-100">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                        {r.channel_type === 'dm' ? <MessageSquare className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                                        <span className="truncate">{r.channel_type === 'dm' ? (r.dm_partner_name || 'Direct Message') : r.channel_name}</span>
                                    </div>
                                    <div className="text-sm text-gray-800 truncate">{r.sender_name}: {r.body}</div>
                                    <div className="text-[11px] text-gray-400">{timeAgo(r.created_at)}</div>
                                </button>
                            ))}
                            {!searching && results.length === 0 && <p className="px-2 text-xs text-gray-400">No matching messages.</p>}
                        </div>
                    ) : (
                        <>
                            <div className="px-3 flex gap-2">
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
                        </>
                    )}
                </aside>

                {/* thread */}
                <main className="flex-1 flex flex-col min-w-0">
                    {active ? (
                        <>
                            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-2 shrink-0">
                                {active.channel_type === 'dm' ? <MessageSquare className="w-4 h-4 text-gray-400" /> : active.is_private ? <Lock className="w-4 h-4 text-gray-400" /> : <Hash className="w-4 h-4 text-gray-400" />}
                                <span className="font-semibold text-gray-900">{channelLabel(active)}</span>
                                {active.description && <span className="text-sm text-gray-400 truncate">— {active.description}</span>}
                                <div className="flex-1" />
                                {active.is_private && active.channel_type !== 'dm' && (
                                    <button onClick={() => setShowMembers(true)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#2E4A8E] px-2 py-1 rounded-lg hover:bg-gray-50" title="Members">
                                        <Users className="w-4 h-4" /> {Number(active.member_count || 0) || ''}
                                    </button>
                                )}
                                {canManageChannel && (
                                    <button onClick={() => setShowEditChannel(true)} className="text-gray-400 hover:text-[#2E4A8E] p-1.5 rounded-lg hover:bg-gray-50" title="Edit channel">
                                        <Settings className="w-4 h-4" />
                                    </button>
                                )}
                                {canArchive && (
                                    <button onClick={archiveChannel} className="text-gray-400 hover:text-[#8B2332] p-1.5 rounded-lg hover:bg-gray-50" title="Archive channel">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                                {messages.map((m) => {
                                    const own = m.sender_id === currentUserId;
                                    const editing = editingId === m.id;
                                    return (
                                        <div key={m.id} className="group relative flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#2E4A8E]/10 text-[#2E4A8E] flex items-center justify-center text-xs font-semibold shrink-0">
                                                {(m.sender_name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-gray-900">{m.sender_name}</span>
                                                    <span className="text-[11px] text-gray-400">{timeAgo(m.created_at)}</span>
                                                    {m.is_edited && <span className="text-[11px] text-gray-400">(edited)</span>}
                                                </div>

                                                {editing ? (
                                                    <div className="mt-1 flex flex-col gap-2">
                                                        <MentionTextarea value={editDraft} onChange={setEditDraft} getSuggestions={getSuggestions} onSubmit={() => saveEdit(m.id)} />
                                                        <div className="flex gap-2">
                                                            <button onClick={() => saveEdit(m.id)} disabled={!editDraft.trim()} className="px-3 py-1 bg-[#2E4A8E] text-white rounded-lg text-xs hover:bg-[#243d73] disabled:opacity-40">Save</button>
                                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="text-sm text-gray-700 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: renderMentions(m.body) }} />
                                                        {!!m.reactions?.length && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {m.reactions.map((r) => (
                                                                    <button key={r.emoji} onClick={() => toggleReaction(m.id, r.emoji)} title={r.users.join(', ')}
                                                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs ${r.mine ? 'bg-[#2E4A8E]/10 border-[#2E4A8E]/40' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                                                        <span>{r.emoji}</span><span className="text-gray-600">{r.count}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* hover toolbar */}
                                            {!editing && (
                                                <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 z-10">
                                                    {QUICK_REACTIONS.slice(0, 4).map((e) => (
                                                        <button key={e} onClick={() => toggleReaction(m.id, e)} className="hover:bg-gray-100 rounded px-1 text-sm" title={`React ${e}`}>{e}</button>
                                                    ))}
                                                    <button onClick={() => setPicker(picker === m.id ? null : m.id)} className="text-gray-400 hover:text-[#2E4A8E] hover:bg-gray-100 rounded p-0.5" title="More reactions">
                                                        <Smile className="w-4 h-4" />
                                                    </button>
                                                    {own && (
                                                        <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-[#2E4A8E] hover:bg-gray-100 rounded p-0.5" title="Edit">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {(own || amAdmin) && (
                                                        <button onClick={() => deleteMessage(m.id)} className="text-gray-400 hover:text-[#8B2332] hover:bg-gray-100 rounded p-0.5" title="Delete">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {picker === m.id && (
                                                        <EmojiPicker onPick={(e) => toggleReaction(m.id, e)} onClose={() => setPicker(null)} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {messages.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No messages yet. Say hello!</p>}
                                <div ref={endRef} />
                            </div>

                            <div className="p-3 border-t border-gray-200 bg-white flex items-end gap-2 shrink-0">
                                <div className="relative">
                                    <button onClick={() => setPicker(picker === 'composer' ? null : 'composer')} className="p-2.5 text-gray-400 hover:text-[#2E4A8E] hover:bg-gray-100 rounded-xl" title="Emoji">
                                        <Smile className="w-5 h-5" />
                                    </button>
                                    {picker === 'composer' && (
                                        <EmojiPicker above onPick={(e) => setDraft((d) => d + e)} onClose={() => setPicker(null)} />
                                    )}
                                </div>
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
            {showMembers && active && (
                <MembersModal
                    channel={active}
                    users={users}
                    canManage={canManageChannel}
                    onClose={() => setShowMembers(false)}
                    onChanged={loadChannels}
                />
            )}
            {showEditChannel && active && (
                <EditChannelModal
                    channel={active}
                    onClose={() => setShowEditChannel(false)}
                    onSaved={async () => { setShowEditChannel(false); await loadChannels(); }}
                />
            )}
        </div>
    );
}

function EmojiPicker({ onPick, onClose, above }: { onPick: (e: string) => void; onClose: () => void; above?: boolean }) {
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div className={`absolute ${above ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 z-50 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-2`}>
                {EMOJI_GROUPS.map((g) => (
                    <div key={g.label} className="mb-1">
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 px-1 mb-0.5">{g.label}</div>
                        <div className="flex flex-wrap gap-0.5">
                            {g.emojis.map((e) => (
                                <button key={e} type="button" onMouseDown={(ev) => { ev.preventDefault(); onPick(e); onClose(); }} className="text-lg hover:bg-gray-100 rounded p-0.5 leading-none">{e}</button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
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

interface Member { user_id: string; name: string; role: string; email: string; }
function MembersModal({ channel, users, canManage, onClose, onChanged }: { channel: Channel; users: UserRow[]; canManage: boolean; onClose: () => void; onChanged: () => void }) {
    const [members, setMembers] = useState<Member[]>([]);
    const [createdBy, setCreatedBy] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        const d = await fetch(`/api/channels/${channel.id}/members`).then((r) => r.json());
        setMembers(d.members || []);
        setCreatedBy(d.created_by || null);
    }, [channel.id]);
    useEffect(() => { load(); }, [load]);

    async function remove(userId: string) {
        setBusy(true);
        try {
            await fetch(`/api/channels/${channel.id}/members?user_id=${userId}`, { method: 'DELETE' });
            await load(); onChanged();
        } finally { setBusy(false); }
    }
    async function add(userId: string) {
        setBusy(true);
        try {
            await fetch(`/api/channels/${channel.id}/members`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_ids: [userId] }),
            });
            await load(); onChanged();
        } finally { setBusy(false); }
    }

    const memberIds = new Set(members.map((m) => m.user_id));
    const addable = users.filter((u) => !memberIds.has(u.id));

    return (
        <Modal title={`Members of ${channelLabel(channel)}`} onClose={onClose}>
            <div className="max-h-60 overflow-y-auto -mx-1 space-y-0.5">
                {members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="flex-1 truncate">{m.name}{m.user_id === createdBy && <span className="text-xs text-gray-400"> · owner</span>}</span>
                        {canManage && m.user_id !== createdBy && (
                            <button disabled={busy} onClick={() => remove(m.user_id)} className="text-gray-300 hover:text-[#8B2332]" title="Remove">
                                <UserMinus className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                {members.length === 0 && <p className="px-2 py-3 text-sm text-gray-400">No members.</p>}
            </div>
            {canManage && (
                <div className="pt-2 border-t border-gray-100">
                    {!adding ? (
                        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm text-[#2E4A8E] hover:underline">
                            <UserPlus className="w-4 h-4" /> Add people
                        </button>
                    ) : (
                        <div className="max-h-48 overflow-y-auto -mx-1 space-y-0.5">
                            {addable.map((u) => (
                                <button key={u.id} disabled={busy} onClick={() => add(u.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left text-sm">
                                    <UserPlus className="w-4 h-4 text-gray-400" /> {userName(u)}
                                </button>
                            ))}
                            {addable.length === 0 && <p className="px-2 py-2 text-sm text-gray-400">Everyone's already a member.</p>}
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

function EditChannelModal({ channel, onClose, onSaved }: { channel: Channel; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(channel.name);
    const [description, setDescription] = useState(channel.description || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function save() {
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/channels/${channel.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description }),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error || 'Failed to save'); return; }
            onSaved();
        } finally { setBusy(false); }
    }

    return (
        <Modal title="Edit channel" onClose={onClose}>
            <input className={INPUT} placeholder="Channel name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={INPUT} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            {error && <p className="text-sm text-[#8B2332]">{error}</p>}
            <ModalActions onClose={onClose} onConfirm={save} busy={busy} disabled={!name.trim()} confirmLabel="Save" />
        </Modal>
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
