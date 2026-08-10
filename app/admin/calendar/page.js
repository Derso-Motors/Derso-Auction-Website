import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import DateTimePicker from '../../../components/DateTimePicker';
import MeetingsTable from '../../../components/MeetingsTable';
import { ilDateTimeToUtc } from '../../../lib/callBookings';
import { requireUser } from '../../../lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
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
  const { supabase, user } = await requireUser(); // מאמת זהות (getUser)
  // בדיקת התפקיד עם service-role — עמידה לתקלת auth-context של server actions
  // ש"החזירה" את המנהל לדף הבית אחרי קביעת פגישה. אם אין service key — נופלים לחיבור הרגיל.
  let role = null;
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data } = await svc.from('profiles').select('role').eq('id', user.id).single();
      role = data?.role ?? null;
    } else {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      role = data?.role ?? null;
    }
  } catch { role = null; }
  if (role !== 'admin') redirect('/');
  return supabase; // הפעולות על הנתונים ממשיכות עם חיבור המשתמש (RLS חל)
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

  // Business-hours rules (Israel time): Sun-Thu until 17:00 (last meeting 16:45); Friday phone calls only, 10:00-14:00.
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
  } else {
    if (ilHour < 9 || ilHour >= 17) {
      redirect('/admin/calendar?err=' + encodeURIComponent('קביעת פגישות אפשרית בין 09:00 ל-17:00 (פגישה אחרונה 16:45)'));
    }
    // Lunch break: 14:15–15:00 (not including 15:00)
    const ilMinutes = il.getHours() * 60 + il.getMinutes();
    if (ilMinutes >= 14 * 60 + 15 && ilMinutes < 15 * 60) {
      redirect('/admin/calendar?err=' + encodeURIComponent('הפסקת צהריים 🍽️ — לא ניתן לקבוע פגישות בין 14:15 ל-15:00'));
    }
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

  const { data: meeting, error } = await supabase.from('meetings').insert({
    client_id: isWalkIn ? null : clientId,
    title,
    scheduled_at: scheduledAt.toISOString(),
    location: meetingType,
    client_name: clientName,
    client_phone: clientPhone,
    notes,
  }).select('id').single();
  if (error) redirect('/admin/calendar?err=' + encodeURIComponent('שגיאה בקביעת הפגישה'));

  // הסנכרון ליומן החדש (derso.motors) נעשה בענן: Supabase Edge Function 'gcal-sync'
  // + pg_cron כל דקה קורא את הפגישות ויוצר אותן ב-Google Calendar (gcal_event_id
  // נשאר null עד שהענן מסנכרן). לא Apps Script (הצביע ליומן הישן) ולא הבוט.

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

async function rescheduleMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = String(formData.get('id') || '');
  const when = String(formData.get('when') || ''); // "YYYY-MM-DDTHH:MM" Israel local
  const P = '/admin/calendar';
  const m = when.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  const newAt = m ? ilDateTimeToUtc(m[1], m[2]) : new Date(when);
  if (!id || isNaN(newAt.getTime())) redirect(P + '?err=' + encodeURIComponent('מועד לא תקין'));

  const { data: row } = await supabase.from('meetings')
    .select('gcal_event_id, title, client_name, client_phone, scheduled_at')
    .eq('id', id).single();
  if (!row) redirect(P + '?err=' + encodeURIComponent('הפגישה לא נמצאה'));

  // old calendar event goes to the deletion queue; sync recreates at the new time
  if (row.gcal_event_id) {
    try { await supabase.from('cal_deletions').upsert({ gcal_event_id: row.gcal_event_id }); } catch {}
  }
  const { error } = await supabase.from('meetings').update({
    scheduled_at: newAt.toISOString(),
    status: 'scheduled',
    gcal_event_id: null,
    reminder_1d_sent: false,
    reminder_15m_sent: false,
    reminder_1h_sent: false,
  }).eq('id', id);
  if (error) redirect(P + '?err=' + encodeURIComponent('שינוי המועד נכשל'));

  if (row.client_phone) {
    const nice = newAt.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    await sendWhatsApp(row.client_phone,
      `שלום ${row.client_name || ''},\nעדכון: הפגישה "${row.title}" הועברה למועד חדש — ${nice}.\nנתראה! 🚗\n\nדרסו — בית ליווי מקצועי למכרזים`);
  }
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('המועד עודכן והלקוח קיבל וואטסאפ ✓'));
}

