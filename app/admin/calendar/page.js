import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import DateTimePicker from '../../../components/DateTimePicker';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sendWhatsApp } from '../../../lib/whatsapp';
import { timeAgo } from '../../../lib/utils';

export const dynamic = 'force-dynamic';

const TZ = 'Asia/Jerusalem';

const MEETING_TYPES = [
  {
    value: 'שיחת איפיון',
    label: '📋 שיחת איפיון',
    location: 'טלפון',
    emoji: '📋',
    template: (name, title, dateStr, timeStr, notes) =>
      `שלום ${name || ''},\nתודה על הפנייה לדרסו 🙏\n\nקבענו לך *שיחת איפיון* כדי להבין מה בדיוק אתה מחפש ולהתאים לך את המסלול הנכון.\n\n📅 ${dateStr} בשעה ${timeStr}\n📞 נתקשר אליך מהמספר שלנו${notes ? `\n📝 ${notes}` : ''}\n\nאם יש שינוי — תעדכן אותנו 👍\n\n_דרסו — בית ליווי מקצועי למכרזים_`,
  },
  {
    value: 'שיחת מכרז טלפונית',
    label: '📞 שיחת מכרז טלפונית',
    location: 'טלפון',
    emoji: '📞',
    template: (name, title, dateStr, timeStr, notes) =>
      `שלום ${name || ''},\nנקבעה לך *שיחת מכרז טלפונית* 🏎️\n\n📋 ${title}\n📅 ${dateStr} בשעה ${timeStr}\n📞 נתקשר אליך בשעה שנקבעה${notes ? `\n📝 ${notes}` : ''}\n\nנא להיות זמין/ה — השיחה חשובה לתהליך 🔑\n\n_דרסו — בית ליווי מקצועי למכרזים_`,
  },
  {
    value: 'פגישת מכרז במשרד',
    label: '🏢 פגישת מכרז במשרד',
    location: 'פגישה במשרדנו',
    emoji: '🏢',
    template: (name, title, dateStr, timeStr, notes) =>
      `שלום ${name || ''},\nנקבעה לך *פגישת מכרז במשרדנו* 🏎️\n\n📋 ${title}\n📅 ${dateStr} בשעה ${timeStr}\n🏢 המשרד שלנו${notes ? `\n📝 ${notes}` : ''}\n\nנשמח לראות אותך! נא להגיע בזמן 🙏\n\n_דרסו — בית ליווי מקצועי למכרזים_`,
  },
  {
    value: 'פגישה במשרדנו',
    label: '🤝 פגישה במשרדנו',
    location: 'פגישה במשרדנו',
    emoji: '🤝',
    template: (name, title, dateStr, timeStr, notes) =>
      `שלום ${name || ''},\nנקבעה פגישה במשרדנו 🤝\n\n📋 ${title}\n📅 ${dateStr} בשעה ${timeStr}\n🏢 המשרד שלנו${notes ? `\n📝 ${notes}` : ''}\n\nנשמח לראות אותך!\n\n_דרסו — בית ליווי מקצועי למכרזים_`,
  },
  {
    value: 'שיחת וידאו',
    label: '📹 שיחת וידאו',
    location: 'שיחת וידאו',
    emoji: '📹',
    template: (name, title, dateStr, timeStr, notes) =>
      `שלום ${name || ''},\nנקבעה לך *שיחת וידאו* 📹\n\n📋 ${title}\n📅 ${dateStr} בשעה ${timeStr}\n💻 קישור לשיחה יישלח לפני הפגישה${notes ? `\n📝 ${notes}` : ''}\n\n_דרסו — בית ליווי מקצועי למכרזים_`,
  },
  {
    value: 'שיחה טלפונית',
    label: '📱 שיחה טלפונית רגילה',
    location: 'טלפון',
    emoji: '📱',
    template: (name, title, dateStr, timeStr, notes) =>
      `שלום ${name || ''},\nנקבעה שיחה טלפונית 📱\n\n📋 ${title}\n📅 ${dateStr} בשעה ${timeStr}\n📞 נתקשר אליך${notes ? `\n📝 ${notes}` : ''}\n\n_דרסו — בית ליווי מקצועי למכרזים_`,
  },
];

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
  const raw = formData.get('scheduled_at');
  const scheduledAt = raw ? new Date(raw) : new Date(NaN);
  if (isNaN(scheduledAt.getTime())) {
    redirect('/admin/calendar?err=' + encodeURIComponent('לא נבחרו תאריך ושעה — בחר מועד ונסה שוב'));
  }
  const meetingType = formData.get('meeting_type') || 'שיחה טלפונית';
  const typeConfig = MEETING_TYPES.find((t) => t.value === meetingType) || MEETING_TYPES[MEETING_TYPES.length - 1];

  // Business-hours rules (Israel time): Sun-Thu until 18:00; Friday phone calls only, 10:00-14:00
  const il = new Date(scheduledAt.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const ilHour = il.getHours() + il.getMinutes() / 60;
  const ilDow = il.getDay();
  if (ilDow === 6) {
    redirect('/admin/calendar?err=' + encodeURIComponent('אין קביעת פגישות בשבת'));
  }
  if (ilDow === 5) {
    if (typeConfig.location !== 'טלפון') {
      redirect('/admin/calendar?err=' + encodeURIComponent('ביום שישי אפשר לקבוע שיחות טלפון בלבד'));
    }
    if (ilHour < 10 || ilHour >= 14) {
      redirect('/admin/calendar?err=' + encodeURIComponent('ביום שישי קובעים שיחות בין 10:00 ל-14:00 בלבד'));
    }
  } else if (ilHour < 7 || ilHour >= 18) {
    redirect('/admin/calendar?err=' + encodeURIComponent('קביעת פגישות אפשרית עד 18:00 בלבד'));
  }
  const clientName = isWalkIn ? (formData.get('client_name') || 'לקוח חד-פעמי') : null;
  const clientPhone = isWalkIn ? (formData.get('client_phone') || null) : null;
  const notes = formData.get('notes') || null;

  // Prevent double-booking: check if a meeting already exists at this time
  const { data: existing } = await supabase
    .from('meetings')
    .select('id')
    .eq('scheduled_at', scheduledAt.toISOString())
    .limit(1);
  if (existing && existing.length > 0) {
    redirect('/admin/calendar?err=' + encodeURIComponent('השעה הזו כבר תפוסה — בחר שעה אחרת'));
  }

  const { error } = await supabase.from('meetings').insert({
    client_id: isWalkIn ? null : clientId,
    title,
    scheduled_at: scheduledAt.toISOString(),
    location: meetingType,
    client_name: clientName,
    client_phone: clientPhone,
    notes,
  });
  if (error) redirect('/admin/calendar?err=' + encodeURIComponent('שגיאה בקביעת הפגישה'));

  let phone = clientPhone;
  let name = clientName;
  if (!isWalkIn && clientId) {
    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', clientId).single();
    phone = profile?.phone;
    name = profile?.full_name;
  }

  if (phone) {
    const dateStr = scheduledAt.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
    const timeStr = scheduledAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    const msg = typeConfig.template(name, title, dateStr, timeStr, notes);
    await sendWhatsApp(phone, msg);
  }

  revalidatePath('/admin/calendar');
  redirect('/admin/calendar?ok=' + encodeURIComponent(phone ? 'הפגישה נקבעה ונשלחה הודעת וואטסאפ ✓' : 'הפגישה נקבעה ✓'));
}

