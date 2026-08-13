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

// GET — business snapshot for Nadav: clients, subscribers, orders, revenue.
export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const db = admin();
  if (!db) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });

  const [clients, bsubs, aisubs, orders] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    db.from('broadcast_subscribers').select('monthly_fee', { count: 'exact' }).eq('active', true),
    db.from('profiles').select('id', { count: 'exact', head: true }).eq('ai_assistant_active', true),
    db.from('report_orders').select('amount, status'),
  ]);

  const paid = (orders.data || []).filter((o) => o.status === 'paid' || o.status === 'delivered');
  const reportRevenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
  const subRevenue = (bsubs.data || []).reduce((s, r) => s + Number(r.monthly_fee || 0), 0) + Number(aisubs.count || 0) * 4;

  return Response.json({
    ok: true,
    clients: clients.count || 0,
    broadcast_subscribers: bsubs.count || 0,
    ai_subscribers: aisubs.count || 0,
    paid_orders: paid.length,
    monthly_subscription_revenue: subRevenue,
    report_revenue: reportRevenue,
    total_revenue: reportRevenue + subRevenue,
  });
}
