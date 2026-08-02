import { DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function deleteMeeting(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  await supabase.from('meetings').delete().eq('id', formData.get('id'));
  revalidatePath('/admin/calendar');
}

export default async function MeetingsListPage() {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, profiles(full_name)')
    .order('scheduled_at', { ascending: true });

  return (
    <Shell active="admin">
      <div className="page-title">כל הפגישות</div>
      <div className="page-sub">יומן פגישות מלא</div>
      <div className="card">
        {!meetings?.length && <div className="empty">אין פגישות</div>}
        <table className="data">
          <thead><tr><th>נושא</th><th>לקוח</th><th>תאריך</th><th>שעה</th><th>מיקום</th><th>סטטוס</th><th></th></tr></thead>
          <tbody>
            {meetings?.map((m) => {
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
    </Shell>
  );
}
