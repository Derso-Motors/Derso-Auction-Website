import { sendWhatsApp } from '../../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

// Best-effort WhatsApp welcome right after signup, telling the new client a
// verification email is on its way. Called from the public signup form, so it
// is deliberately dumb: no data returned, strict input limits, one message.
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false }, { status: 400 }); }
  const phone = String(body?.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
  const name = String(body?.name || '').slice(0, 60).trim();
  if (phone.replace(/\D/g, '').length < 9) return Response.json({ ok: false }, { status: 400 });

  const msg =
    `שלום ${name || 'וברוך הבא'} 👋\n` +
    `נרשמת בהצלחה לאזור האישי של דרסו — בית ליווי מקצועי למכרזים.\n` +
    `📧 שלחנו לך עכשיו מייל אימות — יש לאשר אותו ואז להתחבר.\n` +
    `לא הגיע? בדוק בתיקיית הספאם.\n\n` +
    `לכל שאלה אנחנו כאן 🚗`;
  try { await sendWhatsApp(phone, msg); } catch {}
  return Response.json({ ok: true });
}
