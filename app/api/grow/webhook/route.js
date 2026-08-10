import { createClient } from '@supabase/supabase-js';
import { CREDIT_PACKAGES, verifyWebhook } from '../../../lib/grow';
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
    // form-urlencoded
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  // Verify webhook authenticity
  if (!verifyWebhook(body)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const txCode = body.transactionCode;
  const paymentSum = Number(body.paymentSum || body.Sum || 0);
  const userId = body.custom1; // user ID we passed when creating the payment
  const custom2 = body.custom2 || ''; // package key or order ID

  if (!txCode || !userId || paymentSum <= 0) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Idempotency: check if we already processed this transaction
  const { data: existingTx } = await sb
    .from('credit_transactions')
    .select('id')
    .eq('grow_tx_code', txCode)
    .maybeSingle();

  if (existingTx) {
    return NextResponse.json({ ok: true, msg: 'already processed' });
  }

  // Case 1: Credit package purchase (custom2 matches a package key)
  const pkg = CREDIT_PACKAGES.find(p => p.key === custom2);
  if (pkg) {
    const creditAmount = pkg.credits + pkg.bonus;
    const { error } = await sb.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: creditAmount,
      p_reason: `טעינת חבילת ${pkg.label} (₪${pkg.price}) + בונוס ₪${pkg.bonus}`,
      p_grow_tx_code: txCode,
    });
    if (error) {
      // Fallback: direct insert if RPC doesn't exist
      await sb.from('profiles').update({ credits: sb.rpc('', {}).constructor ? undefined : undefined }).eq('id', userId);
      // Use raw SQL approach
      const { error: e2 } = await sb
        .from('credit_transactions')
        .insert({ client_id: userId, amount: creditAmount, reason: `טעינת חבילת ${pkg.label} (₪${pkg.price}) + בונוס ₪${pkg.bonus}`, grow_tx_code: txCode });
      if (!e2) {
        await sb.rpc('add_credits_raw', { p_user_id: userId, p_amount: creditAmount }).catch(() => {});
        // Direct update as last resort
        await sb.from('profiles').update({}).eq('id', userId).select('credits').single().then(async ({ data }) => {
          if (data) await sb.from('profiles').update({ credits: (data.credits || 0) + creditAmount }).eq('id', userId);
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, type: 'package', package: pkg.key, credits: pkg.credits + pkg.bonus });
  }

  // Case 2: Report order payment (custom2 is a UUID order ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(custom2)) {
    const { error } = await sb
      .from('report_orders')
      .update({ status: 'paid', grow_tx_code: txCode })
      .eq('id', custom2)
      .eq('client_id', userId)
      .eq('status', 'awaiting_payment');

    if (error) {
      console.error('Grow webhook: failed to update order', custom2, error);
    }
    return NextResponse.json({ ok: true, type: 'order', orderId: custom2 });
  }

  // Case 3: Generic credit (no package, no order ID)
  const { error: insertErr } = await sb
    .from('credit_transactions')
    .insert({ client_id: userId, amount: paymentSum, reason: `טעינת קרדיטים — Grow (₪${paymentSum})`, grow_tx_code: txCode });

  if (!insertErr) {
    // Update profile credits
    const { data: profile } = await sb.from('profiles').select('credits').eq('id', userId).single();
    if (profile) {
      await sb.from('profiles').update({ credits: (profile.credits || 0) + paymentSum }).eq('id', userId);
    }
  }

  return NextResponse.json({ ok: true, type: 'generic', amount: paymentSum });
}
