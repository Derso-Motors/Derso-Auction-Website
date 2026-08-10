'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Staggers every meaningful element on the page (cards, titles, sections,
// table rows) one after another — pricing-page style — on every navigation.
export default function MainAnimator({ children }) {
  const pathname = usePathname();
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const els = root.querySelectorAll(
      '.page-title, .page-sub, .card, .pr-card, .pr-hero, .pr-guarantee, .verify-banner, .info-msg, .error-msg'
    );
    let i = 0;
    els.forEach((el) => {
      // skip nested cards (a card inside a card) so containers don't double-animate
      if (el.parentElement?.closest?.('.card') && el.classList.contains('card')) return;
      el.style.animation = 'none';
      // force reflow so the animation restarts even for reused DOM nodes
      void el.offsetWidth;
      el.style.animation = `page-rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${0.04 + i * 0.06}s both`;
      i += 1;
    });

    const rows = root.querySelectorAll('table.data tbody tr');
    rows.forEach((tr, j) => {
      tr.style.animation = 'none';
      void tr.offsetWidth;
      tr.style.animation = `row-fade 0.3s ease ${0.1 + Math.min(j, 12) * 0.04}s both`;
    });
  }, [pathname]);

  return <div key={pathname} ref={ref} className="main-anim">{children}</div>;
}
