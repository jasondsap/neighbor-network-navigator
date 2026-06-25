'use client';

/**
 * app/components/NotificationBell.tsx
 *
 * Header bell: polls /api/notifications every 30s, shows an unread badge and a
 * dropdown inbox. Clicking an item marks it read and deep-links to the channel.
 * Ported from DDOR's NotificationBell, adapted to this app's routes/colors.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AtSign, MessageSquare, UserPlus, SmilePlus, Check } from 'lucide-react';
import { timeAgo } from '@/lib/time';

interface InboxItem {
    id: string;
    type: 'mention' | 'dm' | 'channel_added' | 'reaction';
    source_type: string;
    channel_id: string | null;
    resource_id: string | null;
    preview: string | null;
    created_at: string;
    read_at: string | null;
    actor_name: string | null;
    channel_name: string | null;
    channel_type: string | null;
}

function itemIcon(t: InboxItem['type']) {
    if (t === 'mention') return <AtSign className="w-4 h-4 text-[#2E4A8E]" />;
    if (t === 'dm') return <MessageSquare className="w-4 h-4 text-[#2A8B8B]" />;
    if (t === 'reaction') return <SmilePlus className="w-4 h-4 text-[#8B2332]" />;
    return <UserPlus className="w-4 h-4 text-[#E8B84A]" />;
}

function itemLabel(n: InboxItem): string {
    const who = n.actor_name || 'Someone';
    if (n.type === 'mention') return `${who} mentioned you${n.channel_name ? ` in ${n.channel_name}` : ''}`;
    if (n.type === 'dm') return `${who} sent you a message`;
    if (n.type === 'reaction') return `${who} reacted ${n.preview || ''} to your message`;
    return `${who} added you to ${n.channel_name || 'a channel'}`;
}

export function NotificationBell() {
    const router = useRouter();
    const [items, setItems] = useState<InboxItem[]>([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        try {
            const d = await fetch('/api/notifications').then((r) => r.json());
            setItems(Array.isArray(d.inbox) ? d.inbox : []);
            setUnread(d.inboxUnread || 0);
        } catch {
            /* keep prior state */
        }
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [load]);

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (open && boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    async function openItem(n: InboxItem) {
        setOpen(false);
        if (!n.read_at) {
            setUnread((u) => Math.max(0, u - 1));
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
            fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: n.id }),
            }).catch(() => {});
        }
        router.push(n.channel_id ? `/messages?channel=${n.channel_id}` : '/messages');
    }

    async function markAll() {
        setUnread(0);
        setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
        fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ all: true }),
        }).catch(() => {});
    }

    return (
        <div className="relative" ref={boxRef}>
            <button
                onClick={() => setOpen((o) => !o)}
                className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                title="Notifications"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-[#F5F0E6]" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#8B2332] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                        <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                        {unread > 0 && (
                            <button onClick={markAll} className="text-xs text-[#2E4A8E] hover:underline flex items-center gap-1">
                                <Check className="w-3 h-3" /> Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {items.length === 0 && (
                            <div className="px-4 py-8 text-center text-sm text-gray-400">You're all caught up.</div>
                        )}
                        {items.map((n) => (
                            <button
                                key={n.id}
                                onClick={() => openItem(n)}
                                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 hover:bg-gray-50 ${n.read_at ? '' : 'bg-[#2E4A8E]/5'}`}
                            >
                                <span className="mt-0.5">{itemIcon(n.type)}</span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm text-gray-900">{itemLabel(n)}</span>
                                    {n.preview && <span className="block text-xs text-gray-500 truncate">{n.preview}</span>}
                                    <span className="block text-[11px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</span>
                                </span>
                                {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#2E4A8E] shrink-0" />}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { setOpen(false); router.push('/messages'); }}
                        className="w-full px-4 py-2.5 text-sm font-medium text-[#2E4A8E] hover:bg-gray-50 border-t border-gray-100"
                    >
                        Open Messages
                    </button>
                </div>
            )}
        </div>
    );
}
