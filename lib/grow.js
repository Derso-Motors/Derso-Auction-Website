/**
 * Grow payment integration (grow.co.il / pay.grow.link)
 * Account: 10531114
 *
 * Env vars required:
 *   GROW_USER_ID     – 10531114
 *   GROW_PAGE_CODE   – from Grow dashboard payment page (legacy, generic page)
 *   GROW_WEBHOOK_KEY – secret key for webhook verification
 *
 * Each package has its own dedicated Grow payment page (link).
 */

export const CREDIT_PACKAGES = [
  { key: 'starter',  label: 'סטרטר',   credits: 105,  price: 105,  bonus: 5,   tag: null,            link: 'https://pay.grow.link/MTA0MzEx~446221499ce7547b5f672f743687f037-MzgyMDg1Mg' },
  { key: 'basic',    label: 'בסיסי',   credits: 270,  price: 270,  bonus: 20,  tag: 'הכי פופולרי', link: 'https://pay.grow.link/MTA0MzEx~3d6ac92a06e6590c3c288e70a9ba4687-MzgyMDQ4NQ' },
  { key: 'pro',      label: 'מקצועי',  credits: 560,  price: 560,  bonus: 60,  tag: null,            link: 'https://pay.grow.link/MTA0MzEx~b21eb5c7bd8bc4bd0fe0d65d618d050d-MzgyMDkyNg' },
  { key: 'premium',  label: 'פרימיום', credits: 1150, price: 1150, bonus: 150, tag: 'הכי משתלם',   link: 'https://pay.grow.link/MTA0MzEx~d3ce10aa6d89423c96f023624ae57796-MzgyMDkyOA' },
];

export const REPORT_PACKAGES = [
  {
    key: 'single',
    label: 'דוח בודד',
    tag: null,
    reports: 1,
    forms: 1,
    fullValue: 1800,
    price: 1800,
    perUnit: 1800,
    saving: 0,
    featured: false,
    description: 'פתרון מהיר וממוקד לבדיקת רכב יחיד.',
    features: ['1 דוח בדיקה מלא', '1 טופס סליקה משפטי'],
    cta: 'רכישת דוח בודד',
    link: 'https://pay.grow.link/MTA0MzEx~d987b0180921721f7e5de728e5dd8089-MzgyMDkzNw',
  },
  {
    key: 'pack3',
    label: 'חבילת 3',
    tag: 'חיסכון',
    reports: 3,
    forms: 3,
    fullValue: 5490,
    price: 4200,
    perUnit: 1400,
    saving: 1290,
    featured: true,
    description: 'חבילה גמישה למשתתפים קבועים.',
    features: ['3 דוחות בדיקה מלאים', '3 טופסי סליקה משפטיים', 'תמיכה בווטסאפ ביום המכרז'],
    cta: 'רכישת חבילת 3',
    link: 'https://pay.grow.link/MTA0MzEx~0390af07404098533f8751d649412d3b-MzgyMDk0MA',
  },
  {
    key: 'pack5',
    label: 'חבילת 5',
    tag: 'הכי משתלם',
    reports: 5,
    forms: 5,
    fullValue: 9150,
    price: 5800,
    perUnit: 1160,
    saving: 3350,
    featured: false,
    description: 'לסוחרים ולמשקיעים פעילים.',
    features: ['5 דוחות בדיקה מלאים', '5 טופסי סליקה משפטיים', 'ליווי אישי של מומחה רכב'],
    cta: 'רכישת חבילת 5',
    link: 'https://pay.grow.link/MTA0MzEx~00fc6a809e5d3159b60382b1cf584679-MzgyMDk0NQ',
  },
];

/**
 * Append identifying params (custom1=userId, custom2=packageKey) to a
 * dedicated Grow payment link so the webhook can credit the right user.
 */
export function growLinkWithParams(link, { userId, custom2, successUrl, cancelUrl }) {
  const params = new URLSearchParams({
    ...(userId ? { custom1: userId } : {}),
    ...(custom2 ? { custom2 } : {}),
    ...(successUrl ? { SuccessUrl: successUrl } : {}),
    ...(cancelUrl ? { CancelUrl: cancelUrl } : {}),
  });
  const qs = params.toString();
  return qs ? `${link}?${qs}` : link;
}

/**
 * Build a Grow payment redirect URL on the legacy generic page (open sum).
 * Still used for awaiting_payment report orders.
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
