import { createClient } from '@supabase/supabase-js';
import { processCallReminders, processMeetingAdminReminders } from '../../../../lib/callBookings';

export const dynamic = 'force-dynamic';

// Runs every 10 minutes during business hours (06:00-19:00 Israel) to send
// precise day-before confirmations and 30-minute-before reminders.
// Slots are every 15 min, so a 10-min cadence guarantees ≤10 min drift
// on the "half-hour heads-up" — well within the 35-min query window.
export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const fromCron = !!req.headers.get('x-vercel-cron') || auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!fromCron && process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
  const result = await processCallReminders(supabase);
  const meetingReminders = await processMeetingAdminReminders(supabase);
  return Response.json({ ok: true, ...result, meetingReminders });
}
