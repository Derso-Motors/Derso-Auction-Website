import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Validate the token with the auth server (getUser), NOT getSession — otherwise
  // middleware trusts a stale cookie while the pages (which use getUser) reject it,
  // causing an infinite /login ↔ / redirect loop (ERR_TOO_MANY_REDIRECTS).
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // nadav.derso.net הוא אתר נדב הציבורי — אין עליו התחברות; כל נתיב פתוח.
  const host = request.headers.get('host') || '';
  const isNadavHost = host === 'nadav.derso.net';
  const isPublic = isNadavHost || path.startsWith('/login') || path.startsWith('/r/') || path.startsWith('/call/') || path.startsWith('/auth/') || path.startsWith('/_next') || path.startsWith('/favicon') || path.startsWith('/terms') || path.startsWith('/privacy') || path.startsWith('/disclaimer') || path.startsWith('/nadav') || path.startsWith('/api/') || path === '/manifest.webmanifest' || path.startsWith('/icon-') || path === '/apple-touch-icon.png' || path === '/';

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && path.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
