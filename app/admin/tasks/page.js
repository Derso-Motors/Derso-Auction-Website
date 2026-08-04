import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { processTaskReminders } from '../../../lib/broadcast';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PAGE = '/admin/tasks';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

function ilDayRange() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(now); // YYYY-MM-DD in IL time
  // IL offset in minutes right now
  const offsetMin = (new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })) - new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))) / 60000;
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setMinutes(start.getMinutes() - offsetMin);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
}
function fmtWhen(iso) {
  return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
}

/* ── Server actions ─────────────────────────────────────────────────────────── */

async function addTask(formData) {
  'use server';
  const supabase = await requireAdmin();
  const date = formData.get('due_date');
  const time = formData.get('due_time');
  let due = null;
  if (date) due = new Date(`${date}T${time || '09:00'}:00+03:00`).toISOString();
  const kind = formData.get('kind') === 'note' ? 'note' : 'task';
  const { error } = await supabase.from('admin_tasks').insert({
    kind,
    title: formData.get('title'),
    details: formData.get('details') || null,
    due_at: due,
    remind: formData.get('remind') === 'on' && !!due,
  });
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('ההוספה נכשלה'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent(kind === 'note' ? 'ההערה נוספה ✓' : 'המשימה נוספה ✓'));
}

async function toggleDone(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const { data: t } = await supabase.from('admin_tasks').select('done').eq('id', id).single();
  const { error } = await supabase.from('admin_tasks').update({ done: !t?.done }).eq('id', id);
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('עדכון הסטטוס נכשל'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent(!t?.done ? 'סומן כבוצע ✓' : 'הוחזר לפתוח ✓'));
}

async function deleteTask(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('admin_tasks').delete().eq('id', formData.get('id'));
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('המחיקה נכשלה'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('הפריט נמחק ✓'));
}

