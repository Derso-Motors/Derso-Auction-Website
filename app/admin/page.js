import Shell from '../../components/Shell';
import { SubmitButton, DeleteButton } from '../../components/SubmitButton';
import { createClient, requireUser } from '../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const STAGES = ['זכייה במכרז', 'תשלום למכרז', 'שחרור הרכב', 'העברת בעלות', 'שינוע הרכב', 'מסירה ללקוח'];

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  return supabase;
}

async function addCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  await supabase.from('cars').insert({
    client_id: clientId === '__walk_in__' ? null : clientId,
    client_name: clientId === '__walk_in__' ? (formData.get('client_name') || 'לקוח חד-פעמי') : null,
    client_phone: clientId === '__walk_in__' ? (formData.get('client_phone') || null) : null,
    title: formData.get('title'),
    year: formData.get('year') ? Number(formData.get('year')) : null,
    km: formData.get('km') ? Number(formData.get('km')) : null,
    license_plate: formData.get('license_plate') || null,
    auction_link: formData.get('auction_link') || null,
    image_url: formData.get('image_url') || null,
    won_price: formData.get('won_price') ? Number(formData.get('won_price')) : null,
  });
  revalidatePath('/admin');
}

async function advanceStage(formData) {
  'use server';
  const supabase = await requireAdmin();
  const carId = formData.get('car_id');
  const step = Number(formData.get('step_number'));
  const note = formData.get('note');

  await supabase.from('car_stages').update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('car_id', carId).lte('step_number', step);
  await supabase.from('car_stages').update({ status: 'in_progress' })
    .eq('car_id', carId).eq('step_number', step + 1);
  await supabase.from('cars').update({ current_stage: step + 1 }).eq('id', carId);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: stage } = await supabase.from('car_stages').select('title').eq('car_id', carId).eq('step_number', step).single();
  await supabase.from('car_updates').insert({
    car_id: carId,
    author_id: user.id,
    stage_number: step,
    body: note?.trim() ? note.trim() : `השלב "${stage?.title}" הושלם`,
  });
  revalidatePath('/admin');
}

async function postUpdate(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('car_updates').insert({
    car_id: formData.get('car_id'),
    author_id: user.id,
    body: formData.get('body'),
  });
  revalidatePath('/admin');
}

async function addRecommendationList(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('recommendation_lists').insert({
    client_id: formData.get('client_id'),
    title: formData.get('title') || 'רכבים מומלצים',
  });
  revalidatePath('/admin');
}

async function addRecommendedCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('recommended_cars').insert({
    list_id: formData.get('list_id'),
    title: formData.get('title'),
    year: formData.get('year') ? Number(formData.get('year')) : null,
    km: formData.get('km') ? Number(formData.get('km')) : null,
    est_price: formData.get('est_price') ? Number(formData.get('est_price')) : null,
    list_price: formData.get('list_price') ? Number(formData.get('list_price')) : null,
    auction_link: formData.get('auction_link') || null,
    image_url: formData.get('image_url') || null,
    notes: formData.get('notes') || null,
  });
  revalidatePath('/admin');
}

async function addMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('meetings').insert({
    client_id: formData.get('client_id'),
    title: formData.get('title'),
    scheduled_at: new Date(formData.get('scheduled_at')).toISOString(),
    location: formData.get('location') || null,
  });
  revalidatePath('/admin');
}

async function grantCredits(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const amount = Number(formData.get('amount'));
  const { data: p } = await supabase.from('profiles').select('credits').eq('id', clientId).single();
  await supabase.from('profiles').update({ credits: Number(p?.credits || 0) + amount }).eq('id', clientId);
  await supabase.from('credit_transactions').insert({
    client_id: clientId, amount, reason: formData.get('reason') || 'זיכוי ידני',
  });
  revalidatePath('/admin');
}

async function updateOrderStatus(formData) {
  'use server';
  const supabase = await requireAdmin();
  const patch = { status: formData.get('status') };
  if (formData.get('file_url')) patch.file_url = formData.get('file_url');
  await supabase.from('report_orders').update(patch).eq('id', formData.get('order_id'));
  revalidatePath('/admin');
}

async function deleteCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  await supabase.from('car_updates').delete().eq('car_id', id);
  await supabase.from('car_stages').delete().eq('car_id', id);
  await supabase.from('cars').delete().eq('id', id);
  revalidatePath('/admin');
}

async function deleteRecommendationList(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  await supabase.from('recommended_cars').delete().eq('list_id', id);
  await supabase.from('recommendation_lists').delete().eq('id', id);
  revalidatePath('/admin');
}

