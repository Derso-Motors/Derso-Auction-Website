import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function authorized(req) {
  const auth = req.headers.get('authorization') || '';
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}
function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
}

// GET — calendar events queued for deletion (a meeting was deleted on the site).
export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const { data, error } = await db.from('cal_deletions').select('gcal_event_id').limit(50);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, ids: (data || []).map((r) => r.gcal_event_id) });
}

// POST — { done: [gcal_event_id, ...] } — the bot deleted them; drop the tombstones.
export async function POST(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  let body = {};
  try { body = await req.json(); } catch {}
  const done = Array.isArray(body.done) ? body.done.filter(Boolean) : [];
  if (done.length) await db.from('cal_deletions').delete().in('gcal_event_id', done);
  return Response.json({ ok: true, removed: done.length });
}
