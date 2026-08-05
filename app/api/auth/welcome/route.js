import { sendWhatsApp } from '../../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

// Rate limiter: 3 requests per IP per hour
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Israeli phone validation: +972 or 05x prefix, 9-10 digits
function isValidIsraeliPhone(phone) {
  return /^(\+972|972|05)\d{7,8}$/.test(phone.replace(/[\s\-()]/g, ''));
}

// Best-effort WhatsApp welcome right after signup, telling the new client a
// verification email is on its way. Called from the public signup form, so it
// is deliberately dumb: no data returned, strict input limits, one message.
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) return Response.json({ ok: false, error: 'rate limited' }, { status: 429 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const phone = String(body?.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
  const name = String(body?.name || '').slice(0, 60).trim();
  if (phone.replace(/\D/g, '').length < 9 || !isValidIsraeliPhone(phone)) return Response.json({ ok: false }, { status: 400 });

  const msg =
    `שלום ${name || 'וברוך הבא'} 👋\n` +
    `נרשמת בהצלחה לאזור האישי של דרסו — בית ליווי מקצועי למכרזים.\n` +
    `📧 שלחנו לך עכשיו מייל אימות — יש לאשר אותו ואז להתחבר.\n` +
    `לא הגיע? בדוק בתיקיית הספאם.\n\n` +
    `לכל שאלה אנחנו כאן 🚗`;
  try { await sendWhatsApp(phone, msg); } catch {}
  return Response.json({ ok: true });
}
