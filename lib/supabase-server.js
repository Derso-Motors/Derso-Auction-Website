import { createServerClient } from '@supabase/ssr';
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
