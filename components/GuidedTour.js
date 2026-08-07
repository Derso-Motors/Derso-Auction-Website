'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const SEEN = 'derso_tour_seen';
const STEP = 'derso_tour_step';
const ACTIVE = 'derso_tour_active';

const OPENING =
  'רוצים את הרכב החדש שלכם במחיר הנכון? בואו נתחיל בהסבר קצר וקליל. אנחנו נעבור יחד על כמה מסכים ונראה לכם מה יש בכל אחד מהם ואיך זה עוזר לכם. אפשר להמשיך איתנו צעד־צעד, ואפשר לצאת בכל רגע שתרצו, בלי שום התחייבות. מוכנים? בואו נתחיל.';

const STEPS = [
  { route: '/', kind: 'splash', title: 'בואו נכיר את האזור האישי', body: OPENING },
  { route: '/', title: 'המסך הראשי שלכם', body: 'זה הבית שלכם באתר. כאן רואים במבט אחד את כל מה שחשוב: הרכבים שאתם מתקדמים איתם, יתרת הקרדיטים שלכם, המכרזים הפעילים והפגישות שקבעתם. יש כאן גם כפתור גדול לקביעת שיחת אפיון, ומעקב נוח אחרי כל המכרזים שלכם. אם תרצו לחזור לכאן בכל שלב, פשוט לוחצים על ראשי בתפריט.' },
  { route: '/recommended', title: 'רכבים בהמלצה', body: 'כאן נמצאים הרכבים שבחרנו במיוחד בשבילכם. אחרי שיחת האפיון, הרכבים שנמליץ לכם יופיעו כאן. תוכלו לסמן את אלה שמוצאים חן בעיניכם, וכך נדע איך להמשיך ולעזור לכם למצוא בדיוק את מה שאתם רוצים. אם תזכו במכרז, הרכב שלכם יופיע כאן.' },
  { route: '/book-call', title: 'קביעת שיחת אפיון', body: 'כאן קובעים שיחה קצרה עם נציג שלנו שיכיר אתכם ויבין מה אתם מחפשים. בוחרים יום שנוח לכם, בין ראשון לחמישי, ואז בוחרים שעה פנויה ומאשרים. אחרי הקביעה תקבלו אישור גם בוואטסאפ, כדי שלא תשכחו. זו הדרך הכי טובה להתחיל.' },
  { route: '/reports', title: 'דוחות ותשלומים', body: 'כאן מזמינים דוחות בדיקה לרכב ורואים את הכסף שלכם. אפשר להזמין דוח היסטוריה, בדיקה מכנית מלאה או הערכת שווי, ולשלם בכרטיס או בקרדיטים שצברתם. בטבלה למטה רואים כמה קרדיטים נשארו לכם ואת כל ההזמנות שלכם, ומורידים את הדוח ברגע שהוא מוכן.' },
  { route: '/messages', title: 'שאלות ופניות', body: 'כאן אפשר לשאול אותנו כל דבר. זו תיבת צ׳אט פשוטה שבה שולחים לנו הודעה ואנחנו חוזרים אליכם. כל ההתכתבות שלכם עם הצוות נשמרת כאן, כדי שתמיד תוכלו לחזור ולראות מה נאמר. אנחנו כאן בשבילכם. סיימנו את הסיור, נעים מאוד ובהצלחה.' },
];

const ICONS = [
  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 5 5.6.8-4 4 1 5.6L12 20l-5 2.4 1-5.6-4-4 5.6-.8z"/></svg>),
  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>),
  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>),
  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
];

const CSS = `
.onb-backdrop{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);animation:onb-bd .28s ease forwards}
@keyframes onb-bd{from{opacity:0}to{opacity:1}}
.onb-card{position:relative;width:100%;max-width:420px;background:var(--surface,#15181d);border:1px solid var(--border,#2a2f37);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.55);padding:28px 22px 20px;text-align:right;opacity:0;transform:scale(.94) translateY(10px);animation:onb-card .42s cubic-bezier(.34,1.56,.64,1) .05s forwards}
@keyframes onb-card{to{opacity:1;transform:scale(1) translateY(0)}}
.onb-x{position:absolute;top:12px;left:14px;background:none;border:none;color:var(--muted-dim,#8a93a0);font-size:16px;line-height:1;cursor:pointer;padding:4px}
.onb-illus{display:flex;justify-content:center;margin:2px 0 14px;color:var(--primary,#5b8cff);animation:onb-float 3s ease-in-out infinite}
.onb-illus svg{width:46px;height:46px}
@keyframes onb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.onb-slide{animation:onb-slide .4s cubic-bezier(.16,1,.3,1) both}
@keyframes onb-slide{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
.onb-kicker{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--primary,#5b8cff);text-align:center;margin-bottom:6px}
.onb-title{font-size:20px;font-weight:800;color:var(--text,#eef1f5);text-align:center;margin-bottom:10px}
.onb-body{font-size:14px;line-height:1.8;color:var(--muted,#aab2bd);text-align:right;margin-bottom:16px}
.onb-item{opacity:0;transform:translateY(12px);animation:onb-item .5s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i,0)*70ms + .12s)}
@keyframes onb-item{to{opacity:1;transform:translateY(0)}}
.onb-dots{display:flex;gap:6px;justify-content:center;margin-bottom:16px}
.onb-dot{width:7px;height:7px;border-radius:50%;background:var(--border,#2a2f37);transition:width .38s cubic-bezier(.34,1.56,.64,1),background-color .26s ease}
.onb-dot.is-active{width:20px;border-radius:4px;background:var(--primary,#5b8cff)}
.onb-actions{display:flex;flex-direction:column;gap:8px}
.onb-actions .btn{width:100%}
.onb-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px}
.onb-next-arrow{display:inline-block;font-size:18px;line-height:1;animation:onb-nudge 1.4s ease infinite}
@keyframes onb-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px)}}
.onb-back{margin-top:10px;background:none;border:none;color:var(--muted-dim,#8a93a0);font-size:12.5px;cursor:pointer;width:100%;font-family:inherit}
@media (prefers-reduced-motion:reduce){.onb-backdrop,.onb-card,.onb-item,.onb-slide,.onb-illus,.onb-next-arrow{animation:none!important;opacity:1!important;transform:none!important}}
`;

