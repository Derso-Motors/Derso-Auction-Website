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

// GET — meetings booked on the site that aren't yet on Google Calendar.
// The bot creates them via its Calendar MCP and POSTs back the event ids.
export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); // דלג על פגישות ישנות
  const { data, error } = await db
    .from('meetings')
    .select('id, title, scheduled_at, location, client_name, client_phone, notes, profiles(full_name, phone)')
    .is('gcal_event_id', null)
    .gte('scheduled_at', since)
    .order('scheduled_at', { ascending: true })
    .limit(50);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const meetings = (data || []).map((m) => ({
    id: m.id,
    title: m.title || 'פגישה',
    scheduled_at: m.scheduled_at,
    type: m.location || 'שיחה טלפונית',
    client_name: m.client_name || m.profiles?.full_name || '',
    client_phone: m.client_phone || m.profiles?.phone || '',
    notes: m.notes || '',
  }));
  return Response.json({ ok: true, meetings });
}

// POST — { synced: [{ id, gcal_event_id }] } — mark meetings as synced.
export async function POST(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  let body = {};
  try { body = await req.json(); } catch {}
  const synced = Array.isArray(body.synced) ? body.synced : [];
  let n = 0;
  for (const s of synced) {
    if (!s || !s.id || !s.gcal_event_id) continue;
    const { error } = await db.from('meetings').update({ gcal_event_id: String(s.gcal_event_id) }).eq('id', s.id);
    if (!error) n++;
  }
  return Response.json({ ok: true, updated: n });
}
