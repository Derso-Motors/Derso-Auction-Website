import { createClient } from '@supabase/supabase-js';
import { CREDIT_PACKAGES, REPORT_PACKAGES, verifyWebhook } from '../../../../lib/grow';
import { NextResponse } from 'next/server';

const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

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

  // Idempotency: a Grow transaction lands in exactly one of these tables
  const [{ data: existingTx }, { data: existingOrder }] = await Promise.all([
    sb.from('credit_transactions').select('id').eq('grow_tx_code', txCode).maybeSingle(),
    sb.from('report_orders').select('id').eq('grow_tx_code', txCode).maybeSingle(),
  ]);

  if (existingTx || existingOrder) {
    return NextResponse.json({ ok: true, msg: 'already processed' });
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
    if (error) {
      return NextResponse.json({ error: 'order insert failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, type: 'report_package', package: reportPkg.key, orders: rows.length });
  }

  // Case 2: Credit package purchase (credits already include the bonus)
  const pkg = CREDIT_PACKAGES.find(p => p.key === custom2);
  if (pkg) {
    await sb.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: pkg.credits,
      p_reason: `טעינת חבילת ${pkg.label} (₪${pkg.price}) כולל בונוס ₪${pkg.bonus}`,
      p_grow_tx_code: txCode,
    });
    return NextResponse.json({ ok: true, type: 'package', package: pkg.key, credits: pkg.credits });
  }

  // Case 3: Report order payment (custom2 is a UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(custom2)) {
    await sb
      .from('report_orders')
      .update({ status: 'paid', grow_tx_code: txCode })
      .eq('id', custom2)
      .eq('client_id', userId)
      .eq('status', 'awaiting_payment');
    return NextResponse.json({ ok: true, type: 'order', orderId: custom2 });
  }

  // Case 4: Generic credit — exact paid amount
  await sb.rpc('admin_add_credits', {
    p_user_id: userId,
    p_amount: paymentSum,
    p_reason: `טעינת קרדיטים — Grow (₪${paymentSum})`,
    p_grow_tx_code: txCode,
  });

  return NextResponse.json({ ok: true, type: 'generic', amount: paymentSum });
}