export default function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let seen = false, act = false, s = 0, force = false;
    try {
      force = new URLSearchParams(window.location.search).get('tour') === '1';
      seen = !!localStorage.getItem(SEEN);
      act = sessionStorage.getItem(ACTIVE) === '1';
      s = parseInt(sessionStorage.getItem(STEP) || '0', 10) || 0;
    } catch {}
    if (force) {
      try { localStorage.removeItem(SEEN); sessionStorage.setItem(ACTIVE, '1'); sessionStorage.setItem(STEP, '0'); } catch {}
      setActive(true); setStep(0); setReady(true); return;
    }
    if (act) { setActive(true); setStep(Math.min(s, STEPS.length - 1)); setReady(true); return; }
    if (!seen) {
      try { sessionStorage.setItem(ACTIVE, '1'); sessionStorage.setItem(STEP, '0'); } catch {}
      setActive(true); setStep(0); setReady(true); return;
    }
    setActive(false); setReady(true);
  }, [pathname]);

  const finish = useCallback(() => {
    try { localStorage.setItem(SEEN, '1'); sessionStorage.removeItem(ACTIVE); sessionStorage.removeItem(STEP); } catch {}
    setActive(false);
    try { if (new URLSearchParams(window.location.search).get('tour')) router.replace(window.location.pathname); } catch {}
  }, [router]);

  const go = useCallback((n) => {
    if (n < 0) return;
    if (n >= STEPS.length) { finish(); return; }
    try { sessionStorage.setItem(STEP, String(n)); } catch {}
    setStep(n);
    if (STEPS[n].route !== pathname) router.push(STEPS[n].route);
  }, [pathname, router, finish]);

  useEffect(() => {
    if (!active) return;
    function onKey(e) { if (e.key === 'Escape') finish(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  if (!ready || !active) return null;
  const cur = STEPS[step];
  if (!cur || cur.route !== pathname) return null;

  const isSplash = cur.kind === 'splash';
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onb-backdrop" onClick={finish} role="dialog" aria-modal="true">
      <style>{CSS}</style>
      <div className="onb-card" onClick={(e) => e.stopPropagation()}>
        <button className="onb-x" type="button" onClick={finish} aria-label="סגירה">✕</button>
        <div className="onb-illus" key={'ic' + step}>{ICONS[step] || ICONS[0]}</div>
        <div className="onb-slide" key={'sl' + step}>
          {!isSplash && <div className="onb-kicker onb-item" style={{ '--i': 0 }}>{`שלב ${step} מתוך ${STEPS.length - 1}`}</div>}
          <div className="onb-title onb-item" style={{ '--i': 1 }}>{cur.title}</div>
          <div className="onb-body onb-item" style={{ '--i': 2 }}>{cur.body}</div>
        </div>
        <div className="onb-dots">
          {STEPS.slice(1).map((_, i) => (
            <span key={i} className={`onb-dot ${i === step - 1 ? 'is-active' : ''}`} />
          ))}
        </div>
        <div className="onb-actions onb-item" style={{ '--i': 3 }}>
          <button className="btn onb-primary" type="button" onClick={() => go(step + 1)}>
            {isLast ? 'סיימנו, תודה' : (isSplash ? 'בואו נתחיל' : 'הבא')}
            {!isLast && <span className="onb-next-arrow" aria-hidden="true">‹</span>}
          </button>
          <button className="btn secondary" type="button" onClick={finish}>
            {isSplash ? 'אולי מאוחר יותר' : 'דילוג על הסיור'}
          </button>
        </div>
        {!isSplash && step > 1 && (
          <button className="onb-back" type="button" onClick={() => go(step - 1)}>חזרה לשלב הקודם</button>
        )}
      </div>
    </div>
  );
}
