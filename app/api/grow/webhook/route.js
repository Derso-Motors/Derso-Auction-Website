import { createClient } from '@supabase/supabase-js';
import { CREDIT_PACKAGES, REPORT_PACKAGES, verifyWebhook } from '../../../../lib/grow';
import { NextResponse } from 'next/server';

const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// שגיאת DB בתשלום = חובה להחזיר 500 כדי ש-Grow ינסה שוב — אחרת הכסף נעלם בשקט.
function dbFail(where, error) {
  console.error(`[grow:webhook] ${where} failed:`, error?.message || error);
  return NextResponse.json({ ok: false, error: `db error at ${where}` }, { status: 500 });
}

export async function POST(request) {
  let body;
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    body = await request.json();
  } else {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  if (!verifyWebhook(body)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const txCode = body.transactionCode;
  const paymentSum = Number(body.paymentSum || body.Sum || 0);
  const userId = body.custom1;
  const custom2 = body.custom2 || '';

  if (!txCode || !userId || paymentSum <= 0) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Idempotency: a Grow transaction lands in exactly one of these tables.
  // בהזמנות דוחות חבילה נשמרת עם סיומות (TX-1..TX-N) — לכן like ולא eq,
  // אחרת retry של Grow על חבילה יוצר כפילות.
  const [idemTx, idemOrder] = await Promise.all([
    sb.from('credit_transactions').select('id').eq('grow_tx_code', txCode).limit(1).maybeSingle(),
    sb.from('report_orders').select('id').like('grow_tx_code', `${txCode}%`).limit(1).maybeSingle(),
  ]);
  if (idemTx.error) return dbFail('idempotency:credit_transactions', idemTx.error);
  if (idemOrder.error) return dbFail('idempotency:report_orders', idemOrder.error);

  if (idemTx.data || idemOrder.data) {
    return NextResponse.json({ ok: true, msg: 'already processed' });
  }

  // Case 0: Recurring subscriptions (הוראת קבע) — broadcast / AI assistant
  if (custom2 === 'sub_broadcast' || custom2 === 'sub_ai') {
    if (custom2 === 'sub_broadcast') {
      const { error } = await sb.from('broadcast_subscribers').upsert({
        client_id: userId,
        active: true,
        monthly_fee: paymentSum,
        paid_until: new Date(Date.now() + 32 * 24 * 3600 * 1000).toISOString(),
      }, { onConflict: 'client_id' });
      if (error) return dbFail('broadcast_subscribers:upsert', error);
    } else {
      const { error } = await sb.from('profiles').update({ ai_assistant_active: true }).eq('id', userId);
      if (error) return dbFail('profiles:ai_assistant', error);
    }
    // marker row for idempotency + history
    const { error: markerErr } = await sb.from('credit_transactions').insert({
      client_id: userId,
      amount: 0,
      reason: custom2 === 'sub_broadcast'
        ? `חיוב מנוי שידור (₪${paymentSum}) — הוראת קבע Grow`
        : `חיוב עוזר אישי AI (₪${paymentSum}) — הוראת קבע Grow`,
      grow_tx_code: txCode,
    });
    if (markerErr) return dbFail('credit_transactions:sub marker', markerErr);
    return NextResponse.json({ ok: true, type: custom2 });
  }

  // Case 1: Report package purchase — create paid report orders (one per report)
  const reportPkg = REPORT_PACKAGES.find(p => p.key === custom2);
  if (reportPkg) {
    const rows = Array.from({ length: reportPkg.reports }, (_, i) => ({
      client_id: userId,
      report_type: `${reportPkg.label} — דוח בדיקה מלא + טופס סליקה (${i + 1}/${reportPkg.reports})`,
      amount: reportPkg.perUnit,
      status: 'paid',
      // unique column — suffix the tx code for multi-report packages
      grow_tx_code: reportPkg.reports > 1 ? `${txCode}-${i + 1}` : txCode,
    }));
    const { error } = await sb.from('report_orders').insert(rows);
    if (error) return dbFail('report_orders:insert package', error);
    return NextResponse.json({ ok: true, type: 'report_package', package: reportPkg.key, orders: rows.length });
  }

  // Case 2: Credit package purchase (credits already include the bonus)
  const pkg = CREDIT_PACKAGES.find(p => p.key === custom2);
  if (pkg) {
    const { error } = await sb.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: pkg.credits,
      p_reason: `טעינת חבילת ${pkg.label} (₪${pkg.price}) כולל בונוס ₪${pkg.bonus}`,
      p_grow_tx_code: txCode,
    });
    if (error) return dbFail('admin_add_credits:package', error);
    return NextResponse.json({ ok: true, type: 'package', package: pkg.key, credits: pkg.credits });
  }

  // Case 3: Report order payment (custom2 is a UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(custom2)) {
    const { data: updated, error } = await sb
      .from('report_orders')
      .update({ status: 'paid', grow_tx_code: txCode })
      .eq('id', custom2)
      .eq('client_id', userId)
      .eq('status', 'awaiting_payment')
      .select('id');
    if (error) return dbFail('report_orders:update order', error);
    // 0 שורות = ההזמנה כבר לא ב-awaiting_payment (כנראה שולמה) — אין מה לנסות שוב.
    return NextResponse.json({ ok: true, type: 'order', orderId: custom2, matched: (updated || []).length });
  }

  // Case 4: Generic credit — exact paid amount
  const { error: genericErr } = await sb.rpc('admin_add_credits', {
    p_user_id: userId,
    p_amount: paymentSum,
    p_reason: `טעינת קרדיטים — Grow (₪${paymentSum})`,
    p_grow_tx_code: txCode,
  });
  if (genericErr) return dbFail('admin_add_credits:generic', genericErr);

  return NextResponse.json({ ok: true, type: 'generic', amount: paymentSum });
}
