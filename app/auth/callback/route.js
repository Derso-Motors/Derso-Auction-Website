import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function loginError(origin, msg) {
  return NextResponse.redirect(`${origin}/login?err=${encodeURIComponent(msg)}`);
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Google/Supabase report failures via error params instead of a code.
  const providerError = searchParams.get('error_description') || searchParams.get('error');
  if (providerError) {
    return loginError(origin, `ההתחברות עם Google נכשלה: ${providerError}`);
  }
  if (!code) {
    return loginError(origin, 'ההתחברות עם Google נכשלה — לא התקבל קוד אימות. נסה שוב.');
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    const msg = /expired|state/i.test(error.message || '')
      ? 'ההתחברות לקחה יותר מדי זמן ופג תוקפה — נסה שוב ובחר חשבון מיד.'
      : `ההתחברות עם Google נכשלה: ${error.message || 'שגיאה לא ידועה'}`;
    return loginError(origin, msg);
  }

  return loginError(origin, 'ההתחברות עם Google נכשלה. נסה שוב.');
}
