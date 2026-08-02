import Link from 'next/link';
import Shell from '../components/Shell';
import { SubmitButton, DeleteButton } from '../components/SubmitButton';
import { requireUser } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const STAGES = ['זכייה במכרז', 'תשלום למכרז', 'שחרור הרכב', 'העברת בעלות', 'שינוע הרכב', 'מסירה ללקוח'];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

async function deleteMeetingAction(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  await supabase.from('meetings').delete().eq('id', formData.get('id'));
  revalidatePath('/');
}

async function deleteOrderAction(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  await supabase.from('report_orders').delete().eq('id', formData.get('id'));
  revalidatePath('/');
}

async function deleteCarAction(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  const id = formData.get('id');
  await supabase.from('car_updates').delete().eq('car_id', id);
  await supabase.from('car_stages').delete().eq('car_id', id);
  await supabase.from('cars').delete().eq('id', id);
  revalidatePath('/');
}

export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  if (isAdmin) {
    const [{ data: clients }, { data: cars }, { data: orders }, { data: unread }, { data: meetings }, { count: auctionCount }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }),
      supabase.from('cars').select('*, car_stages(*), profiles(full_name), client_name, client_phone').order('created_at', { ascending: false }),
      supabase.from('report_orders').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('messages').select('id').eq('sender_role', 'client').eq('read', false),
      supabase.from('meetings').select('*, profiles(full_name)').order('scheduled_at', { ascending: true }),
      supabase.from('auctions').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'under_review', 'pending_release']),
    ]);

    const activeCars = (cars || []).filter(c => {
      const done = (c.car_stages || []).filter(s => s.status === 'done').length;
      return done < 6;
    });

    const pendingOrders = (orders || []).filter(o => o.status === 'awaiting_payment' || o.status === 'paid');
    const upcomingMeetings = (meetings || []).filter(m => new Date(m.scheduled_at) >= new Date());
    const statusLabel = { awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל' };

    return (
      <Shell active="home">
        <div className="page-title">שלום, {profile?.full_name || 'מנהל'}</div>
        <div className="page-sub">סקירת מערכת — דרסו ליווי למכרזים</div>

        {/* Alert for unread messages */}
        {unread?.length > 0 && (
          <div className="card" style={{ borderRightWidth: 4, borderRightColor: 'var(--warning)', padding: '14px 20px', marginBottom: 16 }}>
            <div className="row" style={{ gap: 10 }}>
              <div style={{ fontSize: 13, flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>התראה: </span>
                <span style={{ color: 'var(--muted)' }}>{unread.length} הודעות חדשות מלקוחות ממתינות למענה</span>
              </div>
              <Link href="/admin/messages" className="btn small" style={{ flexShrink: 0 }}>צפה בהודעות</Link>
            </div>
          </div>
        )}

        <div className="grid cols-4" style={{ marginBottom: 4 }}>
          <div className="card stat">
            <div className="num">{clients?.length || 0}</div>
            <div className="label">לקוחות רשומים</div>
          </div>
          <div className="card stat">
            <div className="num">{activeCars.length}</div>
            <div className="label">רכבים בתהליך</div>
          </div>
          <div className="card stat">
            <div className="num">{auctionCount || 0}</div>
            <div className="label">מכרזים פעילים</div>
          </div>
          <div className="card stat">
            <div className="num">{unread?.length || 0}</div>
            <div className="label">הודעות חדשות</div>
          </div>
        </div>

        <div className="dashboard-layout">
          <div className="dashboard-main">
            <div className="card">
              <div className="row between" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>רכבים בטיפול</h3>
                <Link href="/admin/cars" className="btn small secondary">הצג הכל ({activeCars.length})</Link>
              </div>
              {!activeCars.length && <div className="empty">אין רכבים בתהליך כרגע</div>}
              {activeCars.slice(0, 6).map((car) => {
                const stgs = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
                const done = stgs.filter((s) => s.status === 'done').length;
                const current = stgs.find((s) => s.status === 'in_progress');
                const clientLabel = car.profiles?.full_name || car.client_name || 'לקוח לא רשום';
                return (
                  <div key={car.id} className="side-item">
                    <Link href={`/cars/${car.id}`} className="side-item-content">
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{car.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {clientLabel}{car.year ? ` · ${car.year}` : ''}{car.license_plate ? ` · ${car.license_plate}` : ''}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span className="badge in_progress" style={{ fontSize: 10, padding: '2px 8px' }}>
                          {current ? current.title : STAGES[done] || 'בתהליך'}
                        </span>
                        <span className="muted" style={{ marginRight: 8, fontSize: 11 }}>{done}/6</span>
                      </div>
                    </Link>
                    <div className="side-item-actions">
                      <form action={deleteCarAction}>
                        <input type="hidden" name="id" value={car.id} />
                        <DeleteButton title="מחיקה" />
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <div className="row between" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>לקוחות אחרונים</h3>
              </div>
              {!clients?.length && <div className="empty">אין לקוחות רשומים</div>}
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>שם</th><th>טלפון</th><th>קרדיטים</th><th>הצטרפות</th><th></th></tr></thead>
                  <tbody>
                    {clients?.slice(0, 8).map((c) => (
                      <tr key={c.id}>
                        <td>{c.full_name || '—'}</td>
                        <td dir="ltr">{c.phone || '—'}</td>
                        <td>₪{Number(c.credits).toLocaleString()}</td>
                        <td className="muted">{new Date(c.created_at).toLocaleDateString('he-IL')}</td>
                        <td><Link href={`/admin/chat/${c.id}`} style={{ color: 'var(--accent)' }}>צ׳אט</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="dashboard-side">
            <div className="card">
              <div className="row between" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>יומן פגישות</h3>
                <Link href="/admin/calendar" className="btn small secondary">הצג הכל</Link>
              </div>
              {!upcomingMeetings.length && <div className="empty">אין פגישות קרובות</div>}
              {upcomingMeetings.slice(0, 6).map((m) => (
                <div key={m.id} className="side-item">
                  <div className="side-item-content">
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {m.profiles?.full_name} · {formatDate(m.scheduled_at)}
                      {m.location ? ` · ${m.location}` : ''}
                    </div>
                  </div>
                  <div className="side-item-actions">
                    <div className="side-item-time">{formatTime(m.scheduled_at)}</div>
                    <form action={deleteMeetingAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <DeleteButton title="מחיקה" />
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="row between" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>הזמנות דוחות</h3>
                <Link href="/admin/orders" className="btn small secondary">הצג הכל ({orders?.length || 0})</Link>
              </div>
              {!orders?.length && <div className="empty">אין הזמנות</div>}
              {orders?.slice(0, 5).map((o) => (
                <div key={o.id} className="side-item">
                  <div className="side-item-content">
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.report_type}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {o.profiles?.full_name} · ₪{Number(o.amount).toLocaleString()} · {timeAgo(o.created_at)}
                    </div>
                  </div>
                  <div className="side-item-actions">
                    <span className={`badge ${o.status}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                      {statusLabel[o.status] || o.status}
                    </span>
                    <form action={deleteOrderAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <DeleteButton title="מחיקה" />
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // Client dashboard
  const [{ data: cars }, { data: meetings }, { data: recLists }, { data: orders }, { data: auctions }] = await Promise.all([
    supabase.from('cars').select('*, car_stages(*)').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('meetings').select('*').eq('client_id', user.id).eq('status', 'scheduled').order('scheduled_at'),
    supabase.from('recommendation_lists').select('*, recommended_cars(id)').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('report_orders').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('auctions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
  ]);

  const statusLabel = { awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל' };
  const activeAuctions = (auctions || []).filter(a => ['submitted', 'under_review', 'pending_release'].includes(a.status));

  const auctionStatusLabel = {
    submitted: 'הצעה הוגשה', under_review: 'בבדיקת כונס', won: 'זכייה',
    lost: 'לא זכה', cancelled: 'בוטל', pending_release: 'ממתין לשחרור',
  };
  const auctionStatusClass = {
    submitted: 'in_progress', under_review: 'awaiting_payment', won: 'paid',
    lost: 'cancelled', cancelled: 'cancelled', pending_release: 'in_progress',
  };

  return (
    <Shell active="home">
      <div className="page-title">שלום, {profile?.full_name || 'לקוח'}</div>
      <div className="page-sub">סקירה כללית של הרכבים והפעילות שלך</div>

      <div className="grid cols-4" style={{ marginBottom: 4 }}>
        <div className="card stat">
          <div className="num">{cars?.length || 0}</div>
          <div className="label">רכבים בתהליך</div>
        </div>
        <div className="card stat">
          <div className="num">₪{Number(profile?.credits || 0).toLocaleString()}</div>
          <div className="label">יתרת קרדיטים</div>
        </div>
        <div className="card stat">
          <div className="num">{activeAuctions.length}</div>
          <div className="label">מכרזים פעילים</div>
        </div>
        <div className="card stat">
          <div className="num">{meetings?.length || 0}</div>
          <div className="label">פגישות מתוכננות</div>
        </div>
      </div>

      {/* Active Auctions for Client */}
      {(auctions || []).length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0 }}>מעקב מכרזים</h3>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>רכב / מכרז</th>
                  <th>הצעה מקס׳</th>
                  <th>תאריך סגירה</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {(auctions || []).slice(0, 10).map((a) => (
                  <tr key={a.id} style={a.status === 'lost' ? { opacity: 0.6 } : undefined}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13, textDecoration: a.status === 'lost' ? 'line-through' : 'none' }}>
                        {a.car_title}
                      </div>
                      {(a.auction_source || a.case_number) && (
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                          {[a.auction_source, a.case_number].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>₪{Number(a.max_bid || 0).toLocaleString()}</td>
                    <td className="muted">
                      {a.closing_date ? new Date(a.closing_date).toLocaleDateString('he-IL') : '—'}
                    </td>
                    <td>
                      <span className={`badge ${auctionStatusClass[a.status] || ''}`}>
                        {auctionStatusLabel[a.status] || a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dashboard-layout" style={{ marginTop: 16 }}>
        <div className="dashboard-main">
          <div className="card">
            <h3>הרכבים שלי</h3>
            {!cars?.length && <div className="empty">אין רכבים בתהליך כרגע</div>}
            {cars?.map((car) => {
              const done = (car.car_stages || []).filter((s) => s.status === 'done').length;
              const current = (car.car_stages || []).find((s) => s.status === 'in_progress');
              return (
                <Link key={car.id} href={`/cars/${car.id}`}>
                  <div className="side-item">
                    <div className="side-item-content">
                      <div style={{ fontWeight: 600 }}>{car.title}</div>
                      <div className="muted">
                        {car.year ? `שנתון ${car.year}` : ''}{car.km ? ` · ${Number(car.km).toLocaleString()} ק"מ` : ''}
                        {car.license_plate ? ` · ${car.license_plate}` : ''}
                      </div>
                    </div>
                    <div className="side-item-actions">
                      <div style={{ textAlign: 'left' }}>
                        <span className={`badge ${done >= 6 ? 'done' : 'in_progress'}`}>
                          {current ? current.title : done >= 6 ? 'הושלם' : STAGES[done] || 'בתהליך'}
                        </span>
                        <div className="muted" style={{ marginTop: 4 }}>{done}/6 שלבים</div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {orders?.length > 0 && (
            <div className="card">
              <h3>הזמנות דוחות</h3>
              {orders.map((o) => (
                <div key={o.id} className="side-item">
                  <div className="side-item-content">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{o.report_type}</div>
                    <div className="muted" style={{ fontSize: 12 }}>₪{Number(o.amount).toLocaleString()} · {timeAgo(o.created_at)}</div>
                  </div>
                  <div className="side-item-actions">
                    <span className={`badge ${o.status}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                      {statusLabel[o.status] || o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-side">
          <div className="card">
            <h3>פגישות קרובות</h3>
            {!meetings?.length && <div className="empty">אין פגישות</div>}
            {meetings?.map((m) => (
              <div key={m.id} className="side-item">
                <div className="side-item-content">
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {formatDate(m.scheduled_at)}
                    {m.location ? ` · ${m.location}` : ''}
                  </div>
                </div>
                <div className="side-item-time">{formatTime(m.scheduled_at)}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>רשימות רכבים</h3>
            {!recLists?.length && <div className="empty">אין רשימות</div>}
            {recLists?.map((l) => (
              <Link key={l.id} href={`/r/${l.share_token}`}>
                <div className="side-item">
                  <div className="side-item-content">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{l.title}</div>
                  </div>
                  <div className="muted">{l.recommended_cars?.length || 0} רכבים</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
