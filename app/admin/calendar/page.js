import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { timeAgo } from '../../../lib/utils';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sendWhatsApp } from '../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

async function addMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const isWalkIn = clientId === '__walk_in__';
  const title = formData.get('title');
  const scheduledAt = new Date(formData.get('scheduled_at'));
  const location = formData.get('location') || null;
  const clientName = isWalkIn ? (formData.get('client_name') || 'לקוח חד-פעמי') : null;
  const clientPhone = isWalkIn ? (formData.get('client_phone') || null) : null;

  await supabase.from('meetings').insert({
    client_id: isWalkIn ? null : clientId,
    title,
    scheduled_at: scheduledAt.toISOString(),
    location,
    client_name: clientName,
    client_phone: clientPhone,
  });

  let phone = clientPhone;
  let name = clientName;
  if (!isWalkIn && clientId) {
    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', clientId).single();
    phone = profile?.phone;
    name = profile?.full_name;
  }

  if (phone) {
    const dateStr = scheduledAt.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = scheduledAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const msg = `שלום ${name || ''},\nנקבעה פגישה חדשה:\n📋 ${title}\n📅 ${dateStr} בשעה ${timeStr}${location ? `\n📍 ${location}` : ''}\n\nדרסו — בית ליווי מקצועי למכרזים`;
    await sendWhatsApp(phone, msg);
  }

  revalidatePath('/admin/calendar');
}

async function deleteMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('meetings').delete().eq('id', formData.get('id'));
  revalidatePath('/admin/calendar');
}

export default async function CalendarPage() {
  const supabase = await requireAdmin();

  const [{ data: meetings }, { data: clients }] = await Promise.all([
    supabase.from('meetings').select('*, profiles(full_name)').order('scheduled_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name, phone, role').eq('role', 'client').order('full_name'),
  ]);

  const clientOptions = clients || [];

  return (
    <Shell active="calendar">
      <div className="page-title">יומן פגישות</div>
      <div className="page-sub">קביעה וניהול פגישות — הודעת וואטסאפ נשלחת אוטומטית ללקוח</div>

      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>כל הפגישות</h3>
            {!meetings?.length && <div className="empty">אין פגישות</div>}
            {meetings?.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>נושא</th><th>לקוח</th><th>תאריך</th><th>שעה</th><th>מתי</th><th>מיקום</th><th>סטטוס</th><th></th></tr></thead>
                  <tbody>
                    {meetings.map((m) => {
                      const d = new Date(m.scheduled_at);
                      const isPast = d < new Date();
                      return (
                        <tr key={m.id} style={{ opacity: isPast ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 600 }}>{m.title}</td>
                          <td>{m.profiles?.full_name || m.client_name || '—'}</td>
                          <td>{d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--primary)' }}>
                            {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="muted">{timeAgo(m.scheduled_at)}</td>
                          <td>{m.location || '—'}</td>
                          <td><span className={`badge ${isPast ? 'done' : 'in_progress'}`}>{isPast ? 'עבר' : 'מתוכנן'}</span></td>
                          <td>
                            <form action={deleteMeeting}>
                              <input type="hidden" name="id" value={m.id} />
                              <DeleteButton title="מחיקה" />
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="admin-col-left">
          <div className="card">
            <h3>פגישה חדשה</h3>
            <form action={addMeeting}>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id" required>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
                  <option value="__walk_in__">+ לקוח חד-פעמי (לא רשום)</option>
                </select>
              </div>
              <div className="field"><label>שם לקוח (ללא רשום)</label><input name="client_name" placeholder="שם הלקוח" /></div>
              <div className="field"><label>טלפון לקוח</label><input name="client_phone" placeholder="050-1234567" dir="ltr" /></div>
              <div className="field"><label>נושא</label><input name="title" required /></div>
              <div className="field"><label>מועד</label><input name="scheduled_at" type="datetime-local" required /></div>
              <div className="field"><label>מיקום</label><input name="location" /></div>
              <SubmitButton className="btn">קביעת פגישה + שליחת וואטסאפ</SubmitButton>
            </form>
          </div>

          <div className="card" style={{ background: 'var(--surface-lowest)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>וואטסאפ אוטומטי</span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              בקביעת פגישה, הודעת וואטסאפ נשלחת אוטומטית ללקוח עם פרטי הפגישה מהמספר +972 55-950-6913.
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
