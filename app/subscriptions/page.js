'use client';

import { useState } from 'react';
import Link from 'next/link';

const SUBS = [
  {
    key: 'broadcast',
    icon: '📡',
    title: 'מנוי שידור',
    price: 20,
    period: 'חודש',
    description: 'רכבים שמתאימים בדיוק למה שאתה מחפש — נשלחים אליך אוטומטית לאזור "רכבים בהמלצה" וגם לוואטסאפ. אתה מעדכן את הקריטריונים מתי שתרצה.',
  },
  {
    key: 'ai',
    icon: '🤖',
    title: 'עוזר אישי AI',
    price: 4,
    period: 'חודש',
    description: 'עוזר חכם שעונה לך על שאלות, ממליץ מתוך הרכבים שלך ומלווה אותך לאורך הדרך — ישירות באתר.',
  },
];

export default function SubscriptionsPage() {
  // These are credit-card recurring (הוראת קבע) via Grow.
  // For now, link out to Grow payment pages.
  // TODO: wire up actual Grow recurring payment URLs once configured.

  return (
    <div className="shell-content">
      <div className="page-title">מנויים</div>
      <div className="page-sub">הרשמה למנויים חודשיים — הוראת קבע בכרטיס אשראי</div>

      <div className="grid cols-2">
        {SUBS.map((sub) => (
          <div key={sub.key} className="card">
            <h3>{sub.icon} {sub.title} — ₪{sub.price}/{sub.period}</h3>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{sub.description}</p>
            <button className="btn" style={{ width: '100%' }} disabled>
              בקרוב — הרשמה ב-₪{sub.price}/חודש
            </button>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>חיוב חודשי בכרטיס אשראי (הוראת קבע)</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: 13 }}>ביטול בכל עת · ללא התחייבות · חיוב מתבצע פעם בחודש</p>
        <Link href="/reports" style={{ color: 'var(--accent)', fontSize: 13 }}>← חזרה לדוחות</Link>
      </div>
    </div>
  );
}
