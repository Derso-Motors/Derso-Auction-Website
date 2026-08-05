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

// GET — the office bot pulls pending messages to send from the business number.
export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const { data } = await db.from('wa_outbox')
    .select('id, phone, text').eq('status', 'pending')
    .order('created_at').limit(20);
  return Response.json({ ok: true, messages: data || [] });
}

// POST { results: [{ id, ok, error? }] } — the bot reports what was sent.
export async function POST(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const body = await req.json().catch(() => ({}));
  for (const r of body.results || []) {
    if (!r?.id) continue;
    await db.from('wa_outbox').update(
      r.ok
        ? { status: 'sent', sent_at: new Date().toISOString() }
        : { status: 'failed', error: String(r.error || 'send failed').slice(0, 300) }
    ).eq('id', r.id);
  }
  return Response.json({ ok: true });
}
