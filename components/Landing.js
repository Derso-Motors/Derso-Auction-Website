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

            {/* ── חתימת העמוד: כביש לילה חי — רכב נוסע, פסי-אור, טלמטריית מכרז ── */}
            <div className="landing-road" data-reveal aria-hidden="true">
              <span className="landing-streak amber" style={{ top: '30%', left: 0, right: 0, '--dur': '2.4s', '--delay': '0s' }} />
              <span className="landing-streak cyan" style={{ top: '46%', left: 0, right: 0, '--dur': '3.1s', '--delay': '1.2s' }} />
              <span className="landing-streak red" style={{ top: '62%', left: 0, right: 0, '--dur': '2.8s', '--delay': '2s' }} />
              <div className="landing-hud" style={{ top: 18, right: 24, '--delay': '0s' }}>מכרז חי · <b>סגירה 14:00</b></div>
              <div className="landing-hud good" style={{ top: 22, left: 28, '--delay': '1.4s' }}>מחיר שוק <b>‎-22%</b></div>
              <div className="landing-hud" style={{ top: 64, right: '38%', '--delay': '2.6s' }}>דוח בדיקה · <b>עבר ✓</b></div>
              <div className="landing-beam" />
              <svg className="landing-car" viewBox="0 0 220 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 52c-6 0-9-4-9-9 0-4 2-7 7-8l14-3 18-16c3-3 7-5 12-5h60c5 0 10 2 13 5l17 15 44 6c6 1 10 4 10 9 0 4-3 6-8 6H14z" fill="#20222a" stroke="#3d4152" strokeWidth="1.5"/>
                <path d="M52 18l14-12c2-2 5-3 8-3h40c4 0 7 1 9 3l14 12H52z" fill="#151720" stroke="#3d4152" strokeWidth="1.2"/>
                <path d="M60 17l10-9c1.5-1.5 3.5-2 6-2h14v11H60zM96 6h18c3 0 5 1 6 2l10 9H96V6z" fill="#7dd3fc" fillOpacity="0.16" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.8"/>
                <rect x="6" y="42" width="10" height="5" rx="2.5" fill="#ffd678"/>
                <rect x="204" y="42" width="9" height="5" rx="2.5" fill="#ff4d4d"/>
                <g className="landing-wheel"><circle cx="58" cy="56" r="13" fill="#0c0d11" stroke="#4a4f63" strokeWidth="2.5"/><path d="M58 46v20M48 56h20M51 49l14 14M65 49L51 63" stroke="#666c85" strokeWidth="1.6"/></g>
                <g className="landing-wheel"><circle cx="164" cy="56" r="13" fill="#0c0d11" stroke="#4a4f63" strokeWidth="2.5"/><path d="M164 46v20M154 56h20M157 49l14 14M171 49l-14 14" stroke="#666c85" strokeWidth="1.6"/></g>
              </svg>
              <div className="landing-road-line" />
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
