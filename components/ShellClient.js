'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase-client';

const SEARCH_ITEMS = [
  { label: 'ראשי', href: '/' },
  { label: 'ניהול', href: '/admin' },
  { label: 'רכבים', href: '/admin/cars' },
  { label: 'לקוחות', href: '/admin/clients' },
  { label: 'הזמנות דוחות', href: '/admin/orders' },
  { label: 'יומן פגישות', href: '/admin/calendar' },
  { label: 'המלצות', href: '/admin/recommendations' },
  { label: 'הודעות', href: '/admin/messages' },
  { label: 'מעקב מכרזים', href: '/admin/auctions' },
  { label: 'העלאה למכירה', href: '/admin/marketplace' },
  { label: 'מאגר רכבים', href: '/admin/inventory' },
  { label: 'רכבים בהמלצה', href: '/recommended' },
  { label: 'קביעת שיחת אפיון', href: '/book-call' },
  { label: 'שידורים', href: '/admin/broadcasts' },
  { label: 'משימות והיום', href: '/admin/tasks' },
  { label: 'דוחות ותשלומים', href: '/reports' },
  { label: 'שאלות ופניות', href: '/messages' },
  { label: 'הגדרות חשבון', href: '/settings' },
];

function SearchBar({ isAdmin }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Clients only ever see client pages in the search results.
  const visible = isAdmin ? SEARCH_ITEMS : SEARCH_ITEMS.filter(i => !i.href.startsWith('/admin'));
  const filtered = query
    ? visible.filter(i => i.label.includes(query) || i.href.includes(query))
    : visible;

  return (
    <div className="topbar-search" ref={wrapRef} style={{ position: 'relative' }} onClick={() => setOpen(true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="חיפוש רכב, לקוח, מכרז..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setQuery(''); }
          if (e.key === 'Enter' && filtered.length > 0) {
            router.push(filtered[0].href);
            setOpen(false);
            setQuery('');
          }
        }}
      />
      {open && (
        <div className="search-dropdown">
          {filtered.length === 0 && <div className="empty" style={{ padding: 12 }}>לא נמצאו תוצאות</div>}
          {filtered.map(item => (
            <button
              key={item.href}
              className="search-item"
              onClick={() => { router.push(item.href); setOpen(false); setQuery(''); }}
              type="button"
            >
              {item.label}
              <span className="muted" style={{ fontSize: 11 }}>{item.href}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const bellRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('messages')
        .select('id, body, created_at, sender_role')
        .eq('client_id', user.id)
        .eq('read', false)
        .eq('sender_role', 'admin')
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(data || []);
      setCount(data?.length || 0);
    }
    let cancelled = false;
    let channel = null;
    load().then(() => supabase.auth.getUser()).then(({ data: { user } }) => {
      if (cancelled || !user) return;
      // Scoped to this user's messages only — both via filter and handler guard
      channel = supabase.channel('notif-bell')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${user.id}` }, (payload) => {
          if (payload.new.sender_role === 'admin' && payload.new.client_id === user.id && !payload.new.read) {
            setNotifications(prev => [payload.new, ...prev].slice(0, 10));
            setCount(prev => prev + 1);
          }
        })
        .subscribe();
    });

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, []);

  const toggleOpen = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && count > 0 && userId) {
      setCount(0);
      const supabase = createClient();
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('client_id', userId)
        .eq('sender_role', 'admin')
        .eq('read', false);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={bellRef}>
      <button className="notif-bell" onClick={toggleOpen} aria-label="התראות">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && <span className="notif-badge">{count}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-title">התראות</div>
          {!notifications.length && <div className="empty" style={{ padding: '16px' }}>אין התראות חדשות</div>}
          {notifications.map(n => (
            <div key={n.id} className="notif-item">
              <div style={{ fontSize: 13 }}>{n.body}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {new Date(n.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsButton() {
  const router = useRouter();
  return (
    <button className="topbar-icon" title="הגדרות" type="button" onClick={() => router.push('/settings')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>
  );
}

function HelpButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-sidebar-item" title="עזרה" type="button" onClick={() => setOpen(!open)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>
      {open && (
        <div className="help-dropdown">
          <div className="notif-title">עזרה ותמיכה</div>
          <a href="/messages" className="help-item">
            <span>💬</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>שליחת הודעה</div>
              <div className="muted">פנה אלינו דרך מערכת ההודעות</div>
            </div>
          </a>
          <a href="tel:+972559506913" className="help-item">
            <span>📞</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>התקשר אלינו</div>
              <div className="muted">055-950-6913</div>
            </div>
          </a>
          <a href="https://wa.me/972559506913" target="_blank" rel="noopener noreferrer" className="help-item">
            <span>📱</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>WhatsApp</div>
              <div className="muted">שלח הודעה בוואטסאפ</div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}

export default function ShellClient({ type, isAdmin = false }) {
  if (type === 'search') return <SearchBar isAdmin={isAdmin} />;
  if (type === 'bell') return <NotificationBell />;
  if (type === 'settings') return <SettingsButton />;
  if (type === 'help') return <HelpButton />;
  return null;
}
