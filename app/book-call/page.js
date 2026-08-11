import { createClient as createSupabase } from '@supabase/supabase-js';
import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { sendWhatsApp } from '../../lib/whatsapp';
import { SLOT_TIMES, bookableDays, ilDateTimeToUtc, ilDayOfWeek, fmtIl, isLunchSlot } from '../../lib/callBookings';
import BookCallClient from './BookCallClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const OWNER_PHONE = process.env.OWNER_PHONE || '0559506913';

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
}


async function deleteGoogleEvent(eventId) {
  const appsUrl = process.env.APPS_SCRIPT_URL;
  if (!appsUrl || !eventId) return;
  try {
    await fetch(appsUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteMeeting', eventId }),
    });
  } catch {}
}

async function bookCall(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const date = String(formData.get('date') || '');
  const time = String(formData.get('time') || '');
  const P = '/book-call';

  if (isLunchSlot(time)) {
    redirect('/book-call?err=' + encodeURIComponent('השעות 14:15–15:00 סגורות (הפסקת צהריים) — בחרו שעה אחרת'));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOT_TIMES.includes(time)) {
    redirect(P + '?err=' + encodeURIComponent('בחירת מועד לא תקינה — נסה שוב'));
  }
  const dow = ilDayOfWeek(date);
  if (dow > 4) redirect(P + '?err=' + encodeURIComponent('שיחות מתקיימות בימים ראשון עד חמישי בלבד'));
  if (!bookableDays(10).includes(date)) redirect(P + '?err=' + encodeURIComponent('אפשר לקבוע רק לימים הקרובים'));

  const startsAt = ilDateTimeToUtc(date, time);
  if (startsAt.getTime() < Date.now() + 30 * 60 * 1000) {
    redirect(P + '?err=' + encodeURIComponent('המועד הזה כבר עבר או קרוב מדי — בחר שעה מאוחרת יותר'));
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, phone, phone_verified, role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && !profile?.phone_verified) redirect('/verify-phone');
  const phone = profile?.phone;
  if (!phone) redirect(P + '?err=' + encodeURIComponent('חסר מספר טלפון בפרופיל — עדכן אותו בהגדרות ונסה שוב'));

  // One active upcoming booking per client
  const { data: existing } = await supabase.from('call_bookings')
    .select('id').eq('client_id', user.id).neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString()).limit(1);
  if (existing?.length) redirect(P + '?err=' + encodeURIComponent('כבר קבועה לך שיחה — אפשר לבטל אותה ולקבוע חדשה'));

  const { data: booking, error } = await supabase.from('call_bookings')
    .insert({ client_id: user.id, client_name: profile?.full_name || '', phone, starts_at: startsAt.toISOString() })
    .select().single();
  if (error) {
    const msg = error.code === '23505' ? 'המועד הזה נתפס הרגע — בחר שעה אחרת' : 'קביעת השיחה נכשלה — נסה שוב';
    redirect(P + '?err=' + encodeURIComponent(msg));
  }

  // Mirror into the admin meetings calendar + notify (best effort)
  const admin = serviceClient();
  if (admin) {
    const { data: meeting } = await admin.from('meetings').insert({
      client_id: user.id,
      client_name: profile?.full_name || '',
      client_phone: phone,
      title: `📞 שיחת אפיון — ${profile?.full_name || phone}`,
      scheduled_at: startsAt.toISOString(),
      location: 'טלפון',
      status: 'scheduled',
      notes: 'נקבעה על ידי הלקוח דרך האתר',
    }).select().single();
    if (meeting) await admin.from('call_bookings').update({ meeting_id: meeting.id }).eq('id', booking.id);
  }
  const when = fmtIl(startsAt);
  await sendWhatsApp(OWNER_PHONE, `📞 שיחת אפיון חדשה נקבעה באתר!\n\n👤 ${profile?.full_name || ''}\n📱 ${phone}\n🕐 ${when}`);
  await sendWhatsApp(phone, `היי ${profile?.full_name || ''} 👋\n\nשיחת האפיון שלך נקבעה בהצלחה ל${when}.\n\nנשלח לך תזכורת יום לפני וגם חצי שעה לפני השיחה 📞\n\nדרסו — בית ליווי מקצועי למכרזים`);

  const appsUrl = process.env.APPS_SCRIPT_URL;
  if (appsUrl) {
    try {
      const res = await fetch(appsUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createMeeting', title: `שיחת אפיון — ${profile?.full_name || phone}`, startISO: startsAt.toISOString(), durationMin: 15, notes: `טלפון: ${phone}` }),
      });
      const j = await res.json().catch(() => null);
      if (j?.eventId && admin) {
        await admin.from('call_bookings').update({ google_event_id: j.eventId }).eq('id', booking.id);
      }
    } catch {}
  }

  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('השיחה נקבעה בהצלחה! נשלח לך אישור בוואטסאפ ✓'));
}

