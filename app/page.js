import Link from 'next/link';
import Shell from '../components/Shell';
import WelcomeCallPopup from '../components/WelcomeCallPopup';
import RealtimeAlertClient from '../components/RealtimeAlertClient';
import { SubmitButton, DeleteButton } from '../components/SubmitButton';
import { requireUser } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { timeAgo } from '../lib/utils';
import { sendWhatsApp } from '../lib/whatsapp';

export const dynamic = 'force-dynamic';

import { STAGES } from '../lib/stages';

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
  const { data: mrow } = await supabase.from('meetings').select('gcal_event_id').eq('id', formData.get('id')).single();
  if (mrow?.gcal_event_id) { try { await supabase.from('cal_deletions').upsert({ gcal_event_id: mrow.gcal_event_id }); } catch {} }
  await supabase.from('meetings').delete().eq('id', formData.get('id'));
  revalidatePath('/');
}

async function inviteClientWhatsApp(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  const phone = String(formData.get('phone') || '').trim();
  if (!phone) redirect('/?err=' + encodeURIComponent('נא להזין מספר טלפון'));
  const msg = `היי! 👋

כאן דרסו — בית ליווי מקצועי למכרזי רכב.

הכנו לך מערכת אישית שתלווה אותך בקנייה של הרכב החדש שלך:
🚗 רכבים שנבחרו במיוחד בשבילך
📋 דוחות בדיקה מקיפים לפני כל מכרז
📅 קביעת שיחות ומעקב מלא אחרי התהליך

להרשמה ולכניסה למערכת:
https://auctions.derso.net/login

נשמח ללוות אותך לעסקה בטוחה ומשתלמת 🤝

דרסו — בית ליווי מקצועי למכרזים`;
  const res = await sendWhatsApp(phone, msg);
  revalidatePath('/');
  if (res?.ok === false) redirect('/?err=' + encodeURIComponent('שליחת ההזמנה נכשלה — בדוק את המספר'));
  redirect('/?ok=' + encodeURIComponent('הזמנה נשלחה בוואטסאפ ל-' + phone + ' ✓'));
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

export default async function Dashboard({ searchParams }) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  if (isAdmin) {
    const [{ data: clients }, { data: cars }, { data: orders }, { data: unread }, { data: meetings }, { data: auctions }, { count: orderCount }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }).limit(50),
      supabase.from('cars').select('*, car_stages(*), car_updates(created_at), profiles(full_name), client_name, client_phone, image_url').order('created_at', { ascending: false }).limit(50),
      supabase.from('report_orders').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(8),
      supabase.from('messages').select('id, body, profiles(full_name)').eq('sender_role', 'client').eq('read', false).order('created_at', { ascending: false }).limit(5),
      supabase.from('meetings').select('*, profiles(full_name)').order('scheduled_at', { ascending: true }),
      supabase.from('auctions').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('report_orders').select('*', { count: 'exact', head: true }),
    ]);

    const activeCars = (cars || []).filter(c => {
      const done = (c.car_stages || []).filter(s => s.status === 'done').length;
      return done < 6;
    });
    const activeAuctions = (auctions || []).filter(a => ['submitted', 'under_review', 'pending_release'].includes(a.status));
    const upcomingMeetings = (meetings || []).filter(m => new Date(m.scheduled_at) >= new Date());
    const recentUpdatedCars = (cars || []).filter(c => c.car_updates?.length > 0 || c.image_url).slice(0, 5);
    const statusLabel = { awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל' };
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
        <div className="page-title">לוח בקרה</div>
        <div className="page-sub">סקירת מערכת — דרסו ליווי למכרזים</div>

        {/* Real-time Alert (dismissible) */}
        {unread?.length > 0 && (
          <RealtimeAlertClient
            count={unread.length}
            name={unread[0]?.profiles?.full_name}
            body={unread[0]?.body}
            sig={String(unread[0]?.id || unread.length)}
          />
        )}

        {searchParams?.err && <div className="error-msg">{searchParams.err}</div>}
        {searchParams?.ok && !searchParams?.err && <div className="info-msg">{searchParams.ok}</div>}

        {/* Quick WhatsApp invite */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 6 }}>📲 הזמנת לקוח חדש למערכת</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>מזינים מספר — הלקוח מקבל בוואטסאפ הודעה מקצועית עם קישור הרשמה.</p>
          <form action={inviteClientWhatsApp} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input name="phone" dir="ltr" placeholder="050-1234567" required style={{ flex: 1, minWidth: 180 }} />
            <SubmitButton className="btn">שליחת הזמנה בוואטסאפ</SubmitButton>
          </form>
        </div>

        {/* Bento Grid: Stats */}
        <div className="grid cols-4" style={{ marginBottom: 4 }}>
          <div className="card stat">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>לקוחות רשומים</div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="num" style={{ textAlign: 'right' }}>{clients?.length || 0}</div>
          </div>
          <div className="card stat">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>דוחות שנרכשו</div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div className="num" style={{ textAlign: 'right' }}>{orderCount || 0}</div>
          </div>
          <div className="card stat">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>מכרזים פתוחים</div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <div className="num" style={{ textAlign: 'right' }}>{activeAuctions.length}</div>
              <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted-dim)', paddingBottom: 4 }}>פעילים כעת</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'var(--surface-lowest)', borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 99, width: `${Math.min(100, ((activeAuctions.length / Math.max(1, (auctions || []).length)) * 100))}%` }} />
            </div>
          </div>
          <div className="card stat">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>הודעות חדשות</div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div className="num" style={{ textAlign: 'right' }}>{unread?.length || 0}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginTop: 4 }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Active cars */}
            <div className="card">
              <div className="row between" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>רכבים בטיפול</h3>
                <Link href="/admin/cars" className="btn small secondary">הצג הכל ({activeCars.length})</Link>
              </div>
              {!activeCars.length && <div className="empty">אין רכבים בתהליך כרגע</div>}
              {activeCars.slice(0, 5).map((car) => {
                const stgs = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
                const done = stgs.filter((s) => s.status === 'done').length;
                const current = stgs.find((s) => s.status === 'in_progress');
                const clientLabel = car.profiles?.full_name || car.client_name || 'ללא לקוח';
                return (
                  <div key={car.id} className="side-item">
                    {car.image_url && (
                      <div className="feed-thumb">
                        <img src={car.image_url} alt={car.title} />
                      </div>
                    )}
                    <Link href={`/cars/${car.id}`} className="side-item-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{car.title}</div>
                        {car.year && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--primary)' }}>{car.year}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="feed-tag">{clientLabel}</span>
                        <span className="badge in_progress" style={{ fontSize: 10, padding: '1px 6px' }}>{current ? current.title : STAGES[done] || 'בתהליך'}</span>
                        <span className="muted" style={{ fontSize: 11 }}>{done}/6</span>
                      </div>
                    </Link>
                    <div className="side-item-actions">
                      <form action={deleteCarAction}>
                        <input type="hidden" name="id" value={car.id} />
                        <DeleteButton title="מחיקת רכב" />
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Auction Data Table */}
            {(auctions || []).length > 0 && (
              <div className="card" style={{ padding: 0 }}>
                <div className="live-header">
                  <div className="row" style={{ gap: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)' }}>מעקב מכרזים — Live</div>
                    <div className="row" style={{ gap: 6 }}>
                      <div className="live-dot" />
                      <span className="live-label">CONNECTED</span>
                    </div>
                  </div>
                  <Link href="/admin/auctions" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>הצג הכל</Link>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>רכב / תיק</th>
                        <th>מקור מכרז</th>
                        <th>הצעה מקס׳ (₪)</th>
                        <th>סגירה</th>
                        <th>סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(auctions || []).map((a) => (
                        <tr key={a.id} style={a.status === 'lost' ? { opacity: 0.5 } : undefined}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{a.car_title}</div>
                            {a.case_number && <div className="muted" style={{ fontSize: 11 }}>{a.case_number}</div>}
                          </td>
                          <td className="muted">{a.auction_source || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{Number(a.max_bid || 0).toLocaleString()}</td>
                          <td className="muted">{a.closing_date ? new Date(a.closing_date).toLocaleDateString('he-IL') : '—'}</td>
                          <td>
                            <span className={`badge ${auctionStatusClass[a.status] || ''}`} style={{ fontSize: 10, padding: '2px 8px' }}>
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

            {/* Clients table */}
            <div className="card">
              <div className="row between" style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>לקוחות</h3>
                <Link href="/admin/clients" className="btn small secondary">ניהול ({clients?.length || 0})</Link>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>שם</th><th>טלפון</th><th>קרדיטים</th><th>הצטרפות</th><th></th></tr></thead>
                  <tbody>
                    {clients?.slice(0, 6).map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.full_name || '—'}</td>
                        <td dir="ltr">{c.phone || '—'}</td>
                        <td>₪{Number(c.credits).toLocaleString()}</td>
                        <td className="muted">{new Date(c.created_at).toLocaleDateString('he-IL')}</td>
                        <td><Link href="/admin/messages" style={{ color: 'var(--accent)', fontSize: 12 }}>צ׳אט</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Hot Updates Feed */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)' }}>עדכונים אחרונים</div>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {!recentUpdatedCars.length && <div className="empty">אין עדכונים</div>}
                {recentUpdatedCars.map((car) => {
                  const done = (car.car_stages || []).filter(s => s.status === 'done').length;
                  return (
                    <Link key={car.id} href={`/cars/${car.id}`} className="feed-item">
                      {car.image_url && (
                        <div className="feed-thumb">
                          <img src={car.image_url} alt={car.title} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{car.title}</div>
                          {car.year && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--primary)' }}>{car.year}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span className="feed-tag">{done}/6 שלבים</span>
                          {car.profiles?.full_name && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--muted-dim)' }}>{car.profiles.full_name}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div style={{ padding: 8, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <Link href="/admin/cars" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>צפה בכל הרכבים</Link>
              </div>
            </div>

            {/* Meetings */}
            <div className="card">
              <div className="row between" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>יומן פגישות</h3>
                <Link href="/admin/calendar" className="btn small secondary">הצג הכל</Link>
              </div>
              {!upcomingMeetings.length && <div className="empty">אין פגישות קרובות</div>}
              {upcomingMeetings.slice(0, 5).map((m) => {
                const d = new Date(m.scheduled_at);
                return (
                  <div key={m.id} className="side-item">
                    <div className="side-item-content">
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {m.profiles?.full_name} · {d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div className="side-item-actions">
                      <div className="side-item-time">
                        {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <form action={deleteMeetingAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <DeleteButton title="מחיקה" />
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Orders */}
            <div className="card">
              <div className="row between" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>הזמנות דוחות</h3>
                <Link href="/admin/orders" className="btn small secondary">הצג הכל</Link>
              </div>
              {!orders?.length && <div className="empty">אין הזמנות</div>}
              {orders?.slice(0, 4).map((o) => (
                <div key={o.id} className="side-item">
                  <div className="side-item-content">
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.report_type}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {o.profiles?.full_name} · ₪{Number(o.amount).toLocaleString()} · {timeAgo(o.created_at)}
                    </div>
                  </div>
                  <div className="side-item-actions">
                    <span className={`badge ${o.status}`} style={{ fontSize: 10, padding: '2px 8px' }}>{statusLabel[o.status] || o.status}</span>
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

  // ===== CLIENT DASHBOARD =====
  // New clients (email or Google) must verify their phone and complete
  // onboarding before using the account.
  if (!profile?.phone_verified) redirect('/verify-phone');
  if (!profile?.onboarded) redirect('/onboarding');

  const [{ data: cars }, { data: meetings }, { data: recLists }, { data: auctions }, { data: orders }, { data: myCalls }] = await Promise.all([
    supabase.from('cars').select('*, car_stages(*), image_url').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('meetings').select('*').eq('client_id', user.id).eq('status', 'scheduled').order('scheduled_at'),
    supabase.from('recommendation_lists').select('*, recommended_cars(id)').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('auctions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('report_orders').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('call_bookings').select('id').eq('client_id', user.id).neq('status', 'cancelled').gte('starts_at', new Date().toISOString()).limit(1),
  ]);

  const activeAuctions = (auctions || []).filter(a => ['submitted', 'under_review', 'pending_release'].includes(a.status));
  const auctionStatusLabel = {
    submitted: 'הצעה הוגשה', under_review: 'בבדיקת כונס', won: 'זכייה',
    lost: 'לא זכה', cancelled: 'בוטל', pending_release: 'ממתין לשחרור',
  };
  const auctionStatusClass = {
    submitted: 'in_progress', under_review: 'awaiting_payment', won: 'paid',
    lost: 'cancelled', cancelled: 'cancelled', pending_release: 'in_progress',
  };
  const statusLabel = { awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל' };

  return (
    <Shell active="home">
      <WelcomeCallPopup hasBooking={!!myCalls?.length} />
      <div className="page-title">שלום, {profile?.full_name || 'לקוח'}</div>
      <div className="page-sub">סקירה כללית של הרכבים והפעילות שלך</div>

      <Link href="/book-call" className="card book-call-cta">
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>📞 קביעת שיחת אפיון</div>
          <div className="muted" style={{ fontSize: 12.5 }}>בחר שעה נוחה — נציג שלנו יתקשר אליך (ראשון-חמישי, 12:30-16:00)</div>
        </div>
        <span className="btn" style={{ pointerEvents: 'none' }}>לקביעת שיחה ←</span>
      </Link>

      <div className="grid cols-4" style={{ marginBottom: 4 }}>
        <div className="card stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>רכבים בתהליך</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <div className="num" style={{ textAlign: 'right' }}>{cars?.length || 0}</div>
        </div>
        <div className="card stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>יתרת קרדיטים</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="num" style={{ textAlign: 'right' }}>₪{Number(profile?.credits || 0).toLocaleString()}</div>
        </div>
        <div className="card stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>מכרזים פעילים</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div className="num" style={{ textAlign: 'right' }}>{activeAuctions.length}</div>
        </div>
        <div className="card stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-dim)' }}>פגישות מתוכננות</div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-dim)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div className="num" style={{ textAlign: 'right' }}>{meetings?.length || 0}</div>
        </div>
      </div>

      {/* Auction tracking table */}
      {(auctions || []).length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="live-header">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)' }}>מעקב מכרזים</div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>רכב / מכרז</th><th>הצעה מקס׳</th><th>תאריך סגירה</th><th>סטטוס</th></tr>
              </thead>
              <tbody>
                {(auctions || []).slice(0, 10).map((a) => (
                  <tr key={a.id} style={a.status === 'lost' ? { opacity: 0.5 } : undefined}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.car_title}</div>
                      {(a.auction_source || a.case_number) && (
                        <div className="muted" style={{ fontSize: 11 }}>{[a.auction_source, a.case_number].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>₪{Number(a.max_bid || 0).toLocaleString()}</td>
                    <td className="muted">{a.closing_date ? new Date(a.closing_date).toLocaleDateString('he-IL') : '—'}</td>
                    <td><span className={`badge ${auctionStatusClass[a.status] || ''}`}>{auctionStatusLabel[a.status] || a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cars + sidebar */}
      <div className="dashboard-layout">
        <div className="dashboard-main">
          <div className="card">
            <h3>הרכבים שלי</h3>
            {!cars?.length && <div className="empty">אין רכבים בתהליך</div>}
            {cars?.map((car) => {
              const done = (car.car_stages || []).filter((s) => s.status === 'done').length;
              const current = (car.car_stages || []).find((s) => s.status === 'in_progress');
              return (
                <Link key={car.id} href={`/cars/${car.id}`}>
                  <div className="side-item">
                    {car.image_url && (
                      <div className="feed-thumb">
                        <img src={car.image_url} alt={car.title} />
                      </div>
                    )}
                    <div className="side-item-content">
                      <div style={{ fontWeight: 600 }}>{car.title}</div>
                      <div className="muted">
                        {car.year ? `שנתון ${car.year}` : ''}{car.km ? ` · ${Number(car.km).toLocaleString()} ק"מ` : ''}
                      </div>
                    </div>
                    <div className="side-item-actions">
                      <div style={{ textAlign: 'left' }}>
                        <span className={`badge ${done >= 6 ? 'done' : 'in_progress'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                          {current ? current.title : done >= 6 ? 'הושלם' : STAGES[done] || 'בתהליך'}
                        </span>
                        <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>{done}/6</div>
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
                    <span className={`badge ${o.status}`} style={{ fontSize: 10, padding: '2px 8px' }}>{statusLabel[o.status] || o.status}</span>
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
                    {new Date(m.scheduled_at).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })}
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
