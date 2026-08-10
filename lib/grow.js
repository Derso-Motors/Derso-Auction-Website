/**
 * Grow payment integration (grow.co.il / pay.grow.link)
 * Account: 10531114
 *
 * Env vars required:
 *   GROW_USER_ID     – 10531114
 *   GROW_PAGE_CODE   – from Grow dashboard payment page
 *   GROW_WEBHOOK_KEY – secret key for webhook verification
 */

export const CREDIT_PACKAGES = [
  { key: 'starter',  label: 'סטרטר',   credits: 100,  price: 105,  bonus: 5,   tag: null },
  { key: 'basic',    label: 'בסיסי',   credits: 250,  price: 270,  bonus: 20,  tag: 'הכי פופולרי' },
  { key: 'pro',      label: 'מקצועי',  credits: 500,  price: 560,  bonus: 60,  tag: null },
  { key: 'premium',  label: 'פרימיום', credits: 1000, price: 1150, bonus: 150, tag: 'הכי משתלם' },
];

/**
 * Build a Grow payment redirect URL.
 * @param {{ sum: number, description: string, successUrl: string, cancelUrl: string, userId: string, custom2: string }} opts
 */
export function buildPaymentUrl({ sum, description, successUrl, cancelUrl, userId, custom2 }) {
  const pageCode = process.env.GROW_PAGE_CODE;
  if (!pageCode) throw new Error('GROW_PAGE_CODE not configured');

  const params = new URLSearchParams({
    Sum: String(sum),
    Description: description,
    SuccessUrl: successUrl,
    CancelUrl: cancelUrl,
    custom1: userId,
    ...(custom2 ? { custom2 } : {}),
  });

  return `https://pay.grow.link/${pageCode}?${params.toString()}`;
}

/**
 * Verify a Grow webhook payload by checking the webhookKey.
 */
export function verifyWebhook(payload) {
  const secret = process.env.GROW_WEBHOOK_KEY;
  if (!secret) return false;
  return payload?.webhookKey === secret;
}
