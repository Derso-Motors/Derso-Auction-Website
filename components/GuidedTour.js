'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const SEEN = 'derso_tour_seen';
const STEP = 'derso_tour_step';
const ACTIVE = 'derso_tour_active';
const CARD_W = 340;

const OPENING =
  'רוצים את הרכב החדש שלכם במחיר הנכון? בואו נתחיל בהסבר קצר וקליל. נעבור יחד על כל חלק בתפריט ונראה לכם מה הוא עושה ואיך הוא עוזר לכם. אפשר להמשיך איתנו צעד־צעד, ואפשר לצאת בכל רגע שתרצו, בלי שום התחייבות. מוכנים?';

const STEPS = [
  { route: '/', splash: true, title: 'ברוכים הבאים לאזור האישי', body: OPENING },
  { route: '/', navKey: 'home', title: 'המסך הראשי שלכם', body: 'זה הבית שלכם באתר. כאן רואים במבט אחד את כל מה שחשוב: הרכבים שאתם מתקדמים איתם, יתרת הקרדיטים שלכם, המכרזים הפעילים והפגישות שקבעתם. אם תרצו לחזור לכאן בכל שלב, פשוט לוחצים על הכפתור הזה.' },
  { route: '/recommended', navKey: 'recommended', title: 'רכבים בהמלצה', body: 'כאן נמצאים הרכבים שבחרנו במיוחד בשבילכם. אחרי שיחת האפיון, הרכבים שנמליץ לכם יופיעו כאן. תוכלו לסמן את אלה שמוצאים חן בעיניכם, וכך נדע איך להמשיך ולעזור לכם. אם תזכו במכרז, הרכב שלכם יופיע כאן.' },
  { route: '/book-call', navKey: 'book-call', title: 'קביעת שיחת אפיון', body: 'כאן קובעים שיחה קצרה עם נציג שלנו שיכיר אתכם ויבין מה אתם מחפשים. בוחרים יום שנוח לכם, בין ראשון לחמישי, ואז בוחרים שעה פנויה ומאשרים. אחרי הקביעה תקבלו אישור גם בוואטסאפ, כדי שלא תשכחו. זו הדרך הכי טובה להתחיל.' },
  { route: '/reports', navKey: 'reports', title: 'דוחות ותשלומים', body: 'כאן מזמינים דוחות בדיקה לרכב ורואים את הכסף שלכם. אפשר להזמין דוח היסטוריה, בדיקה מכנית מלאה או הערכת שווי, ולשלם בכרטיס או בקרדיטים שצברתם. בטבלה למטה רואים כמה קרדיטים נשארו לכם ואת כל ההזמנות שלכם.' },
  { route: '/messages', navKey: 'messages', title: 'שאלות ופניות', body: 'כאן אפשר לשאול אותנו כל דבר. זו תיבת צ׳אט פשוטה שבה שולחים לנו הודעה ואנחנו חוזרים אליכם. כל ההתכתבות שלכם עם הצוות נשמרת כאן. אנחנו כאן בשבילכם. סיימנו את הסיור, נעים מאוד ובהצלחה.' },
];

const CSS = `
.tour-scrim{position:fixed;inset:0;z-index:2900;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);animation:tour-fade .25s ease forwards}
@keyframes tour-fade{from{opacity:0}to{opacity:1}}
.tour-card{position:fixed;z-index:2950;width:340px;max-width:calc(100vw - 24px);background:var(--surface,#12161c);border:1px solid var(--border,#2a2f37);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);padding:22px 20px 18px;text-align:right;opacity:0;transform:scale(.96);animation:tour-pop .34s cubic-bezier(.34,1.56,.64,1) forwards}
.tour-card.centered{top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);animation:tour-pop-c .34s cubic-bezier(.34,1.56,.64,1) forwards}
@keyframes tour-pop{to{opacity:1;transform:scale(1)}}
@keyframes tour-pop-c{to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
.tour-arrow{position:absolute;top:50%;width:14px;height:14px;background:var(--surface,#12161c);transform:translateY(-50%) rotate(45deg)}
.tour-arrow.on-right{right:-7px;border-top:1px solid var(--border);border-right:1px solid var(--border)}
.tour-arrow.on-left{left:-7px;border-bottom:1px solid var(--border);border-left:1px solid var(--border)}
.tour-x{position:absolute;top:12px;left:14px;background:none;border:none;color:var(--muted-dim,#8a93a0);font-size:16px;line-height:1;cursor:pointer;padding:4px}
.tour-kicker{font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--primary,#5b8cff);margin-bottom:6px}
.tour-title{font-size:18px;font-weight:800;color:var(--text,#eef1f5);margin-bottom:9px}
.tour-body{font-size:13.5px;line-height:1.8;color:var(--muted,#aab2bd);margin-bottom:15px}
.tour-fadeitem{opacity:0;transform:translateY(10px);animation:tour-item .45s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i,0)*60ms + .1s)}
@keyframes tour-item{to{opacity:1;transform:translateY(0)}}
.tour-dots{display:flex;gap:6px;justify-content:center;margin:2px 0 15px}
.tour-dot{width:7px;height:7px;border-radius:50%;background:var(--border,#2a2f37);transition:width .35s cubic-bezier(.34,1.56,.64,1),background-color .25s}
.tour-dot.on{width:20px;border-radius:4px;background:var(--primary,#5b8cff)}
.tour-actions{display:flex;flex-direction:column;gap:8px}
.tour-actions .btn{width:100%}
.tour-next-ico{display:inline-block;margin-inline-start:6px;animation:tour-nudge 1.4s ease infinite}
@keyframes tour-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px)}}
.tour-back{margin-top:9px;background:none;border:none;color:var(--muted-dim,#8a93a0);font-size:12.5px;cursor:pointer;width:100%;font-family:inherit}
@media (prefers-reduced-motion:reduce){.tour-scrim,.tour-card,.tour-fadeitem,.tour-next-ico{animation:none!important;opacity:1!important;transform:none!important}.tour-card.centered{transform:translate(-50%,-50%)!important}}
`;