async function deleteMeeting(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  // שולפים את מלוא הפרטים לפני המחיקה (לצורך ביטול ביומן + התראה ללקוח).
  const { data: m } = await supabase
    .from('meetings')
    .select('gcal_event_id, title, scheduled_at, location, client_id, client_name, client_phone, profiles(full_name, phone)')
    .eq('id', id).single();

  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) redirect('/admin/calendar?err=' + encodeURIComponent('שגיאה במחיקת הפגישה'));

  // 1) מחיקת האירוע מהיומן החדש — דרך הבוט (תור מחיקות). כך זה נמחק מהיומן הנכון.
  if (m?.gcal_event_id) {
    try { await supabase.from('cal_deletions').upsert({ gcal_event_id: m.gcal_event_id }); } catch {}
  }

  // 2) התראת ביטול ללקוח בוואטסאפ.
  const phone = m?.client_phone || m?.profiles?.phone;
  const name = m?.client_name || m?.profiles?.full_name || '';
  if (phone && m?.scheduled_at) {
    const dateStr = new Date(m.scheduled_at).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
    const timeStr = new Date(m.scheduled_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    const msg = `שלום${name ? ' ' + name : ''},\nהפגישה שנקבעה ל${dateStr} בשעה ${timeStr} בוטלה. 🗓️\nלתיאום מועד חדש — אנחנו כאן.\nדרסו — בית ליווי מקצועי למכרזים 🚗`;
    try { await sendWhatsApp(phone, msg); } catch {}
  }

  revalidatePath('/admin/calendar');
  redirect('/admin/calendar?ok=' + encodeURIComponent(phone ? 'הפגישה נמחקה, בוטלה ביומן ונשלחה הודעת ביטול ללקוח ✓' : 'הפגישה נמחקה ובוטלה ביומן ✓'));
}

export default async function CalendarPage() {
  const supabase = await requireAdmin();

  const [{ data: meetings }, { data: clients }] = await Promise.all([
    supabase.from('meetings').select('*, profiles(full_name, phone)').order('scheduled_at', { ascending: true }),
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
            <MeetingsTable
              deleteAction={deleteMeeting}
              meetingTypes={MEETING_TYPES.map((t) => ({ value: t.value, emoji: t.emoji }))}
              meetings={(meetings || []).map((m) => ({
                id: m.id,
                title: m.title,
                name: m.profiles?.full_name || m.client_name || '',
                phone: m.client_phone || m.profiles?.phone || '',
                scheduled_at: m.scheduled_at,
                location: m.location,
                notes: m.notes,
              }))}
            />
          </div>
        </div>

        <div className="admin-col-left">
          <div className="card">
            <h3>פגישה חדשה</h3>
            <form action={addMeeting}>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id" required defaultValue="__walk_in__">
                  <option value="__walk_in__">+ לקוח חד-פעמי (לא רשום)</option>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
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

          <div className="card">
            <h3>🕐 עדכון פגישה</h3>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
              בוחרים פגישה קיימת ומועד חדש — היומן מתעדכן, הלקוח מקבל וואטסאפ והתזכורות מתאפסות.
            </p>
            <form action={rescheduleMeeting}>
              <div className="field">
                <label>פגישה</label>
                <select name="id" required defaultValue="">
                  <option value="" disabled>— בחר פגישה —</option>
                  {(meetings || []).filter((m) => new Date(m.scheduled_at) > new Date()).map((m) => (
                    <option key={m.id} value={m.id}>
                      {[m.client_name || m.name, m.title].filter(Boolean).join(' — ')} · {new Date(m.scheduled_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>מועד חדש</label>
                <DateTimePicker name="when" includeTime required />
              </div>
              <SubmitButton className="btn" style={{ width: '100%' }}>עדכון הפגישה</SubmitButton>
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
