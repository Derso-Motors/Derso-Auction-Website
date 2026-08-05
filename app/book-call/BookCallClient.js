'use client';

import { useMemo, useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function ilParts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { label: DAY_NAMES[dow], date: `${d}.${m}` };
}

export default function BookCallClient({ days, slotTimes, busy, myBooking, bookAction, cancelAction }) {
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Busy timestamps -> set of "date|HH:MM" in Israel time
  const busySet = useMemo(() => {
    const s = new Set();
    for (const iso of busy) {
      const d = new Date(iso);
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
      const time = d.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
      s.add(`${date}|${time}`);
    }
    return s;
  }, [busy]);

  const nowIl = useMemo(() => {
    const now = new Date();
    return {
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now),
      time: now.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  }, []);

  function slotState(day, time) {
    if (busySet.has(`${day}|${time}`)) return 'busy';
    if (day === nowIl.date && time <= nowIl.time) return 'past';
    return 'free';
  }

  function submitBooking() {
    setSubmitting(true);
    document.getElementById('book-call-form')?.requestSubmit();
  }

  if (myBooking) {
    const when = new Date(myBooking.starts_at).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return (
      <div>
        <h1 className="page-title">שיחת אפיון 📞</h1>
        <div className="card" style={{ maxWidth: 480, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <h3 style={{ margin: '0 0 6px' }}>קבועה לך שיחת אפיון</h3>
          <p className="muted" style={{ margin: '0 0 4px' }}>{when}</p>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 18px' }}>
            {myBooking.status === 'confirmed' ? 'אישרת הגעה ✓' : 'נשלח לך אישור בוואטסאפ יום לפני השיחה'}
          </p>
          <button className="btn danger-outline" type="button" onClick={() => setCancelOpen(true)}>ביטול השיחה</button>
        </div>
        {cancelOpen && (
          <ConfirmDialog
            icon="❌"
            title="לבטל את שיחת האפיון?"
            sub="המועד יתפנה ללקוחות אחרים"
            confirmLabel="כן, ביטול"
            onConfirm={() => { setCancelOpen(false); document.getElementById('cancel-call-form')?.requestSubmit(); }}
            onClose={() => setCancelOpen(false)}
          />
        )}
        <form id="cancel-call-form" action={cancelAction} style={{ display: 'none' }}>
          <input type="hidden" name="id" value={myBooking.id} />
        </form>
      </div>
    );
  }

  const dayInfo = ilParts(selectedDay);

  return (
    <div>
      <h1 className="page-title">קביעת שיחת אפיון 📞</h1>
      <p className="page-sub">בחר יום ושעה שנוחים לך — נציג שלנו יתקשר אליך לשיחה של כ-15 דקות</p>

      <div className="book-days">
        {days.map((d) => {
          const p = ilParts(d);
          return (
            <button
              key={d} type="button"
              className={`book-day ${selectedDay === d ? 'active' : ''}`}
              onClick={() => { setSelectedDay(d); setSelectedTime(null); }}
            >
              <span className="book-day-name">{p.label}</span>
              <span className="book-day-date">{p.date}</span>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 640 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>שעות פנויות ליום {dayInfo.label} {dayInfo.date}</h3>
        <div className="book-slots">
          {slotTimes.map((t) => {
            const state = slotState(selectedDay, t);
            return (
              <button
                key={t} type="button" dir="ltr"
                className={`book-slot ${state} ${selectedTime === t ? 'selected' : ''}`}
                disabled={state !== 'free'}
                onClick={() => setSelectedTime(t)}
              >
                {t}
              </button>
            );
          })}
        </div>
        {slotTimes.every((t) => slotState(selectedDay, t) !== 'free') && (
          <div className="empty" style={{ padding: 16 }}>אין שעות פנויות ביום הזה — נסה יום אחר</div>
        )}
        <button
          className="btn" style={{ width: '100%', marginTop: 16 }}
          disabled={!selectedTime || submitting}
          type="button" onClick={() => setConfirmOpen(true)}
        >
          {submitting ? 'קובע...' : selectedTime ? `קביעת שיחה ליום ${dayInfo.label} בשעה ${selectedTime}` : 'בחר שעה כדי להמשיך'}
        </button>
      </div>

      {confirmOpen && selectedTime && (
        <ConfirmDialog
          icon="📞"
          title={`לקבוע שיחת אפיון ליום ${dayInfo.label} ${dayInfo.date} בשעה ${selectedTime}?`}
          sub="נשלח לך אישור ותזכורות בוואטסאפ"
          confirmLabel="כן, קביעה"
          danger={false}
          onConfirm={() => { setConfirmOpen(false); submitBooking(); }}
          onClose={() => setConfirmOpen(false)}
        />
      )}

      <form id="book-call-form" action={bookAction} style={{ display: 'none' }}>
        <input type="hidden" name="date" value={selectedDay} />
        <input type="hidden" name="time" value={selectedTime || ''} />
      </form>
    </div>
  );
}
