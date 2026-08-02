'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase-client';
import { useEffect, useState } from 'react';
import NotificationBell from './NotificationBell';

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
  reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
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
];

const CLIENT_NAV = [
  { href: '/', key: 'home', label: 'ראשי', icon: 'home' },
  { href: '/reports', key: 'reports', label: 'דוחות ותשלומים', icon: 'reports' },
  { href: '/messages', key: 'messages', label: 'שאלות ופניות', icon: 'messages' },
];

export default function Shell({ children, active }) {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email || '');
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data));
    });
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm('האם להתנתק?')) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isAdmin = profile?.role === 'admin';
  const items = isAdmin ? ADMIN_NAV : CLIENT_NAV;
  const initials = (profile?.full_name || email || '?').charAt(0).toUpperCase();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-right">
          <div className="topbar-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="חיפוש רכב, לקוח, מכרז..." readOnly />
          </div>
        </div>
        <div className="topbar-brand">V-TRACK ANALYTICS</div>
        <div className="topbar-left">
          <NotificationBell />
          <button className="topbar-icon" title="הגדרות" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <div className="topbar-avatar" title={profile?.full_name || email}>
            {initials}
          </div>
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
          <button className="icon-sidebar-item" title="עזרה" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          <button className="icon-sidebar-item" type="button" title="התנתקות" onClick={handleSignOut}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>

      <footer className="app-footer">
        <div className="app-footer-links">
          <a href="#">תנאי שימוש</a>
          <a href="#">מדיניות פרטיות</a>
          <a href="#">הסרת אחריות</a>
        </div>
        <p>&copy; 2024 V-Track Analytics. כל הזכויות שמורות ל-דרסו מוטורס.</p>
      </footer>
    </div>
  );
}
