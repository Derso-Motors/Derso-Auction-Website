import { createClient as createServerClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Phone verification runs entirely through two SECURITY DEFINER RPCs
// (send_phone_verification / check_phone_verification) called with the logged-in
// user's session and the public anon key — so the app no longer depends on the
// SUPABASE_SERVICE_ROLE_KEY env var. The RPCs enforce rate-limiting, keep the code
// secret (never returned to the client), and enqueue the WhatsApp message.

const SEND_ERRORS = {
  not_authenticated: ['צריך להתחבר קודם', 401],
  bad_phone: ['מספר הטלפון לא תקין — הזן מספר ישראלי, למשל 0501234567', 400],
  rate_limited: ['נשלחו יותר מדי קודים. נסה שוב בעוד כמה דקות.', 429],
};

const CHECK_ERRORS = {
  not_authenticated: ['צריך להתחבר קודם', 401],
  bad_code: ['הקוד חייב להכיל 6 ספרות', 400],
  no_active_code: ['לא נמצא קוד פעיל — לחץ על "שליחת קוד" קודם', 400],
  expired: ['הקוד פג תוקף — שלח קוד חדש', 400],
  too_many_attempts: ['יותר מדי ניסיונות — שלח קוד חדש', 429],
  wrong_code: ['קוד שגוי — בדוק את ההודעה בוואטסאפ ונסה שוב', 400],
};

export async function POST(request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: 'צריך להתחבר קודם' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  if (body.action === 'send') {
    const { data, error } = await supabase.rpc('send_phone_verification', { p_phone: body.phone });
    if (error) return Response.json({ ok: false, error: `שגיאה בשליחת הקוד: ${error.message}` }, { status: 500 });
    if (!data?.ok) {
      const [msg, status] = SEND_ERRORS[data?.error] || ['שגיאה בשליחת הקוד', 500];
      return Response.json({ ok: false, error: msg }, { status });
    }
    return Response.json({ ok: true });
  }

  if (body.action === 'check') {
    const { data, error } = await supabase.rpc('check_phone_verification', { p_code: body.code });
    if (error) return Response.json({ ok: false, error: `שגיאה באימות: ${error.message}` }, { status: 500 });
    if (!data?.ok) {
      const [msg, status] = CHECK_ERRORS[data?.error] || ['שגיאה באימות', 500];
      return Response.json({ ok: false, error: msg }, { status });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'bad action' }, { status: 400 });
}
