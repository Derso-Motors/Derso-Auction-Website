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
const digits = (p) => String(p || '').replace(/\D/g, '');

// POST { phone, car } — the office bot pushes a matched car to a client's site
// "שידור" section. Only stored for clients with an ACTIVE broadcast subscription.
export async function POST(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });

  const body = await req.json().catch(() => ({}));
  const last9 = digits(body.phone).slice(-9);
  const car = body.car || {};
  if (!last9 || !car.title) return Response.json({ ok: false, error: 'bad input' }, { status: 400 });

  // find the client by phone (last 9 digits)
  const { data: profiles } = await db.from('profiles').select('id, phone').not('phone', 'is', null);
  const profile = (profiles || []).find((p) => digits(p.phone).slice(-9) === last9);
  if (!profile) return Response.json({ ok: true, skipped: 'no_profile' });

  // only deliver to active broadcast subscribers
  const { data: sub } = await db.from('broadcast_subscribers')
    .select('active').eq('client_id', profile.id).eq('active', true).maybeSingle();
  if (!sub) return Response.json({ ok: true, skipped: 'not_subscribed' });

  const num = (v) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null; };
  const { error } = await db.from('broadcast_cars').insert({
    client_id: profile.id,
    title: car.title,
    year: num(car.year), km: num(car.km),
    list_price: num(car.list_price), est_price: num(car.est_price),
    image_url: car.image_url || null, auction_link: car.auction_link || null,
    notes: car.notes || null,
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, delivered: true });
}
