import { createClient } from '@supabase/supabase-js';
import { processDueItems } from '../../../../lib/broadcast';

export const dynamic = 'force-dynamic';

// Processes due broadcast items. Called by the Vercel daily cron (and can also
// be pinged by the office bot with the CRON_SECRET for intraday processing).
export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const fromVercelCron = !!req.headers.get('x-vercel-cron') || auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!fromVercelCron && process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 501 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
  const sent = await processDueItems(supabase);
  return Response.json({ ok: true, sent });
}
