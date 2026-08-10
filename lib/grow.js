/**
 * Grow Payment Solutions integration.
 *
 * Env vars (set in Vercel):
 *   GROW_USER_ID     — Business account ID (10531114)
 *   GROW_PAGE_CODE   — Payment page code from Grow dashboard
 *   GROW_WEBHOOK_KEY — Webhook secret for verifying callbacks
 *   NEXT_PUBLIC_SUPABASE_URL — (already set)
 */

const GROW_BASE = 'https://pay.grow.link';

/**
 * Build a Grow payment page URL.
 * The user is redirected here to complete payment.
 *
 * @param {object} opts
 * @param {number} opts.amount      — Amount in ILS
 * @param {string} opts.description — Payment description (Hebrew OK)
 * @param {string} opts.userId      — Supabase user ID (stored as custom field)
 * @param {string} opts.orderId     — Optional order ID
 * @param {string} opts.successUrl  — Redirect after success
 * @param {string} opts.cancelUrl   — Redirect on cancel
 * @param {string} [opts.pageCode]  — Override page code
 * @returns {string} Full payment URL
 */
export function buildPaymentUrl(opts) {
  const pageCode = opts.pageCode || process.env.GROW_PAGE_CODE;
  if (!pageCode) return null;

  const params = new URLSearchParams();
  params.set('Sum', String(opts.amount));
  params.set('Description', opts.description);
  params.set('SuccessUrl', opts.successUrl);
  params.set('CancelUrl', opts.cancelUrl);
  params.set('UserId', process.env.GROW_USER_ID || '10531114');
  // Custom fields — Grow passes these back in the webhook
  params.set('custom1', opts.userId);        // Supabase user ID
  params.set('custom2', opts.orderId || ''); // order/package reference
  if (opts.payerEmail) params.set('PayerEmail', opts.payerEmail);
  if (opts.payerPhone) params.set('PayerPhone', opts.payerPhone);
  if (opts.payerName) params.set('PayerName', opts.payerName);

  return `${GROW_BASE}/${pageCode}?${params.toString()}`;
}

/**
 * Credit package definitions.
 * Bonus tiers incentivize larger deposits ("מלכודת הציף").
 */
export const CREDIT_PACKAGES = [
  { key: 'starter',  amount: 100,  bonus: 5,  total: 105,  label: '₪100 + בונוס 5%',  popular: false },
  { key: 'basic',    amount: 250,  bonus: 20, total: 270,  label: '₪250 + בונוס 8%',  popular: true },
  { key: 'pro',      amount: 500,  bonus: 60, total: 560,  label: '₪500 + בונוס 12%', popular: false },
  { key: 'premium',  amount: 1000, bonus: 150, total: 1150, label: '₪1,000 + בונוס 15%', popular: false },
];

/**
 * Verify a Grow webhook payload.
 * Returns true if the webhookKey matches our secret.
 */
export function verifyWebhook(payload) {
  const secret = process.env.GROW_WEBHOOK_KEY;
  if (!secret) return true; // No secret configured — accept all (dev mode)
  return payload?.webhookKey === secret;
}
