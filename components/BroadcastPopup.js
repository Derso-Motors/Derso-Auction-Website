'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const SEEN_KEY = 'derso_broadcast_popup_seen';

export default function BroadcastPopup({ show, hasSub }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSub) return;
    try { if (localStorage.getItem(SEEN_KEY)) return; } catch {}
    if (show) {
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [show, hasSub]);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={dismiss}>
      <div className="confirm-box" style={{ maxWidth: 440, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">📣</div>
        <div className="confirm-title" style={{ fontSize: 20 }}>ברוכים הבאים לדרסו!</div>
        <div className="confirm-sub" style={{ fontSize: 14, lineHeight: 1.7, textAlign: 'center' }}>
          כל בוקר אנחנו שולחים את הרכבים הכי משתלמים במכרזים — ישירות לוואטסאפ שלכם.
          <br />הצטרפו עכשיו ותתחילו לקבל הזדמנויות!
        </div>
        <div style={{ margin: '16px 0' }}>
          <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 22 }}>₪30</span>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>/חודש </span>
          <span style={{ color: 'var(--muted-dim)', fontSize: 13, textDecoration: 'line-through' }}>₪50</span>
        </div>
        <div style={{ color: 'var(--muted-dim)', fontSize: 13, marginBottom: 20 }}>
          🎁 30 ימי ניסיון חינם · ביטול בכל עת
        </div>
        <div className="confirm-actions">
          <button className="btn" type="button" onClick={() => { dismiss(); router.push('/subscriptions'); }}>
            התחילו 30 ימי ניסיון חינם →
          </button>
          <button className="btn secondary" type="button" onClick={dismiss}>
            אולי אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