export default function GuidedTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState(null);
  const hiRef = useRef(null);

  // Decide whether the tour is active (runs on every route change).
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
    setPos(null);
    setStep(n);
    if (STEPS[n].route !== pathname) router.push(STEPS[n].route);
  }, [pathname, router, finish]);

  // Esc closes.
  useEffect(() => {
    if (!active) return;
    function onKey(e) { if (e.key === 'Escape') finish(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  const cur = (ready && active) ? STEPS[step] : null;
  const onThisRoute = cur && cur.route === pathname;

  // Position the card next to the target sidebar icon + highlight it.
  useEffect(() => {
    if (!onThisRoute) return;
    if (cur.splash) { setPos({ centered: true }); return; }
    let raf1 = 0, tries = 0, cancelled = false;
    function place() {
      if (cancelled) return;
      const el = document.querySelector(`[data-nav-key="${cur.navKey}"]`);
      if (!el) { if (tries++ < 20) { raf1 = requestAnimationFrame(place); } return; }
      // highlight
      if (hiRef.current && hiRef.current !== el) hiRef.current.style.boxShadow = '';
      hiRef.current = el;
      el.style.transition = 'box-shadow .2s ease';
      el.style.boxShadow = '0 0 0 3px var(--primary), 0 0 16px 3px var(--primary)';
      const r = el.getBoundingClientRect();
      const iconOnRight = r.left > window.innerWidth / 2;
      const gap = 18;
      let left = iconOnRight ? (r.left - CARD_W - gap) : (r.right + gap);
      left = Math.max(12, Math.min(left, window.innerWidth - CARD_W - 12));
      let top = r.top + r.height / 2;
      top = Math.max(130, Math.min(top, window.innerHeight - 130));
      setPos({ centered: false, left, top, side: iconOnRight ? 'right' : 'left' });
    }
    place();
    function onResize() { place(); }
    window.addEventListener('resize', onResize);
    return () => { cancelled = true; if (raf1) cancelAnimationFrame(raf1); window.removeEventListener('resize', onResize); };
  }, [onThisRoute, cur, step]);

  // Clear the icon highlight whenever the tour is not showing here.
  useEffect(() => {
    return () => { if (hiRef.current) { hiRef.current.style.boxShadow = ''; hiRef.current = null; } };
  }, []);
  useEffect(() => {
    if (!onThisRoute && hiRef.current) { hiRef.current.style.boxShadow = ''; hiRef.current = null; }
  }, [onThisRoute]);

  if (!cur || !onThisRoute || !pos) return null;

  const isSplash = !!cur.splash;
  const isLast = step === STEPS.length - 1;
  const cardStyle = pos.centered ? undefined : { top: pos.top + 'px', left: pos.left + 'px', transform: 'translateY(-50%)' };

  return (
    <div className="tour-scrim" onClick={finish} role="dialog" aria-modal="true">
      <style>{CSS}</style>
      <div className={`tour-card ${pos.centered ? 'centered' : ''}`} style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {!pos.centered && <span className={`tour-arrow ${pos.side === 'right' ? 'on-right' : 'on-left'}`} aria-hidden="true" />}
        <button className="tour-x" type="button" onClick={finish} aria-label="סגירה">✕</button>
        <div key={'s' + step}>
          {!isSplash && <div className="tour-kicker tour-fadeitem" style={{ '--i': 0 }}>{`שלב ${step} מתוך ${STEPS.length - 1}`}</div>}
          <div className="tour-title tour-fadeitem" style={{ '--i': 1 }}>{cur.title}</div>
          <div className="tour-body tour-fadeitem" style={{ '--i': 2 }}>{cur.body}</div>
        </div>
        <div className="tour-dots">
          {STEPS.slice(1).map((_, i) => (
            <span key={i} className={`tour-dot ${i === step - 1 ? 'on' : ''}`} />
          ))}
        </div>
        <div className="tour-actions tour-fadeitem" style={{ '--i': 3 }}>
          <button className="btn" type="button" onClick={() => go(step + 1)}>
            {isLast ? 'סיימנו, תודה' : (isSplash ? 'בואו נתחיל' : 'הבא')}
            {!isLast && <span className="tour-next-ico" aria-hidden="true">‹</span>}
          </button>
          <button className="btn secondary" type="button" onClick={finish}>
            {isSplash ? 'אולי מאוחר יותר' : 'דילוג על הסיור'}
          </button>
        </div>
        {!isSplash && step > 1 && (
          <button className="tour-back" type="button" onClick={() => go(step - 1)}>חזרה לשלב הקודם</button>
        )}
      </div>
    </div>
  );
}
