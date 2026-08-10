import { createClient } from '@supabase/supabase-js';
import { verifyWebhook, CREDIT_PACKAGES } from '../../../../lib/grow';

export const dynamic = 'force-dynamic';

/**
 * POST /api/grow/webhook
 *
 * Grow sends a webhook after every successful payment.
 * Payload includes: webhookKey, transactionCode, paymentSum,
 * fullName, payerPhone, payerEmail, paymentDesc, custom1 (userId),
 * custom2 (packageKey or orderId).
 *
 * We use this to:
 *  1. Credit the user's wallet (if custom2 matches a package key)
 *  2. Mark a report order as paid (if custom2 is an order ID)
 */
export async function POST(req) {
  let body;
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await req.json();
  } else {
    // Grow may send as form-urlencoded
    const text = await req.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  // Verify webhook authenticity
  if (!verifyWebhook(body)) {
    return Response.json({ ok: false, error: 'invalid webhook key' }, { status: 401 });
  }

  const userId = body.custom1;
  const reference = body.custom2 || '';
  const amount = Number(body.paymentSum || body.Sum || 0);
  const txCode = body.transactionCode || body.asmachta || 'unknown';

  if (!userId || amount <= 0) {
    return Response.json({ ok: false, error: 'missing userId or amount' }, { status: 400 });
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ ok: false, error: 'not configured' }, { status: 501 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });

  // Idempotency: check if this transaction was already processed
  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('grow_tx_code', txCode)
    .limit(1);
  if (existing?.length > 0) {
    return Response.json({ ok: true, message: 'already processed' });
  }

  // Case 1: Credit package purchase
  const pkg = CREDIT_PACKAGES.find((p) => p.key === reference);
  if (pkg && amount >= pkg.amount) {
    const creditAmount = pkg.total; // amount + bonus
    // Add credits to user profile
    const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
    const currentCredits = Number(profile?.credits || 0);
    await supabase.from('profiles').update({ credits: currentCredits + creditAmount }).eq('id', userId);

    // Record transaction
    await supabase.from('credit_transactions').insert({
      client_id: userId,
      amount: creditAmount,
      reason: `טעינת ארנק — ${pkg.label} (Grow #${txCode})`,
      grow_tx_code: txCode,
    });

    return Response.json({ ok: true, credited: creditAmount, package: pkg.key });
  }

  // Case 2: Report order payment
  if (reference.match(/^[0-9a-f-]{36}$/i)) {
    // reference is a UUID (order ID)
    const { data: order } = await supabase
      .from('report_orders')
      .select('id, status, client_id, amount')
      .eq('id', reference)
      .single();

    if (order && order.status === 'awaiting_payment') {
      await supabase.from('report_orders').update({ status: 'paid', grow_tx_code: txCode }).eq('id', reference);

      await supabase.from('credit_transactions').insert({
        client_id: order.client_id,
        amount: 0, // no credit change — direct payment
        reason: `תשלום ישיר עבור דוח (Grow #${txCode})`,
        grow_tx_code: txCode,
      });

      return Response.json({ ok: true, order: reference, status: 'paid' });
    }
  }

  // Case 3: Generic credit (amount matches but no package)
  // Credit the exact payment amount
  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', userId).single();
  if (profile) {
    const currentCredits = Number(profile.credits || 0);
    await supabase.from('profiles').update({ credits: currentCredits + amount }).eq('id', userId);

    await supabase.from('credit_transactions').insert({
      client_id: userId,
      amount,
      reason: `טעינת ארנק — ₪${amount} (Grow #${txCode})`,
      grow_tx_code: txCode,
    });

    return Response.json({ ok: true, credited: amount });
  }

  return Response.json({ ok: false, error: 'user not found' }, { status: 404 });
}

// Grow sometimes sends GET to verify the endpoint is alive
export async function GET() {
  return Response.json({ ok: true, service: 'grow-webhook' });
}
