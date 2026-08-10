import { createClient } from '@supabase/supabase-js';
import { CREDIT_PACKAGES, verifyWebhook } from '../../../../lib/grow';
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

  // Idempotency check
  const { data: existing } = await sb
    .from('credit_transactions')
    .select('id')
    .eq('grow_tx_code', txCode)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, msg: 'already processed' });
  }

  // Case 1: Credit package purchase
  const pkg = CREDIT_PACKAGES.find(p => p.key === custom2);
  if (pkg) {
    const creditAmount = pkg.credits + pkg.bonus;
    await sb.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: creditAmount,
      p_reason: `טעינת חבילת ${pkg.label} (₪${pkg.price}) + בונוס ₪${pkg.bonus}`,
      p_grow_tx_code: txCode,
    });
    return NextResponse.json({ ok: true, type: 'package', package: pkg.key, credits: creditAmount });
  }

  // Case 2: Report order payment (custom2 is a UUID)
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

  // Case 3: Generic credit
  await sb.rpc('admin_add_credits', {
    p_user_id: userId,
    p_amount: paymentSum,
    p_reason: `טעינת קרדיטים — Grow (₪${paymentSum})`,
    p_grow_tx_code: txCode,
  });

  return NextResponse.json({ ok: true, type: 'generic', amount: paymentSum });
}