async function deleteMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('meetings').delete().eq('id', formData.get('id'));
  if (error) redirect('/admin/calendar?err=' + encodeURIComponent('שגיאה במחיקת הפגישה'));
  revalidatePath('/admin/calendar');
  redirect('/admin/calendar?ok=' + encodeURIComponent('הפגישה נמחקה ✓'));
}

export default async function CalendarPage() {
  const supabase = await requireAdmin();

  const [{ data: meetings }, { data: clients }] = await Promise.all([
    supabase.from('meetings').select('*, profiles(full_name)').order('scheduled_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name, phone, role').eq('role', 'client').order('full_name'),
  ]);

  const clientOptions = clients || [];

  const bookedSlots = (meetings || [])
    .filter((m) => new Date(m.scheduled_at) >= new Date())
    .map((m) => m.scheduled_at);

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
                  <thead><tr><th>נושא</th><th>לקוח</th><th>טלפון</th><th>תאריך</th><th>שעה</th><th>סוג</th><th>הערות</th><th>סטטוס</th><th></th></tr></thead>
                  <tbody>
                    {meetings.map((m) => {
                      const d = new Date(m.scheduled_at);
                      const isPast = d < new Date();
                      const typeConf = MEETING_TYPES.find((t) => t.value === m.location);
                      return (
                        <tr key={m.id} style={{ opacity: isPast ? 0.5 : 1 }}>
                          <td style={{ fontWeight: 600 }}>{m.title}</td>
                          <td>{m.profiles?.full_name || m.client_name || '—'}</td>
                          <td dir="ltr" style={{ fontSize: 12 }}>{m.client_phone || '—'}</td>
                          <td>{d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--primary)' }}>
                            {d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}
                          </td>
                          <td>{typeConf ? `${typeConf.emoji} ${typeConf.value}` : (m.location || '—')}</td>
                          <td className="muted" style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
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
              <div className="field">
                <label>סוג פגישה</label>
                <select name="meeting_type" required>
                  {MEETING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="field"><label>הערות / קריטריונים</label><textarea name="notes" rows={2} placeholder="רכב מתחת למחירון, סוזוקי 2020+ וכו׳" style={{ resize: 'vertical' }} /></div>
              <div className="field"><label>מועד</label><DateTimePicker name="scheduled_at" required includeTime bookedSlots={bookedSlots} /></div>
              <SubmitButton className="btn">קביעת פגישה + שליחת וואטסאפ</SubmitButton>
            </form>
          </div>

          <div className="card" style={{ background: 'var(--surface-lowest)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>וואטסאפ אוטומטי</span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              בקביעת פגישה, הודעת וואטסאפ מותאמת לסוג הפגישה נשלחת אוטומטית ללקוח מהמספר +972 55-950-6913.
              <br />תזכורות נשלחות יום לפני ו-15 דקות לפני הפגישה.
            </div>
          </div>

          <div className="card" style={{ background: 'var(--surface-lowest)', border: '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: 8, fontSize: 13 }}>📨 תבניות הודעות לפי סוג</h4>
            <div className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
              <strong>📋 שיחת איפיון</strong> — הודעת היכרות, "להבין מה אתה מחפש"<br/>
              <strong>📞 שיחת מכרז טלפונית</strong> — "נא להיות זמין, השיחה חשובה"<br/>
              <strong>🏢 פגישת מכרז במשרד</strong> — הזמנה למשרד עם פרטי המכרז<br/>
              <strong>🤝 פגישה במשרדנו</strong> — פגישה כללית במשרד<br/>
              <strong>📹 שיחת וידאו</strong> — "קישור יישלח לפני הפגישה"<br/>
              <strong>📱 שיחה טלפונית רגילה</strong> — הודעה פשוטה ונקייה
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
