'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

// גלילה חלקה בכל האתר (Lenis — כמו vectrfl.com).
// - מכבד prefers-reduced-motion (נגישות): לא מופעל למי שביקש להפחית אנימציות.
// - אזורי גלילה פנימיים (טבלאות/צ'אט) מסומנים data-lenis-prevent וממשיכים לעבוד רגיל.
// - anchors: גלילה חלקה גם לקישורי #עוגן.
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ease-out expo
      anchors: true,
    });

    // חשיפת מופע גלובלי (דיבוג/אינטגרציות עתידיות)
    window.lenis = lenis;

    // אנימציות reveal בגלילה: כל [data-reveal] מקבל .revealed כשנכנס למסך
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    return () => { io.disconnect(); lenis.destroy(); window.lenis = undefined; };
  }, []);

  return null;
}
