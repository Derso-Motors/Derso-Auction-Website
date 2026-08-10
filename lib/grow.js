/**
 * Grow payment integration (grow.co.il / pay.grow.link)
 * Account: 10531114
 *
 * Env vars required:
 *   GROW_USER_ID     – 10531114
 *   GROW_PAGE_CODE   – from Grow dashboard payment page
 *   GROW_WEBHOOK_KEY – secret key for webhook verification
 */

// Report inspection packages (each includes legal clearance form worth ₪330)
export const REPORT_PACKAGES = [
  {
    key: 'single',
    label: 'דוח בודד + טופס סליקה',
    tag: 'לבחינה בודדת',
    tagStyle: 'default',
    reports: 1,
    forms: 1,
    fullValue: 1830,   // 1500 + 330
    price: 1800,
    perUnit: 1800,
    saving: 0,
    featured: false,
    description: 'כולל דוח בדיקה מקיף וטופס סליקה משפטי (בשמאי/כונס) בשווי ₪330.',
    cta: 'לרכישת דוח בודד',
  },
  {
    key: 'pack3',
    label: 'חבילת 3 דוחות + 3 טפסים',
    tag: 'מסלול סטנדרטי',
    tagStyle: 'default',
    reports: 3,
    forms: 3,
    fullValue: 5490,   // 3 * 1830
    price: 4200,
    perUnit: 1400,
    saving: 1290,
    featured: false,
    description: 'כולל 3 דוחות בדיקה מלאים ו-3 טפסי סליקה משפטיים למימוש במערכת.',
    cta: 'לרכישת חבילת 3 דוחות',
  },
  {
    key: 'pack5',
    label: 'חבילת 5 דוחות + 5 טפסים',
    tag: 'המסלול המשתלם והמומלץ למשתתפים במכרזים',
    tagStyle: 'featured',
    reports: 5,
    forms: 5,
    fullValue: 9150,   // 5 * 1830
    price: 5800,
    perUnit: 1160,
    saving: 3350,
    featured: true,
    description: 'מעטפת מלאה של 5 דוחות בדיקה + 5 טפסי סליקה משפטיים. כולל תעדוף שיגור סיירים בשטח וגמישות מלאה במימוש היתרה.',
    cta: 'לרכישת חבילת 5 דוחות במחיר מופחת',
  },
];

// Legacy credit packages (kept for wallet top-ups if needed)
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
