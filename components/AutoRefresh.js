'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Site-wide live refresh: re-fetches server data every 30s while the tab is
// visible, and immediately when the user returns to the tab — so changes made
// elsewhere (WhatsApp cancellation, admin actions) show up without a manual reload.
// The focus handler is debounced so it doesn't interfere with click navigation.
export default function AutoRefresh({ intervalMs = 60000 }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastRefresh.current < 2000) return;
      lastRefresh.current = now;
      router.refresh();
    };
    const onVisible = () => { if (!document.hidden) setTimeout(refresh, 300); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, [router, intervalMs]);

  return null;
}
