'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import SmoothScroll from './SmoothScroll';

// Scroll-reveal: elements with data-reveal fade/rise into view.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

const STATS = [
  { num: '500+', label: 'רכבים נמכרו' },
  { num: '98%', label: 'שביעות רצון' },
  { num: '7+', label: 'שנות ניסיון' },
];

const STEPS = [
  { icon: '📞', title: 'שיחת אפיון', desc: 'מבינים מה אתה מחפש — סוג רכב, תקציב ולוח זמנים' },
  { icon: '🔍', title: 'סינון וסריקה', desc: 'סורקים מכרזים ומוצאים רכבים מתחת למחיר השוק' },
  { icon: '📋', title: 'דוח בדיקה', desc: 'דוח מקצועי מפורט לפני כל הצעה — בלי הפתעות' },
  { icon: '🏆', title: 'זכייה ומסירה', desc: 'מלווים עד שהמפתחות ביד — רישוי, שחרור ומסירה' },
];

const FEATURES = [
  { icon: '🔍', title: 'איתור הזדמנויות', desc: 'סורקים מכרזים ומאתרים רכבים מתחת למחיר השוק' },
  { icon: '🤝', title: 'ליווי מלא', desc: 'מלווים אותך מהצעה ועד מסירה — בלי להתעסק לבד' },
  { icon: '📋', title: 'דוחות בדיקה', desc: 'דוח מקצועי + טופס סליקה משפטי לפני כל הצעה' },
];

export default function Landing() {
  const root = useReveal();

  return (
    <SmoothScroll>
      <div className="landing" ref={root}>
        {/* ── sticky header ── */}
        <header className="landing-header">
          <div className="landing-header-inner">
            <div className="topbar-brand">דרסו</div>
            <Link href="/login" className="btn small">כניסה / הרשמה</Link>
          </div>
        </header>

        {/* ── hero ── */}
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <span className="landing-badge" data-reveal>בית ליווי מקצועי למכרזי רכב</span>
            <h1 className="landing-h1" data-reveal>
              קונים רכב ממכרזים?<br />
              <span className="landing-gradient">אנחנו עושים את זה בשבילכם.</span>
            </h1>
            <p className="landing-sub" data-reveal>
              סינון הזדמנויות, ליווי בהצעות ודוחות בדיקה מקצועיים — עד שהרכב הנכון אצלך ביד.
            </p>
            <div className="landing-cta-row" data-reveal>
              <Link href="/login" className="btn landing-btn-primary">התחילו עכשיו</Link>
              <a href="https://wa.me/972559506913" target="_blank" rel="noreferrer" className="btn secondary landing-btn-wa">
                💬 דברו איתנו
              </a>
            </div>
          </div>
        </section>

        {/* ── stats ── */}
        <section className="landing-stats">
          {STATS.map((s, i) => (
            <div className="landing-stat" data-reveal style={{ animationDelay: `${i * 0.1}s` }} key={i}>
              <div className="landing-stat-num">{s.num}</div>
              <div className="landing-stat-label">{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── features ── */}
        <section className="landing-section">
          <h2 className="landing-h2" data-reveal>למה דרסו?</h2>
          <div className="landing-features">
            {FEATURES.map((f, i) => (
              <div className="landing-feature-card" data-reveal style={{ animationDelay: `${i * 0.1}s` }} key={i}>
                <div className="landing-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── how it works ── */}
        <section className="landing-section">
          <h2 className="landing-h2" data-reveal>איך זה עובד?</h2>
          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div className="landing-step" data-reveal style={{ animationDelay: `${i * 0.08}s` }} key={i}>
                <div className="landing-step-num">{i + 1}</div>
                <div className="landing-step-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── final CTA ── */}
        <section className="landing-final-cta" data-reveal>
          <h2>מוכנים להתחיל?</h2>
          <p>שיחת אפיון ראשונה — חינם וללא התחייבות</p>
          <div className="landing-cta-row">
            <Link href="/book-call" className="btn landing-btn-primary">קביעת שיחת אפיון</Link>
            <a href="https://wa.me/972559506913" target="_blank" rel="noreferrer" className="btn secondary landing-btn-wa">
              💬 וואטסאפ
            </a>
          </div>
        </section>

        {/* ── footer ── */}
        <footer className="landing-footer">
          <div className="landing-footer-links">
            <Link href="/terms">תקנון</Link>
            <Link href="/privacy">מדיניות פרטיות</Link>
            <Link href="/disclaimer">הבהרה משפטית</Link>
          </div>
          <p>© 2026 דרסו — כל הזכויות שמורות</p>
        </footer>
      </div>
    </SmoothScroll>
  );
}
