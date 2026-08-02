import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { timeAgo } from '../../../lib/utils';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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
  await supabase.from('meetings').insert({
    client_id: formData.get('client_id'),
    title: formData.get('title'),
    scheduled_at: new Date(formData.get('scheduled_at')).toISOString(),
    location: formData.get('location') || null,
  });
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
    supabase.from('profiles').select('id, full_name, role').eq('role', 'client').order('full_name'),
  ]);

  const clientOptions = clients || [];

  return (
    <Shell active="calendar">
      <div className="page-title">יומן פגישות</div>
      <div className="page-sub">קביעה וניהול פגישות</div>

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
                          <td>{m.profiles?.full_name || '—'}</td>
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
                </select>
              </div>
              <div className="field"><label>נושא</label><input name="title" required /></div>
              <div className="field"><label>מועד</label><input name="scheduled_at" type="datetime-local" required /></div>
              <div className="field"><label>מיקום</label><input name="location" /></div>
              <SubmitButton className="btn">קביעת פגישה</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
