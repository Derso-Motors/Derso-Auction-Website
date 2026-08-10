import Link from 'next/link';
import { createClient, requireUser } from '../lib/supabase-server';
import { redirect } from 'next/navigation';

async function signOut() {
  'use server';
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function Shell({ children, active }) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  const items = isAdmin
    ? [
        { href: '/', key: 'home', label: 'ראשי' },
        { href: '/admin/messages', key: 'messages', label: 'הודעות' },
        { href: '/admin', key: 'admin', label: 'ניהול' },
      ]
    : [
        { href: '/', key: 'home', label: 'ראשי' },
        { href: '/wallet', key: 'wallet', label: '💳 ארנק' },
        { href: '/reports', key: 'reports', label: 'דוחות ותשלומים' },
        { href: '/messages', key: 'messages', label: 'שאלות ופניות' },
      ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          דרסו — ליווי למכרזים
          <span>אזור לקוחות</span>
        </div>
        {items.map((it) => (
          <Link key={it.key} href={it.href} className={`nav-item ${active === it.key ? 'active' : ''}`}>
            {it.label}
          </Link>
        ))}
        <div className="spacer" />
        <div className="nav-item" style={{ borderRight: 'none', cursor: 'default' }}>
          {profile?.full_name || user.email}
        </div>
        <form action={signOut}>
          <button className="signout" type="submit">התנתקות</button>
        </form>
      </aside>
      <main className="main">{children}</main>
      <footer style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', fontSize: 12, color: '#888', textAlign: 'center' }}>
        <p><strong>דרסו — בית ליווי מקצועי למכרזים</strong></p>
        <p>📍 ציזלינג אהרון 20, חיפה</p>
        <p>📞 <a href="tel:+972559506913" dir="ltr">055-950-6913</a> &nbsp;|&nbsp; ✉️ <a href="mailto:netanel.derso@gmail.com">netanel.derso@gmail.com</a></p>
        <p>שעות פעילות: ראשון–חמישי, 09:00–18:00</p>
        <div style={{ marginTop: 8 }}>
          <a href="/terms">תנאי שימוש</a> · <a href="/privacy">מדיניות פרטיות</a>
        </div>
        <p>© 2026 דרסו — בית ליווי מקצועי למכרזים. כל הזכויות שמורות.</p>
      </footer>
    </div>
  );
}