async function cancelMyCall(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const id = String(formData.get('id') || '');
  const { data: booking } = await supabase.from('call_bookings')
    .select('*').eq('id', id).eq('client_id', user.id).single();
  if (booking) {
    await supabase.from('call_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);
    const admin = serviceClient();
    if (admin && booking.meeting_id) {
      const { data: mrow } = await admin.from('meetings').select('gcal_event_id').eq('id', booking.meeting_id).single();
      if (mrow?.gcal_event_id) { try { await admin.from('cal_deletions').upsert({ gcal_event_id: mrow.gcal_event_id }); } catch {} }
      await admin.from('meetings').delete().eq('id', booking.meeting_id);
    }
    await deleteGoogleEvent(booking.google_event_id);
    await sendWhatsApp(OWNER_PHONE, `❌ ${booking.client_name || booking.phone} ביטל את שיחת האפיון שהייתה קבועה ל${fmtIl(booking.starts_at)}`);
  }
  revalidatePath('/book-call');
  redirect('/book-call?ok=' + encodeURIComponent('השיחה בוטלה והמועד התפנה ✓'));
}

export default async function BookCallPage() {
  const { supabase, user } = await requireUser();

  const { data: me } = await supabase.from('profiles').select('role, phone_verified').eq('id', user.id).single();
  if (me?.role !== 'admin' && !me?.phone_verified) redirect('/verify-phone');

  // Busy slots are fetched with the service key so clients can't see who booked —
  // only which times are taken.
  const admin = serviceClient();
  const days = bookableDays(10);
  const rangeStart = ilDateTimeToUtc(days[0], '00:00').toISOString();
  const rangeEnd = new Date(ilDateTimeToUtc(days[days.length - 1], '23:59')).toISOString();
  let busy = [];
  if (admin) {
    const { data } = await admin.from('call_bookings')
      .select('starts_at').neq('status', 'cancelled')
      .gte('starts_at', rangeStart).lte('starts_at', rangeEnd);
    busy = (data || []).map((r) => r.starts_at);
    // Slots taken by regular admin meetings are blocked too
    const { data: meetings } = await admin.from('meetings')
      .select('scheduled_at').gte('scheduled_at', rangeStart).lte('scheduled_at', rangeEnd);
    busy = busy.concat((meetings || []).map((m) => m.scheduled_at));
  }
  // Lunch break 14:15–15:00 — always shown as taken
  for (const d of days) {
    for (const t of SLOT_TIMES) {
      if (isLunchSlot(t)) busy.push(ilDateTimeToUtc(d, t).toISOString());
    }
  }

  const { data: mine } = await supabase.from('call_bookings')
    .select('*').eq('client_id', user.id).neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString()).order('starts_at').limit(1);

  return (
    <Shell active="book-call">
      <BookCallClient
        days={days}
        slotTimes={SLOT_TIMES}
        busy={busy}
        myBooking={mine?.[0] || null}
        bookAction={bookCall}
        cancelAction={cancelMyCall}
      />
    </Shell>
  );
}