async function deleteRecommendedCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('recommended_cars').delete().eq('id', formData.get('id'));
  revalidatePath('/admin');
}

async function deleteMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('meetings').delete().eq('id', formData.get('id'));
  revalidatePath('/admin');
}

async function deleteOrder(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('report_orders').delete().eq('id', formData.get('id'));
  revalidatePath('/admin');
}

async function deleteClient(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  await supabase.from('messages').delete().eq('client_id', id);
  await supabase.from('car_updates').delete().in('car_id', (await supabase.from('cars').select('id').eq('client_id', id)).data?.map(c => c.id) || []);
  await supabase.from('car_stages').delete().in('car_id', (await supabase.from('cars').select('id').eq('client_id', id)).data?.map(c => c.id) || []);
  await supabase.from('cars').delete().eq('client_id', id);
  await supabase.from('recommended_cars').delete().in('list_id', (await supabase.from('recommendation_lists').select('id').eq('client_id', id)).data?.map(l => l.id) || []);
  await supabase.from('recommendation_lists').delete().eq('client_id', id);
  await supabase.from('report_orders').delete().eq('client_id', id);
  await supabase.from('credit_transactions').delete().eq('client_id', id);
  await supabase.from('meetings').delete().eq('client_id', id);
  await supabase.from('profiles').delete().eq('id', id);
  revalidatePath('/admin');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `לפני ${mins} דקות`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

export default async function AdminPage() {
  const supabase = await requireAdmin();

  const [{ data: clients }, { data: cars }, { data: lists }, { data: orders }, { data: unread }, { data: meetings }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('cars').select('*, car_stages(*), profiles(full_name), client_name, client_phone').order('created_at', { ascending: false }),
    supabase.from('recommendation_lists').select('*, profiles(full_name), recommended_cars(id, title, client_interest)').order('created_at', { ascending: false }),
    supabase.from('report_orders').select('*, profiles(full_name)').order('created_at', { ascending: false }),
    supabase.from('messages').select('id, client_id, body, created_at, profiles(full_name)').eq('sender_role', 'client').eq('read', false).order('created_at', { ascending: false }),
    supabase.from('meetings').select('*, profiles(full_name)').order('scheduled_at', { ascending: true }),
  ]);

  const clientOptions = (clients || []).filter((c) => c.role === 'client');
  const statusLabel = { awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל' };
  const activeCars = (cars || []).filter(c => {
    const done = (c.car_stages || []).filter(s => s.status === 'done').length;
    return done < 6;
  });
  const pendingOrders = (orders || []).filter(o => o.status === 'awaiting_payment' || o.status === 'paid');
  const upcomingMeetings = (meetings || []).filter(m => new Date(m.scheduled_at) >= new Date());

  return (
    <Shell active="admin">
      <div className="page-title">ניהול</div>
      <div className="page-sub">ניהול לקוחות, רכבים, סטטוסים, המלצות ותשלומים</div>

      {unread?.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <h3>הודעות חדשות מלקוחות ({unread.length})</h3>
          {unread.slice(0, 5).map((m) => (
            <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <b>{m.profiles?.full_name}:</b> {m.body}
              <span className="muted"> · {new Date(m.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {' · '}<Link href={`/admin/chat/${m.client_id}`} style={{ color: 'var(--accent)' }}>מענה</Link>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-layout">
        {/* ===== RIGHT: Forms ===== */}
        <div className="dashboard-main">
          <div className="card">
            <h3>רכבים בתהליך</h3>
            {!cars?.length && <div className="empty">אין רכבים</div>}
            {cars?.map((car) => {
              const stages = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
              const done = stages.filter((s) => s.status === 'done').length;
              const nextStep = done < 6 ? done : null;
              return (
                <div key={car.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{car.title}</b> <span className="muted">— {car.profiles?.full_name || car.client_name || 'ללא לקוח'}{car.client_phone ? ` (${car.client_phone})` : ''}</span>
                      <div className="muted">{done}/6 שלבים הושלמו {done < 6 ? `· הבא: ${stages[done]?.title}` : '· הושלם'}</div>
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                      {nextStep !== null && (
                        <form action={advanceStage} className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <input type="hidden" name="car_id" value={car.id} />
                          <input type="hidden" name="step_number" value={done} />
                          <input name="note" placeholder="הערה (אופציונלי)" style={{ width: 160 }} />
                          <SubmitButton className="btn small">סיום שלב: {stages[done]?.title}</SubmitButton>
                        </form>
                      )}
                      <form action={deleteCar}>
                        <input type="hidden" name="id" value={car.id} />
                        <DeleteButton title="מחיקת רכב" />
                      </form>
                    </div>
                  </div>
                  <form action={postUpdate} className="row" style={{ marginTop: 8, gap: 6 }}>
                    <input type="hidden" name="car_id" value={car.id} />
                    <input name="body" placeholder="פרסום עדכון חופשי ללקוח..." required style={{ flex: 1 }} />
                    <SubmitButton className="btn small secondary">פרסום עדכון</SubmitButton>
                  </form>
                </div>
              );
            })}
          </div>

          <div className="grid cols-2">
            <div className="card">
              <h3>פגישה חדשה</h3>
              <form action={addMeeting}>
                <div className="field">
                  <label>לקוח</label>
                  <select name="client_id" required>
                    {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
                  </select>
                </div>
                <div className="field"><label>נושא</label><input name="title" required /></div>
                <div className="field"><label>מועד</label><input name="scheduled_at" type="datetime-local" required /></div>
                <div className="field"><label>מיקום</label><input name="location" /></div>
                <SubmitButton className="btn">קביעת פגישה</SubmitButton>
              </form>
            </div>

            <div className="card">
              <h3>הוספת רכב שנזכה</h3>
              <form action={addCar}>
                <div className="field">
                  <label>לקוח</label>
                  <select name="client_id" required>
                    {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
                    <option value="__walk_in__">+ לקוח חד-פעמי (לא רשום)</option>
                  </select>
                </div>
                <div className="field"><label>שם לקוח (ללא רשום)</label><input name="client_name" placeholder="שם הלקוח" /></div>
                <div className="field"><label>טלפון לקוח</label><input name="client_phone" placeholder="050-1234567" dir="ltr" /></div>
                <div className="field"><label>שם הרכב</label><input name="title" required placeholder="סקודה אוקטביה 2021" /></div>
                <div className="grid cols-2">
                  <div className="field"><label>שנתון</label><input name="year" type="number" /></div>
                  <div className="field"><label>ק"מ</label><input name="km" type="number" /></div>
                </div>
                <div className="grid cols-2">
                  <div className="field"><label>מספר רישוי</label><input name="license_plate" dir="ltr" /></div>
                  <div className="field"><label>מחיר זכייה</label><input name="won_price" type="number" /></div>
                </div>
                <div className="field"><label>קישור מכרז</label><input name="auction_link" dir="ltr" /></div>
                <div className="field"><label>קישור תמונה</label><input name="image_url" dir="ltr" /></div>
                <SubmitButton className="btn">הוספת רכב</SubmitButton>
              </form>
            </div>
          </div>

          <div className="card">
            <h3>זיכוי קרדיטים</h3>
            <form action={grantCredits} className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <select name="client_id" required style={{ width: 220 }}>
                {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id} (₪{Number(c.credits).toLocaleString()})</option>)}
              </select>
              <input name="amount" type="number" required placeholder="סכום ₪" style={{ width: 100 }} />
              <input name="reason" placeholder="סיבה" style={{ width: 160 }} />
              <SubmitButton className="btn small">זיכוי</SubmitButton>
            </form>
          </div>

          <div className="card">
            <h3>רשימות המלצות (שיחות איפיון)</h3>
            <form action={addRecommendationList} className="row" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
              <select name="client_id" required style={{ width: 200 }}>
                {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
              </select>
              <input name="title" placeholder="שם הרשימה" style={{ width: 220 }} />
              <SubmitButton className="btn small">יצירת רשימה</SubmitButton>
            </form>
            {lists?.map((l) => (
              <div key={l.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{l.title}</b> <span className="muted">— {l.profiles?.full_name}</span>
                    <div className="muted">
                      {(l.recommended_cars || []).length} רכבים ·
                      {' '}{(l.recommended_cars || []).filter((rc) => rc.client_interest === 'interested').length} מסומנים כמעניינים
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <span className="muted" dir="ltr" style={{ fontSize: 12.5 }}>/r/{l.share_token}</span>
                    <form action={deleteRecommendationList}>
                      <input type="hidden" name="id" value={l.id} />
                      <DeleteButton title="מחיקת רשימה" />
                    </form>
                  </div>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary className="muted" style={{ cursor: 'pointer' }}>הוספת רכב לרשימה</summary>
                  <form action={addRecommendedCar} style={{ marginTop: 10 }}>
                    <input type="hidden" name="list_id" value={l.id} />
                    <div className="grid cols-2">
                      <div className="field"><label>שם הרכב</label><input name="title" required /></div>
                      <div className="field"><label>שנתון</label><input name="year" type="number" /></div>
                      <div className="field"><label>ק"מ</label><input name="km" type="number" /></div>
                      <div className="field"><label>מחיר מחירון</label><input name="list_price" type="number" /></div>
                      <div className="field"><label>מחיר משוער</label><input name="est_price" type="number" /></div>
                      <div className="field"><label>קישור מכרז</label><input name="auction_link" dir="ltr" /></div>
                      <div className="field"><label>קישור תמונה</label><input name="image_url" dir="ltr" /></div>
                      <div className="field"><label>הערות</label><input name="notes" /></div>
                    </div>
                    <SubmitButton className="btn small">הוספה</SubmitButton>
                  </form>
                </details>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>לקוחות</h3>
            <table className="data">
              <thead><tr><th>שם</th><th>טלפון</th><th>תפקיד</th><th>קרדיטים</th><th>הצטרפות</th><th></th><th></th></tr></thead>
              <tbody>
                {clients?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.full_name || '—'}</td>
                    <td dir="ltr">{c.phone || '—'}</td>
                    <td>{c.role === 'admin' ? 'מנהל' : 'לקוח'}</td>
                    <td>₪{Number(c.credits).toLocaleString()}</td>
                    <td className="muted">{new Date(c.created_at).toLocaleDateString('he-IL')}</td>
                    <td><Link href={`/admin/chat/${c.id}`} style={{ color: 'var(--accent)' }}>צ׳אט</Link></td>
                    <td>
                      {c.role !== 'admin' && (
                        <form action={deleteClient}>
                          <input type="hidden" name="id" value={c.id} />
                          <DeleteButton title="מחיקת לקוח" />
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== LEFT: Sidebar — meetings, orders, cars ===== */}
        <div className="dashboard-side">
          {/* Meetings calendar */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>יומן פגישות</h3>
              <Link href="/admin/calendar" className="btn small secondary">הצג הכל ({meetings?.length || 0})</Link>
            </div>
            {!upcomingMeetings.length && <div className="empty">אין פגישות קרובות</div>}
            {upcomingMeetings.slice(0, 8).map((m) => {
              const d = new Date(m.scheduled_at);
              return (
                <div key={m.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {m.profiles?.full_name} · {d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                      {m.location ? ` · ${m.location}` : ''}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                    {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <form action={deleteMeeting}>
                    <input type="hidden" name="id" value={m.id} />
                    <DeleteButton title="מחיקה" />
                  </form>
                </div>
              );
            })}
          </div>

          {/* Report orders */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>הזמנות דוחות</h3>
              <Link href="/admin/orders" className="btn small secondary">הצג הכל ({orders?.length || 0})</Link>
            </div>
            {!orders?.length && <div className="empty">אין הזמנות</div>}
            {orders?.slice(0, 8).map((o) => (
              <div key={o.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.report_type}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {o.profiles?.full_name} · ₪{Number(o.amount).toLocaleString()} · {timeAgo(o.created_at)}
                  </div>
                </div>
                <span className={`badge ${o.status}`} style={{ fontSize: 10, padding: '2px 8px', flexShrink: 0 }}>{statusLabel[o.status] || o.status}</span>
                <form action={deleteOrder}>
                  <input type="hidden" name="id" value={o.id} />
                  <DeleteButton title="מחיקה" />
                </form>
              </div>
            ))}
          </div>

          {/* Active cars */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>רכבים בטיפול</h3>
              <Link href="/admin/cars" className="btn small secondary">הצג הכל ({activeCars.length})</Link>
            </div>
            {!activeCars.length && <div className="empty">אין רכבים בתהליך</div>}
            {activeCars.slice(0, 8).map((car) => {
              const stages = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
              const done = stages.filter((s) => s.status === 'done').length;
              const current = stages.find((s) => s.status === 'in_progress');
              const clientLabel = car.profiles?.full_name || car.client_name || 'ללא לקוח';
              return (
                <div key={car.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', gap: 6 }}>
                  <Link href={`/cars/${car.id}`} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{car.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {clientLabel}
                      {car.year ? ` · ${car.year}` : ''}{car.license_plate ? ` · ${car.license_plate}` : ''}
                    </div>
                  </Link>
                  <div style={{ textAlign: 'left', flexShrink: 0 }}>
                    <span className="badge in_progress" style={{ fontSize: 10, padding: '2px 8px' }}>{current ? current.title : STAGES[done] || 'בתהליך'}</span>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{done}/6</div>
                  </div>
                  <form action={deleteCar}>
                    <input type="hidden" name="id" value={car.id} />
                    <DeleteButton title="מחיקה" />
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
