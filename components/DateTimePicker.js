'use client';

import { useState, useRef, useEffect } from 'react';

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function pad(n) { return String(n).padStart(2, '0'); }

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function DateTimePicker({ name, required, includeTime = false, defaultValue, bookedSlots = [] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('date');
  const ref = useRef(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // bookedSlots are ISO strings from DB (UTC). Convert to local time for comparison.
  const bookedSet = new Set(
    bookedSlots.map((iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    })
  );

  const bookedByDate = {};
  bookedSlots.forEach((iso) => {
    const d = new Date(iso);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    bookedByDate[key] = (bookedByDate[key] || 0) + 1;
  });

  useEffect(() => {
    if (defaultValue) {
      const d = new Date(defaultValue);
      if (!isNaN(d)) {
        setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        if (includeTime) {
          setSelectedHour(d.getHours());
          setSelectedMinute(d.getMinutes());
        }
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  function pickDate(day) {
    const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    if (ds < todayStr) return;
    setSelectedDate(ds);
    if (includeTime) {
      setStep('time');
    } else {
      setOpen(false);
    }
  }

  function pickTime(h, m) {
    setSelectedHour(h);
    setSelectedMinute(m);
    setOpen(false);
    setStep('date');
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfWeek(viewYear, viewMonth);

  // Build hidden value as full ISO string (UTC) so the server gets correct time
  let hiddenValue = '';
  if (selectedDate) {
    if (includeTime && selectedHour != null && selectedMinute != null) {
      // Create Date in browser local timezone, then convert to ISO (UTC)
      const localDate = new Date(`${selectedDate}T${pad(selectedHour)}:${pad(selectedMinute)}:00`);
      hiddenValue = localDate.toISOString();
    } else if (!includeTime) {
      hiddenValue = selectedDate;
    }
  }

  let displayText = '';
  if (selectedDate) {
    const [y, m, d] = selectedDate.split('-');
    displayText = `${d}.${m}.${y}`;
    if (includeTime && selectedHour != null && selectedMinute != null) {
      displayText += ` ${pad(selectedHour)}:${pad(selectedMinute)}`;
    }
  }

  // Business hours: Sun-Thu until 17:00 (last slot 16:45); Friday phone-calls only 10:00-14:00.
  const selDow = selectedDate ? new Date(`${selectedDate}T12:00:00`).getDay() : null;
  const isFriday = selDow === 5;
  const startHour = isFriday ? 10 : 7;
  const endHour = isFriday ? 14 : 17; // exclusive — last slot 13:45 / 16:45
  const hours = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 15) {
      hours.push({ h, m, label: `${pad(h)}:${pad(m)}` });
    }
  }

  function isBooked(h, m) {
    if (!selectedDate) return false;
    return bookedSet.has(`${selectedDate}T${pad(h)}:${pad(m)}`);
  }

  function isPastTime(h, m) {
    if (!selectedDate || selectedDate !== todayStr) return false;
    const now = new Date();
    return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
  }

  function isCallHour(h) {
    return h >= 12 && h < 16;
  }

  // Lunch break: Sun-Thu 14:15–14:59 (slots 14:15, 14:30, 14:45)
  function isLunchBreak(h, m) {
    if (isFriday) return false; // Friday ends at 14:00 anyway
    const t = h * 60 + m;
    return t >= 14 * 60 + 15 && t < 15 * 60;
  }

  return (
    <div className="dtp-wrap" ref={ref}>
      <input type="hidden" name={name} value={hiddenValue} required={required} />
      <button
        type="button"
        className="dtp-trigger"
        onClick={() => { setOpen(!open); setStep('date'); }}
      >
        {displayText || (includeTime ? 'בחר תאריך ושעה' : 'בחר תאריך')}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>

      {open && step === 'date' && (
        <div className="dtp-popup">
          <div className="dtp-header">
            <button type="button" className="dtp-nav" onClick={nextMonth}>›</button>
            <span className="dtp-title">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button type="button" className="dtp-nav" onClick={prevMonth}>‹</button>
          </div>
          <div className="dtp-days-header">
            {DAY_NAMES.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="dtp-grid">
            {Array.from({ length: startDay }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => {
              const day = i + 1;
              const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const isPast = ds < todayStr;
              const count = bookedByDate[ds] || 0;
              return (
                <button
                  key={day} type="button"
                  disabled={isPast}
                  className={`dtp-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''}`}
                  onClick={() => !isPast && pickDate(day)}
                >
                  {day}
                  {count > 0 && !isPast && <span className="dtp-day-dot" title={`${count} פגישות`} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && step === 'time' && (
        <div className="dtp-popup dtp-time-popup">
          <div className="dtp-header">
            <button type="button" className="dtp-nav" onClick={() => setStep('date')}>←</button>
            <span className="dtp-title">בחר שעה</span>
            <span />
          </div>
          {isFriday && (
            <div style={{ textAlign: 'center', padding: '0 12px 6px', fontSize: 11, color: '#63b3ed' }}>
              יום שישי — שיחות טלפון בלבד, 10:00–14:00 📞
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '0 12px 8px', fontSize: 11, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(99,179,237,0.13)', border: '1px solid rgba(99,179,237,0.3)', display: 'inline-block' }} />
              שעות שיחות
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,100,100,0.15)', border: '1px solid rgba(255,100,100,0.3)', display: 'inline-block' }} />
              תפוס
            </span>
            {!isFriday && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,180,50,0.15)', border: '1px solid rgba(255,180,50,0.3)', display: 'inline-block' }} />
                הפסקת צהריים
              </span>
            )}
          </div>
          <div className="dtp-time-grid">
            {hours.map(({ h, m, label }) => {
              const booked = isBooked(h, m);
              const past = isPastTime(h, m);
              const lunch = isLunchBreak(h, m);
              const disabled = booked || past || lunch;
              const call = isCallHour(h);
              return (
                <button
                  key={label} type="button" dir="ltr"
                  disabled={disabled}
                  className={[
                    'dtp-time',
                    selectedHour === h && selectedMinute === m ? 'selected' : '',
                    booked ? 'booked' : '',
                    past && !booked ? 'past' : '',
                    lunch && !booked ? 'lunch' : '',
                    call && !disabled ? 'call-hour' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => !disabled && pickTime(h, m)}
                  title={booked ? 'השעה תפוסה' : lunch ? 'הפסקת צהריים 🍽️' : past ? 'עבר' : call ? 'שעות שיחות אפיון' : ''}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        .dtp-time.booked {
          opacity: 0.35;
          text-decoration: line-through;
          cursor: not-allowed;
          background: rgba(255,100,100,0.10) !important;
          border-color: rgba(255,100,100,0.25) !important;
          color: var(--muted-dim) !important;
        }
        .dtp-time.booked:hover {
          background: rgba(255,100,100,0.10) !important;
          transform: none !important;
        }
        .dtp-time.past {
          opacity: 0.25;
          cursor: not-allowed;
        }
        .dtp-time.past:hover {
          transform: none !important;
        }
        .dtp-time.lunch {
          opacity: 0.35;
          cursor: not-allowed;
          background: rgba(255,180,50,0.10) !important;
          border-color: rgba(255,180,50,0.25) !important;
          color: var(--muted-dim) !important;
        }
        .dtp-time.lunch:hover {
          background: rgba(255,180,50,0.10) !important;
          transform: none !important;
        }
        .dtp-time.call-hour {
          background: rgba(99,179,237,0.10);
          border-color: rgba(99,179,237,0.25);
        }
        .dtp-time.call-hour:hover {
          background: rgba(99,179,237,0.22);
          border-color: rgba(99,179,237,0.4);
        }
        .dtp-day-dot {
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--primary);
        }
        .dtp-day {
          position: relative;
        }
        .dtp-day.past {
          opacity: 0.25;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
