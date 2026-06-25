'use client';

/**
 * app/components/MessagesNavButton.tsx
 *
 * Header "Messages" button with an unread badge. Polls /api/notifications every
 * 30s for `totalUnread` (unread message count across visible channels) and
 * shows a red pill when > 0, mirroring the per-channel badge in /messages.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';

export function MessagesNavButton() {
    const router = useRouter();
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        let alive = true;
        async function load() {
            try {
                const d = await fetch('/api/notifications').then((r) => r.json());
                if (alive) setUnread(Number(d.totalUnread || 0));
            } catch {
                /* keep prior state */
            }
        }
        load();
        const t = setInterval(load, 30000);
        return () => {
            alive = false;
            clearInterval(t);
        };
    }, []);

    return (
        <button
            onClick={() => router.push('/messages')}
            className="relative flex items-center gap-1.5 px-3 py-1.5 text-[#F5F0E6]/90 hover:text-[#F5F0E6] hover:bg-white/10 rounded-lg transition-colors text-sm"
            title="Messages"
        >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">Messages</span>
            {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#8B2332] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                </span>
            )}
        </button>
    );
}
