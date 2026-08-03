'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase-client';
import { useEffect, useState, useRef } from 'react';
import NotificationBell from './NotificationBell';
import AssistantWidget from './AssistantWidget';

const ICONS = {
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></>,
  admin: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  cars: <><path d="M5 17h14v-5H5z"/><path d="M2 17l2-6h16l2 6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
  clients: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  orders: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  recommendations: <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></>,
  messages: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  auctions: <><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></>,
  marketplace: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  inventory: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  broadcast: <><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/></>,
  tasks: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
};

const ADMIN_NAV = [
  { href: '/', key: 'home', label: 'ראשי', icon: 'home' },
  { href: '/admin', key: 'admin', label: 'ניהול', icon: 'admin' },
  { href: '/admin/cars', key: 'cars', label: 'רכבים', icon: 'cars' },
  { href: '/admin/clients', key: 'clients', label: 'לקוחות', icon: 'clients' },
  { href: '/admin/orders', key: 'orders', label: 'הזמנות דוחות', icon: 'orders' },
  { href: '/admin/calendar', key: 'calendar', label: 'יומן פגישות', icon: 'calendar' },
  { href: '/admin/recommendations', key: 'recommendations', label: 'המלצות', icon: 'recommendations' },
  { href: '/admin/messages', key: 'messages', label: 'הודעות', icon: 'messages' },
  { href: '/admin/auctions', key: 'auctions', label: 'מעקב מכרזים', icon: 'auctions' },
  { href: '/admin/marketplace', key: 'marketplace', label: 'העלאה למכירה', icon: 'marketplace' },
  { href: '/admin/inventory', key: 'inventory', label: 'מאגר רכבים', icon: 'inventory' },
  { href: '/admin/broadcasts', key: 'broadcasts', label: 'שידורים', icon: 'broadcast' },
  { href: '/admin/tasks', key: 'tasks', label: 'משימות והיום', icon: 'tasks' },
];

const CLIENT_NAV = [
  { href: '/', key: 'home', label: 'ראשי', icon: 'home' },
  { href: '/recommended', key: 'recommended', label: 'רכבים בהמלצה', icon: 'recommendations' },
  { href: '/reports', key: 'reports', label: 'דוחות ותשלומים', icon: 'reports' },
  { href: '/messages', key: 'messages', label: 'שאלות ופניות', icon: 'messages' },
];

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
  { label: 'שידורים', href: '/admin/broadcasts' },
  { label: 'משימות והיום', href: '/admin/tasks' },
  { label: 'דוחות ותשלומים', href: '/reports' },
  { label: 'שאלות ופניות', href: '/messages' },
  { label: 'הגדרות חשבון', href: '/settings' },
];

function SearchBar() {
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

  const filtered = query
    ? SEARCH_ITEMS.filter(i => i.label.includes(query) || i.href.includes(query))
    : SEARCH_ITEMS;

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

export default function Shell({ children, active }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      setEmail(user.email || '');
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (!cancelled) { setProfile(data); setLoaded(true); }
        });
    });
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm('האם להתנתק?')) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isAdmin = profile?.role === 'admin';
  const items = isAdmin ? ADMIN_NAV : CLIENT_NAV;
  const initials = loaded ? (profile?.full_name || email || '?').charAt(0).toUpperCase() : '';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-right">
          <SearchBar />
        </div>
        <div className="topbar-brand">V-TRACK ANALYTICS</div>
        <div className="topbar-left">
          <button className="topbar-icon" title="הגדרות" type="button" onClick={() => router.push('/settings')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <NotificationBell />
          <button
            className="topbar-avatar"
            title={profile?.full_name || email || 'הגדרות'}
            onClick={() => router.push('/settings')}
            type="button"
            style={{ cursor: 'pointer', border: '2px solid rgba(186,199,227,0.2)' }}
          >
            {initials}
          </button>
        </div>
      </header>

      <aside className="icon-sidebar">
        <div className="icon-sidebar-nav">
          {items.map((it) => (
            <Link key={it.key} href={it.href} className={`icon-sidebar-item ${active === it.key ? 'active' : ''}`} title={it.label}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[it.icon]}
              </svg>
            </Link>
          ))}
        </div>
        <div className="icon-sidebar-bottom">
          <HelpButton />
          <button className="icon-sidebar-item" type="button" title="התנתקות" onClick={handleSignOut}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>

      {isAdmin && <AssistantWidget />}

      <footer className="app-footer">
        <div className="app-footer-links">
          <Link href="/terms">תנאי שימוש</Link>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/disclaimer">הסרת אחריות</Link>
        </div>
        <p>&copy; 2024 V-Track Analytics. כל הזכויות שמורות ל-דרסו מוטורס.</p>
      </footer>
    </div>
  );
}