async function saveOwnerPhone(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('broadcast_settings').update({ owner_phone: formData.get('phone') || null }).eq('id', 1);
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('שמירת המספר נכשלה'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('מספר הטלפון נשמר ✓'));
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default async function TasksPage() {
  const supabase = await requireAdmin();

  // Fire any due reminders when the page opens (the cron does it headlessly too).
  await processTaskReminders(supabase);

  const { start, end } = ilDayRange();
  const [{ data: tasks }, { data: todayMeetings }, { data: settings }] = await Promise.all([
    supabase.from('admin_tasks').select('*').order('done').order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
    supabase.from('meetings').select('*, profiles(full_name)').gte('scheduled_at', start).lt('scheduled_at', end).order('scheduled_at'),
    supabase.from('broadcast_settings').select('owner_phone').eq('id', 1).single(),
  ]);

  const all = tasks || [];
  const todayTasks = all.filter((t) => !t.done && t.due_at && t.due_at >= start && t.due_at < end);
  const openTasks = all.filter((t) => t.kind === 'task' && !t.done && !(t.due_at && t.due_at >= start && t.due_at < end));
  const notes = all.filter((t) => t.kind === 'note' && !t.done);
  const doneTasks = all.filter((t) => t.done).slice(0, 15);

  const row = (t) => (
    <div key={t.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid rgba(68,71,77,0.3)', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <span style={t.done ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
          {t.kind === 'note' ? '📝' : '☑️'} <b>{t.title}</b>
        </span>
        {t.details && <div className="muted" style={{ fontSize: 12.5 }}>{t.details}</div>}
        <div className="muted" style={{ fontSize: 11.5 }}>
          {t.due_at && <>⏰ {fmtWhen(t.due_at)}{t.remind && !t.reminded_at && ' · תזכורת תישלח'}{t.reminded_at && ' · ✅ תזכורת נשלחה'}</>}
          {t.source !== 'site' && <> · מקור: {t.source === 'whatsapp' ? 'וואטסאפ 🤖' : t.source}</>}
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexShrink: 0 }}>
        <form action={toggleDone}>
          <input type="hidden" name="id" value={t.id} />
          <SubmitButton className="btn secondary small">{t.done ? '↩️' : '✅ בוצע'}</SubmitButton>
        </form>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={t.id} />
          <DeleteButton title="מחיקה" />
        </form>
      </div>
    </div>
  );

  return (
    <Shell active="tasks">
      <div className="page-title">משימות והיום 🗓️</div>
      <div className="page-sub">מה על הפרק היום — פגישות, משימות והערות, עם תזכורות לוואטסאפ</div>

      {/* Today */}
      <div className="card" style={{ borderColor: 'rgba(186,199,227,0.5)' }}>
        <h3>היום — {new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric' })}</h3>
        {!todayMeetings?.length && !todayTasks.length && <div className="empty">יום פנוי — אין פגישות ואין משימות להיום 🎉</div>}
        {todayMeetings?.map((m) => (
          <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(68,71,77,0.3)' }}>
            📅 <b>{fmtTime(m.scheduled_at)}</b> — {m.title}
            <span className="muted"> · {m.profiles?.full_name || m.client_name}{m.location && ` · ${m.location}`}</span>
          </div>
        ))}
        {todayTasks.map(row)}
        <div style={{ marginTop: 10 }}>
          <Link href="/admin/calendar" className="rec-link">ליומן הפגישות המלא ←</Link>
        </div>
      </div>

      {/* Quick add */}
      <div className="card">
        <h3>הוספה מהירה</h3>
        <form action={addTask}>
          <div className="grid cols-2">
            <div className="field"><label>מה לעשות / לזכור? *</label><input name="title" required placeholder="להתקשר לראול לגבי המרצדס" /></div>
            <div className="field">
              <label>סוג</label>
              <select name="kind">
                <option value="task">☑️ משימה</option>
                <option value="note">📝 הערה / לזכור</option>
              </select>
            </div>
            <div className="field"><label>תאריך יעד</label><input name="due_date" type="date" dir="ltr" /></div>
            <div className="field"><label>שעה</label><input name="due_time" type="time" dir="ltr" defaultValue="09:00" /></div>
          </div>
          <div className="field"><label>פירוט (אופציונלי)</label><input name="details" placeholder="פרטים נוספים..." /></div>
          <label className="row" style={{ gap: 8, fontSize: 13.5, cursor: 'pointer', marginBottom: 10 }}>
            <input type="checkbox" name="remind" defaultChecked style={{ width: 'auto' }} />
            שלח לי תזכורת בוואטסאפ בשעת היעד
          </label>
          <SubmitButton className="btn">+ הוספה</SubmitButton>
        </form>
      </div>

      {/* Open tasks + notes */}
      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>משימות פתוחות ({openTasks.length})</h3>
            {!openTasks.length && <div className="empty">אין משימות פתוחות</div>}
            {openTasks.map(row)}
          </div>
        </div>
        <div className="admin-col-left">
          <div className="card">
            <h3>הערות ודברים לזכור ({notes.length})</h3>
            {!notes.length && <div className="empty">אין הערות</div>}
            {notes.map(row)}
          </div>
        </div>
      </div>

      {/* Done */}
      {doneTasks.length > 0 && (
        <div className="card">
          <h3>בוצעו לאחרונה</h3>
          {doneTasks.map(row)}
        </div>
      )}

      {/* Reminder phone */}
      <div className="card">
        <h3>לאן לשלוח תזכורות?</h3>
        <form action={saveOwnerPhone} className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 200, marginBottom: 0 }}>
            <label>מספר וואטסאפ לתזכורות</label>
            <input name="phone" dir="ltr" defaultValue={settings?.owner_phone || ''} placeholder="0501234567" />
          </div>
          <SubmitButton className="btn secondary">שמירה</SubmitButton>
        </form>
        {!settings?.owner_phone && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>⚠️ בלי מספר — תזכורות לא יישלחו</p>}
      </div>
    </Shell>
  );
}
