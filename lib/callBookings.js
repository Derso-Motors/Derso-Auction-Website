import { sendWhatsApp } from './whatsapp';

// Characterization calls: Sun-Thu, 12:30-16:00 Israel time, 15 minutes each.
export const SLOT_TIMES = [];
for (let h = 12, m = 30; h < 16; ) {
  SLOT_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  m += 15;
  if (m === 60) { m = 0; h += 1; }
}

const SITE_URL = process.env.SITE_URL || 'https://derso-auction-website.vercel.app';
const OWNER_PHONE = process.env.OWNER_PHONE || '0559506913';

// Offset (ms) of Asia/Jerusalem relative to UTC at a given instant (DST-aware).
function ilOffsetMs(atUtcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(atUtcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - atUtcMs;
}

// "2026-08-09" + "12:30" (Israel local) -> UTC Date
export function ilDateTimeToUtc(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(guess - ilOffsetMs(guess));
}

export function ilDayOfWeek(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=Sunday
}

export function ilTodayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

export function fmtIl(dt) {
  return new Date(dt).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Next N bookable days (Sun-Thu), starting today (Israel time).
export function bookableDays(n = 10) {
  const days = [];
  const start = ilTodayStr();
  let [y, mo, d] = start.split('-').map(Number);
  let cur = new Date(Date.UTC(y, mo - 1, d));
  while (days.length < n) {
    const dow = cur.getUTCDay();
    if (dow >= 0 && dow <= 4) {
      days.push(cur.toISOString().slice(0, 10));
    }
    cur = new Date(cur.getTime() + 24 * 3600 * 1000);
  }
  return days;
}

const CONFIRM_WINDOW_MIN_H = 16;
const CONFIRM_WINDOW_MAX_H = 30;

// Runs from the tick endpoint (cron / page loads / bot ping) with a service client.
export async function processCallReminders(admin) {
  const now = Date.now();
  const out = { confirmRequests: 0, reminders: 0, errors: [] };

  // 1. Day-before confirmation request (with confirm/cancel links)
  const minC = new Date(now + CONFIRM_WINDOW_MIN_H * 3600 * 1000).toISOString();
  const maxC = new Date(now + CONFIRM_WINDOW_MAX_H * 3600 * 1000).toISOString();
  const { data: toConfirm } = await admin.from('call_bookings')
    .select('*').eq('status', 'booked').is('confirm_sent_at', null)
    .gte('starts_at', minC).lte('starts_at', maxC);
  for (const b of toConfirm || []) {
    const when = fmtIl(b.starts_at);
    const msg = `היי ${b.client_name || ''} 👋\n\n*תזכורת:* מחר (*${when}*) קבועה לך *שיחת אפיון* עם דרסו בנוגע לרכישת הרכב שלך.\n\nהאם אתה מגיע? פשוט השב להודעה הזאת:\n*מגיע* / *לא מגיע*\n\nדרסו — בית ליווי מקצועי למכרזים`;
    const sent = await sendWhatsApp(b.phone, msg);
    if (sent.ok) {
      await admin.from('call_bookings').update({ confirm_sent_at: new Date().toISOString() }).eq('id', b.id);
      out.confirmRequests++;
    } else {
      out.errors.push(`confirm ${b.id}: ${sent.error || 'send failed'}`);
    }
  }

  // 2. ~30 minutes before: heads-up that our rep will call
  const maxR = new Date(now + 35 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();
  const { data: toRemind } = await admin.from('call_bookings')
    .select('*').in('status', ['booked', 'confirmed']).is('reminder_sent_at', null)
    .gte('starts_at', nowIso).lte('starts_at', maxR);
  for (const b of toRemind || []) {
    const time = new Date(b.starts_at).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const msg = `⏰ *תזכורת:* בעוד כחצי שעה (*${time}*) תקבל שיחה מהנציג שלנו לשיחת האפיון.\n\nכדאי להיות זמין 📞\n\nדרסו — בית ליווי מקצועי למכרזים`;
    const sent = await sendWhatsApp(b.phone, msg);
    if (sent.ok) {
      await admin.from('call_bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', b.id);
      out.reminders++;
      // Also give the owner a heads-up
      await sendWhatsApp(OWNER_PHONE, `📞 בעוד כחצי שעה (${time}) שיחת אפיון עם ${b.client_name || b.phone}`);
    } else {
      out.errors.push(`remind ${b.id}: ${sent.error || 'send failed'}`);
    }
  }

  return out;
}

// Personal number of the manager for meeting heads-ups (30 min + 15 min before)
const MANAGER_PHONE = process.env.MANAGER_PHONE || '0537930055';

// Reminds the MANAGER before every meeting in the `meetings` table:
// ~30 minutes before and again ~15 minutes before. Runs on the same
// 10-minute cron as call reminders, so actual timing is within ±5 min.
export async function processMeetingAdminReminders(admin) {
  const now = Date.now();
  const out = { remind30: 0, remind15: 0, errors: [] };
  const maxW = new Date(now + 35 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data: meetings } = await admin.from('meetings')
    .select('id, title, scheduled_at, location, client_name, admin_reminded_30_at, admin_reminded_15_at, profiles(full_name, phone)')
    .gte('scheduled_at', nowIso).lte('scheduled_at', maxW);

  for (const m of meetings || []) {
    const minsLeft = (new Date(m.scheduled_at).getTime() - now) / 60000;
    const time = new Date(m.scheduled_at).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const who = m.profiles?.full_name || m.client_name || 'לקוח';
    const phone = m.profiles?.phone ? ` (${m.profiles.phone})` : '';

    // 15-min reminder (takes priority; also stamps the 30-min flag so a
    // late-first-run doesn't double-send)
    if (minsLeft <= 17 && !m.admin_reminded_15_at) {
      const sent = await sendWhatsApp(MANAGER_PHONE, `⏰ בעוד רבע שעה (${time}): ${m.location || 'פגישה'} — "${m.title}" עם ${who}${phone}`);
      if (sent.ok) {
        await admin.from('meetings').update({ admin_reminded_15_at: nowIso, admin_reminded_30_at: m.admin_reminded_30_at || nowIso }).eq('id', m.id);
        out.remind15++;
      } else {
        out.errors.push(`meeting15 ${m.id}: ${sent.error || 'send failed'}`);
      }
    } else if (minsLeft > 17 && !m.admin_reminded_30_at) {
      const sent = await sendWhatsApp(MANAGER_PHONE, `🔔 בעוד כחצי שעה (${time}): ${m.location || 'פגישה'} — "${m.title}" עם ${who}${phone}`);
      if (sent.ok) {
        await admin.from('meetings').update({ admin_reminded_30_at: nowIso }).eq('id', m.id);
        out.remind30++;
      } else {
        out.errors.push(`meeting30 ${m.id}: ${sent.error || 'send failed'}`);
      }
    }
  }
  return out;
}
