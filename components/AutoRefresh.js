'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Site-wide live refresh: re-fetches server data every 30s while the tab is
// visible, and immediately when the user returns to the tab — so changes made
// elsewhere (WhatsApp cancellation, admin actions) show up without a manual reload.
export default function AutoRefresh({ intervalMs = 30000 }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const onVisible = () => { if (!document.hidden) router.refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(refresh, intervalMs);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, [router, intervalMs]);

  return null;
}
