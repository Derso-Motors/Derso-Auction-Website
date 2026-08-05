import { createClient } from '@supabase/supabase-js';
import { sendWhatsApp } from '../../../../lib/whatsapp';
import { fmtIl } from '../../../../lib/callBookings';

export const dynamic = 'force-dynamic';

const OWNER_PHONE = process.env.OWNER_PHONE || '0559506913';

// The office bot posts here when a client replies "מגיע" / "לא מגיע" to the
// day-before confirmation message. Body: { phone, answer: 'yes'|'no' }.
export async function POST(req) {
  const auth = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone || '').replace(/\D/g, '');
  const answer = body.answer === 'no' ? 'no' : body.answer === 'yes' ? 'yes' : null;
  if (!phone || !answer) return Response.json({ ok: false, error: 'bad request' }, { status: 400 });

  // Only bookings that already got the day-before confirmation request
  const { data: rows } = await admin.from('call_bookings')
    .select('*').eq('phone', phone).in('status', ['booked', 'confirmed'])
    .not('confirm_sent_at', 'is', null)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at').limit(1);
  const booking = rows?.[0];
  if (!booking) return Response.json({ ok: true, found: false });

  const when = fmtIl(booking.starts_at);

  if (answer === 'yes') {
    if (booking.status !== 'confirmed') {
      await admin.from('call_bookings').update({ status: 'confirmed' }).eq('id', booking.id);
      await sendWhatsApp(OWNER_PHONE, `✅ ${booking.client_name || booking.phone} אישר את שיחת האפיון ב${when}`);
    }
    return Response.json({ ok: true, found: true, reply: `מעולה, נתראה! נתקשר אליך ב${when}. נשלח תזכורת חצי שעה לפני 📞` });
  }

  await admin.from('call_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', booking.id);
  if (booking.meeting_id) await admin.from('meetings').delete().eq('id', booking.meeting_id);
  if (booking.google_event_id && process.env.APPS_SCRIPT_URL) {
    try {
      await fetch(process.env.APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteMeeting', eventId: booking.google_event_id }),
      });
    } catch {}
  }
  await sendWhatsApp(OWNER_PHONE, `❌ ${booking.client_name || booking.phone} ביטל את שיחת האפיון שהייתה קבועה ל${when}`);
  return Response.json({ ok: true, found: true, reply: 'הבנתי, השיחה בוטלה והמועד התפנה. אפשר לקבוע שיחה חדשה בכל רגע דרך האתר 🙂' });
}
