import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Quick self-diagnosis page: https://<site>/api/health
// האבחון המלא נחשף רק עם Authorization: Bearer <CRON_SECRET> — בלי זה מחזירים רק ok
export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ ok: true });
  }

  const checks = {};

  checks.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ מוגדר' : '❌ חסר';
  checks.CRON_SECRET = process.env.CRON_SECRET ? '✅ מוגדר' : '❌ חסר';
  checks.APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ? '✅ מוגדר' : '⚠️ חסר (אירועי יומן גוגל לא ייווצרו)';
  checks.OPENROUTER_API_KEY = (process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY) ? '✅ מוגדר' : '⚠️ חסר (העוזר יעבוד במצב בסיסי)';

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    checks.SUPABASE_SERVICE_ROLE_KEY = '❌ חסר לגמרי';
  } else {
    const looksLikeJwt = key.startsWith('eyJ');
    const looksLikeSecret = key.startsWith('sb_secret_');
    try {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
      const { error } = await admin.from('phone_verifications').select('id', { head: true, count: 'exact' }).limit(1);
      if (!error) {
        checks.SUPABASE_SERVICE_ROLE_KEY = '✅ תקין ועובד';
      } else {
        checks.SUPABASE_SERVICE_ROLE_KEY = `❌ לא תקין (${error.message}). ` +
          (looksLikeJwt || looksLikeSecret
            ? 'ייתכן שהועתק חלקית — העתק שוב את כל המפתח'
            : 'הערך לא נראה כמו מפתח service_role — ודא שהעתקת את service_role (מתחיל ב-eyJ) ולא את anon/publishable');
      }
    } catch (e) {
      checks.SUPABASE_SERVICE_ROLE_KEY = `❌ שגיאה: ${e.message}`;
    }
  }

  return Response.json({ ok: true, checks }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
