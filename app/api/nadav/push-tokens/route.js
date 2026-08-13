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

// GET — Expo push tokens for Nadav to notify the owner's devices.
export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const { data, error } = await db.from('nadav_push_tokens').select('token, platform');
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, tokens: (data || []).map((r) => r.token) });
}
