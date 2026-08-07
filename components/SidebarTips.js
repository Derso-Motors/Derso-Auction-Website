'use client';

import { useEffect, useRef, useState } from 'react';

// Short, friendly explanation shown when hovering a sidebar icon. Keyed by the
// nav item's `data-nav-key`. Covers both client and admin nav items.
const TIPS = {
  home: { title: 'ראשי', desc: 'כל מה שחשוב במבט אחד: הרכבים, הקרדיטים, הפגישות והמכרזים שלכם.' },
  recommended: { title: 'רכבים בהמלצה', desc: 'הרכבים שבחרנו בשבילכם אחרי שיחת האפיון. סמנו מה שמעניין אתכם.' },
  'book-call': { title: 'קביעת שיחת אפיון', desc: 'בוחרים יום ושעה, ונציג יחזור אליכם להכיר ולהבין מה אתם מחפשים.' },
  reports: { title: 'דוחות ותשלומים', desc: 'מזמינים דוח בדיקה לרכב, ורואים את יתרת הקרדיטים וההזמנות שלכם.' },
  messages: { title: 'שאלות ופניות', desc: 'צ׳אט ישיר איתנו. כל ההתכתבות נשמרת כאן.' },
  admin: { title: 'ניהול', desc: 'לוח הבקרה הניהולי.' },
  cars: { title: 'רכבים', desc: 'כל הרכבים בטיפול והשלבים שלהם.' },
  clients: { title: 'לקוחות', desc: 'ניהול הלקוחות והפרטים שלהם.' },
  orders: { title: 'הזמנות דוחות', desc: 'כל בקשות הדוחות מהלקוחות.' },
  calendar: { title: 'יומן פגישות', desc: 'כל הפגישות המתוכננות.' },
  recommendations: { title: 'המלצות', desc: 'בניית רשימות רכבים מומלצים ללקוחות.' },
  auctions: { title: 'מעקב מכרזים', desc: 'הסטטוס של כל המכרזים.' },
  marketplace: { title: 'העלאה למכירה', desc: 'הדבקת רכב מבידספיריט והכנת מודעה לפייסבוק.' },
  inventory: { title: 'מאגר רכבים', desc: 'כל הרכבים במלאי.' },
  broadcasts: { title: 'שידורים', desc: 'שליחת עדכונים ללקוחות.' },
  tasks: { title: 'משימות והיום', desc: 'המשימות והלו״ז שלכם.' },
};

const CSS = `
.navtip{position:fixed;z-index:2600;width:210px;background:var(--surface,#12161c);border:1px solid var(--border,#2a2f37);border-radius:12px;padding:10px 12px;box-shadow:0 12px 40px rgba(0,0,0,.5);text-align:right;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .15s ease}
.navtip.show{opacity:1;transform:translateY(0)}
.navtip-t{font-weight:700;font-size:12.5px;color:var(--text,#eef1f5);margin-bottom:3px}
.navtip-d{font-size:11.5px;line-height:1.55;color:var(--muted,#aab2bd)}
.navtip-a{position:fixed;z-index:2600;width:9px;height:9px;background:var(--surface,#12161c);transform:rotate(45deg);opacity:0;transition:opacity .15s ease}
.navtip-a.show{opacity:1}
.navtip-a.on-right{border-top:1px solid var(--border);border-right:1px solid var(--border)}
.navtip-a.on-left{border-bottom:1px solid var(--border);border-left:1px solid var(--border)}
@media (max-width:820px){.navtip,.navtip-a{display:none!important}}
@media (prefers-reduced-motion:reduce){.navtip{transition:opacity .1s linear;transform:none!important}}
`;

export default function SidebarTips() {
  const [tip, setTip] = useState(null);
  const hideT = useRef(null);

  useEffect(() => {
    function tourActive() { try { return sessionStorage.getItem('derso_tour_active') === '1'; } catch { return false; } }
    function onOver(e) {
      const el = e.target.closest && e.target.closest('[data-nav-key]');
      if (!el) return;
      const key = el.getAttribute('data-nav-key');
      const info = TIPS[key];
      if (!info || tourActive()) return;
      if (hideT.current) { clearTimeout(hideT.current); hideT.current = null; }
      const r = el.getBoundingClientRect();
      const iconOnRight = r.left > window.innerWidth / 2;
      const W = 210, gap = 14;
      let left = iconOnRight ? (r.left - W - gap) : (r.right + gap);
      left = Math.max(10, Math.min(left, window.innerWidth - W - 10));
      const top = Math.max(70, Math.min(r.top + r.height / 2, window.innerHeight - 70));
      const arrowLeft = iconOnRight ? (left + W - 4) : (left - 5);
      setTip({ key, info, left, top, arrowLeft, side: iconOnRight ? 'right' : 'left' });
    }
    function onOut(e) {
      const el = e.target.closest && e.target.closest('[data-nav-key]');
      if (!el) return;
      hideT.current = setTimeout(() => setTip(null), 60);
    }
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      if (hideT.current) clearTimeout(hideT.current);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      {tip && (
        <>
          <div className="navtip show" style={{ top: tip.top + 'px', left: tip.left + 'px', transform: 'translateY(-50%)' }}>
            <div className="navtip-t">{tip.info.title}</div>
            <div className="navtip-d">{tip.info.desc}</div>
          </div>
          <div className={`navtip-a show ${tip.side === 'right' ? 'on-right' : 'on-left'}`} style={{ top: tip.top + 'px', left: tip.arrowLeft + 'px', transform: 'translateY(-50%) rotate(45deg)' }} />
        </>
      )}
    </>
  );
}
