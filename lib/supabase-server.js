import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export function createClient() {
  let cookieStore;
  try {
    cookieStore = cookies();
  } catch {
    cookieStore = { getAll: () => [], set: () => {} };
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

export async function requireUser() {
  const supabase = createClient();
  let user = (await supabase.auth.getUser()).data.user;
  // getUser() ב-server action מחזיר null לפעמים באופן זמני (מרוץ רענון טוקן) —
  // מה שגרם ל-redirect ל-/login ומשם (כי המשתמש מחובר) חזרה לדף הבית. נופלים ל-getSession
  // שקורא את ה-JWT מהעוגיות בלי קריאת רשת, כדי לא "להתנתק" בטעות.
  if (!user) {
    const session = (await supabase.auth.getSession()).data.session;
    user = session?.user || null;
  }
  if (!user) redirect('/login');
  return { supabase, user };
}

// כמו requireUser אבל בלי redirect — לעמוד הבית שמציג דף נחיתה לאורחים.
export async function getOptionalUser() {
  const supabase = createClient();
  let user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    const session = (await supabase.auth.getSession()).data.session;
    user = session?.user || null;
  }
  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser(); // מאמת זהות (getUser)
  // בדיקת התפקיד עם service-role — עמידה לתקלת auth-context של server actions
  // ש"החזירה" את המנהל לדף הבית אחרי קביעת פגישה. אם אין service key — נופלים לחיבור הרגיל.
  let role = null;
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data } = await svc.from('profiles').select('role').eq('id', user.id).single();
      role = data?.role ?? null;
    } else {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      role = data?.role ?? null;
    }
  } catch { role = null; }
  if (role !== 'admin') redirect('/');
  return { supabase, user }; // הפעולות על הנתונים ממשיכות עם חיבור המשתמש (RLS חל)
}
