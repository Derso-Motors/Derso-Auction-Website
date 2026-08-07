'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SEEN_KEY = 'derso_call_popup_seen';
const TOUR_KEY = 'derso_tour_seen';

// One-time popup for new clients: why an intake call matters, with a direct
// path to booking one. Shown once (localStorage) and only while the client
// has no upcoming call booked. Waits until the first-run guided tour has been
// seen/skipped, so the two never appear at the same time.
export default function WelcomeCallPopup({ hasBooking }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasBooking) return;
    try {
      if (!localStorage.getItem(TOUR_KEY)) return;
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {}
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [hasBooking]);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={dismiss}>
      <div className="confirm-box" style={{ maxWidth: 420, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon" style={{ textAlign: 'center' }}>🚗</div>
        <div className="confirm-title" style={{ textAlign: 'center', fontSize: 19 }}>מחפש לקנות רכב חדש?</div>
        <div className="confirm-sub" style={{ fontSize: 13.5, lineHeight: 1.7, textAlign: 'right' }}>
          כדי שנוכל לעזור לך ולהראות לך ממבחר מאות הרכבים שלנו, כדאי לקבוע
          שיחת אפיון קצרה — <b>בלי שום חיוב</b>.
          <br />
          בשיחה נבין בדיוק מה אתה מחפש, כדי שנוכל למצוא לך רכב מתאים ולהתקדם.
        </div>
        <div className="confirm-actions">
          <button className="btn" type="button" onClick={() => { dismiss(); router.push('/book-call'); }}>
            לקביעת שיחת אפיון
          </button>
          <button className="btn secondary" type="button" onClick={dismiss}>
            אולי אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
