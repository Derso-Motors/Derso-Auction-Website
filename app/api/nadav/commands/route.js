import { createClient as createServerClient } from '../../../../lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Bot auth: same Bearer CRON_SECRET pattern as app/api/nadav/state/route.js
function botAuthorized(req) {
  const auth = req.headers.get('authorization') || '';
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}
function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
}

// GET — the office bot polls pending voice commands (Bearer CRON_SECRET).
export async function GET(req) {
  if (!botAuthorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const { data, error } = await db.from('nadav_commands')
    .select('id, text, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, commands: data || [] });
}

// POST — two callers:
//  1) the bot marks commands done: Bearer CRON_SECRET + { results: [{ id, status, result }] }
//  2) the signed-in admin speaks:  cookie session + { text }
export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  // (1) Bot marking results.
  if (botAuthorized(req)) {
    const db = admin();
    if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
    const results = Array.isArray(body.results) ? body.results : [];
    for (const r of results) {
      if (!r || !r.id) continue;
      await db.from('nadav_commands')
        .update({ status: r.status || 'done', result: r.result || null, done_at: new Date().toISOString() })
        .eq('id', r.id);
    }
    return Response.json({ ok: true });
  }

  // (2) Admin browser writing a spoken command.
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const text = (body.text || '').trim();
  if (!text) return Response.json({ ok: false, error: 'empty' }, { status: 400 });

  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const { data, error } = await db.from('nadav_commands')
    .insert({ text, status: 'pending' })
    .select('id')
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id });
}
