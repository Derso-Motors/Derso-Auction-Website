'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase-client';
import { useEffect, useState } from 'react';
import NotificationBell from './NotificationBell';

export default function Shell({ children, active }) {
  const router = useRouter();
  const [role, setRole] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => setRole(data?.role));
    });
  }, []);

  const handleSignOut = async () => {
    if (!window.confirm('האם להתנתק?')) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isAdmin = role === 'admin';

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">
          דרסו
          <span>ליווי למכרזים</span>
        </div>
        <Link href="/" className={`nav-item ${active === 'home' ? 'active' : ''}`}>דף הבית</Link>
        <Link href="/messages" className={`nav-item ${active === 'messages' && !isAdmin ? 'active' : ''}`}>הודעות</Link>
        <Link href="/reports" className={`nav-item ${active === 'reports' ? 'active' : ''}`}>דוחות וקרדיטים</Link>
        {isAdmin && (
          <>
            <div style={{ height: 10 }} />
            <Link href="/admin" className={`nav-item ${active === 'admin' ? 'active' : ''}`}>ניהול</Link>
            <Link href="/admin/cars" className={`nav-item ${active === 'cars' ? 'active' : ''}`}>רכבים</Link>
            <Link href="/admin/clients" className={`nav-item ${active === 'clients' ? 'active' : ''}`}>לקוחות</Link>
            <Link href="/admin/orders" className={`nav-item ${active === 'orders' ? 'active' : ''}`}>הזמנות דוחות</Link>
            <Link href="/admin/calendar" className={`nav-item ${active === 'calendar' ? 'active' : ''}`}>יומן פגישות</Link>
            <Link href="/admin/recommendations" className={`nav-item ${active === 'recommendations' ? 'active' : ''}`}>המלצות</Link>
            <Link href="/admin/messages" className={`nav-item ${active === 'messages' && isAdmin ? 'active' : ''}`}>הודעות לקוחות</Link>
            <Link href="/admin/marketplace" className={`nav-item ${active === 'marketplace' ? 'active' : ''}`}>העלאה למכירה</Link>
          </>
        )}
        <div className="spacer" />
        <div style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <NotificationBell />
          <button onClick={handleSignOut} className="signout" style={{ width: 'auto', padding: '8px 0' }}>התנתקות</button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
