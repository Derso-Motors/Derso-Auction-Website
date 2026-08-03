import Shell from '../../components/Shell';
import { createClient, requireUser } from '../../lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  return supabase;
}

export default async function AdminPage() {
  const supabase = await requireAdmin();

  const [{ count: clientCount }, { count: carCount }, { count: orderCount }, { count: meetingCount }, { count: listCount }, { count: auctionCount }, { data: unread }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('cars').select('*', { count: 'exact', head: true }),
    supabase.from('report_orders').select('*', { count: 'exact', head: true }),
    supabase.from('meetings').select('*', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
    supabase.from('recommendation_lists').select('*', { count: 'exact', head: true }),
    supabase.from('auctions').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review', 'pending_release']),
    supabase.from('messages').select('id, client_id, body, created_at, profiles(full_name)').eq('sender_role', 'client').eq('read', false).order('created_at', { ascending: false }).limit(5),
  ]);

  const { data: broadcastSubs } = await supabase.from('broadcast_subscribers').select('monthly_fee, active');
  const activeBroadcastSubs = (broadcastSubs || []).filter((s) => s.active);
  const broadcastRevenue = activeBroadcastSubs.reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0);

  const sections = [
    { href: '/admin/cars', icon: '🚗', label: 'רכבים', desc: 'ניהול רכבים, שלבים ועדכונים', count: carCount },
    { href: '/admin/clients', icon: '👥', label: 'לקוחות', desc: 'ניהול לקוחות וקרדיטים', count: clientCount },
    { href: '/admin/orders', icon: '📄', label: 'הזמנות דוחות', desc: 'הזמנות דוחות ותשלומים', count: orderCount },
    { href: '/admin/calendar', icon: '📅', label: 'יומן פגישות', desc: 'קביעה וניהול פגישות', count: meetingCount },
    { href: '/admin/recommendations', icon: '⭐', label: 'המלצות', desc: 'רשימות המלצות לשיחות איפיון', count: listCount },
    { href: '/admin/messages', icon: '💬', label: 'הודעות', desc: 'הודעות מלקוחות', count: unread?.length || 0 },
    { href: '/admin/auctions', icon: '⚖️', label: 'מעקב מכרזים', desc: 'הצעות, זכיות והיסטוריית מכרזים', count: auctionCount },
    { href: '/admin/marketplace', icon: '🏪', label: 'העלאה למכירה', desc: 'BidSpirit → Facebook Marketplace' },
    { href: '/admin/inventory', icon: '📦', label: 'מאגר רכבים', desc: 'מאגר פנימי לשיחות אפיון', count: undefined },
    { href: '/admin/broadcasts', icon: '📡', label: 'שידורים', desc: `${activeBroadcastSubs.length} מנויים · ₪${broadcastRevenue.toLocaleString('he-IL')} בחודש`, count: activeBroadcastSubs.length },
    { href: '/admin/tasks', icon: '🗓️', label: 'משימות והיום', desc: 'פגישות היום, משימות ותזכורות' },
  ];

  return (
    <Shell active="admin">
      <div className="page-title">ניהול</div>
      <div className="page-sub">בחר קטגוריה לניהול</div>

      {unread?.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3>הודעות חדשות מלקוחות ({unread.length})</h3>
          {unread.map((m) => (
            <div key={m.id} className="side-item">
              <div className="side-item-content">
                <div><b>{m.profiles?.full_name}:</b> {m.body}</div>
                <div className="muted" style={{ fontSize: 11 }}>{new Date(m.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</div>
              </div>
              <div className="side-item-actions">
                <Link href={`/admin/chat/${m.client_id}`} className="btn small">מענה</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-sections-grid">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="admin-section-card">
            <div className="admin-section-icon">{s.icon}</div>
            <div className="admin-section-label">{s.label}</div>
            <div className="admin-section-desc">{s.desc}</div>
            {s.count != null && <div className="admin-section-count">{s.count}</div>}
          </Link>
        ))}
      </div>
    </Shell>
  );
}
