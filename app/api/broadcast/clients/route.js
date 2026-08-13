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

// GET — the office bot pulls active broadcast subscribers + their self-set search
// criteria, so matching uses the site as the source of truth for these clients.
export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });

  const { data: subs } = await db.from('broadcast_subscribers').select('client_id').eq('active', true);
  const ids = (subs || []).map((s) => s.client_id);
  if (!ids.length) return Response.json({ ok: true, clients: [] });

  const { data: profs } = await db.from('profiles')
    .select('id, full_name, phone, search_criteria').in('id', ids);
  const clients = (profs || []).filter((p) => p.phone).map((p) => ({
    phone: p.phone,
    full_name: p.full_name || '',
    criteria: p.search_criteria || {},
  }));
  return Response.json({ ok: true, clients });
}
