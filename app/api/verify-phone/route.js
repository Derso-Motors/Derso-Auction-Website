import { createClient as createSupabase } from '@supabase/supabase-js';
import { createClient as createServerClient } from '../../../lib/supabase-server';
import { sendWhatsApp } from '../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

function serviceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false } });
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '972' + digits.slice(1);
  return null;
}

// POST { action: 'send', phone } — send a 6-digit code via WhatsApp
// POST { action: 'check', code } — verify the code and mark the profile verified
export async function POST(request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: 'צריך להתחבר קודם' }, { status: 401 });

  const admin = serviceClient();
  if (!admin) return Response.json({ ok: false, error: 'שירות האימות לא מוגדר עדיין — פנה לתמיכה' }, { status: 501 });

  const body = await request.json().catch(() => ({}));

  if (body.action === 'send') {
    const phone = normalizePhone(body.phone);
    if (!phone) return Response.json({ ok: false, error: 'מספר הטלפון לא תקין — הזן מספר ישראלי, למשל 0501234567' }, { status: 400 });

    // Basic rate limit: at most 3 codes in the last 10 minutes
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin.from('phone_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since);
    if ((count || 0) >= 3) {
      return Response.json({ ok: false, error: 'נשלחו יותר מדי קודים. נסה שוב בעוד כמה דקות.' }, { status: 429 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insErr } = await admin.from('phone_verifications')
      .insert({ user_id: user.id, phone, code, expires_at: expires });
    if (insErr) {
      const hint = insErr.code === 'PGRST301' || /jwt|401/i.test(insErr.message || '')
        ? 'מפתח השרת (SUPABASE_SERVICE_ROLE_KEY) בוורסל לא תקין'
        : insErr.message;
      return Response.json({ ok: false, error: `שגיאה בשמירת הקוד: ${hint}` }, { status: 500 });
    }

    const msg = `🔐 קוד האימות שלך לאזור האישי של דרסו: ${code}\n\nהקוד תקף ל-10 דקות. אם לא ביקשת קוד — התעלם מההודעה.\n\nדרסו — בית ליווי מקצועי למכרזים`;
    const sent = await sendWhatsApp(phone, msg);
    if (!sent.ok) return Response.json({ ok: false, error: 'שליחת הוואטסאפ נכשלה. בדוק את המספר ונסה שוב.' }, { status: 502 });

    return Response.json({ ok: true, simulated: !!sent.simulated });
  }

  if (body.action === 'check') {
    const code = String(body.code || '').replace(/\D/g, '');
    if (code.length !== 6) return Response.json({ ok: false, error: 'הקוד חייב להכיל 6 ספרות' }, { status: 400 });

    const { data: rows } = await admin.from('phone_verifications')
      .select('*').eq('user_id', user.id).is('verified_at', null)
      .order('created_at', { ascending: false }).limit(1);
    const row = rows?.[0];
    if (!row) return Response.json({ ok: false, error: 'לא נמצא קוד פעיל — לחץ על "שליחת קוד" קודם' }, { status: 400 });
    if (new Date(row.expires_at) < new Date()) return Response.json({ ok: false, error: 'הקוד פג תוקף — שלח קוד חדש' }, { status: 400 });
    if (row.attempts >= 5) return Response.json({ ok: false, error: 'יותר מדי ניסיונות — שלח קוד חדש' }, { status: 429 });

    if (row.code !== code) {
      await admin.from('phone_verifications').update({ attempts: row.attempts + 1 }).eq('id', row.id);
      return Response.json({ ok: false, error: 'קוד שגוי — בדוק את ההודעה בוואטסאפ ונסה שוב' }, { status: 400 });
    }

    await admin.from('phone_verifications').update({ verified_at: new Date().toISOString() }).eq('id', row.id);
    await admin.from('profiles').update({ phone: row.phone, phone_verified: true }).eq('id', user.id);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'bad action' }, { status: 400 });
}
