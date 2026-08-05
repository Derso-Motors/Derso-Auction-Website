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

export default function DateTimePicker({ name, required, includeTime = false, defaultValue }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('date');
  const ref = useRef(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);

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
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  let hiddenValue = '';
  if (selectedDate) {
    if (includeTime && selectedHour != null && selectedMinute != null) {
      hiddenValue = `${selectedDate}T${pad(selectedHour)}:${pad(selectedMinute)}`;
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

  const hours = [];
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      hours.push({ h, m, label: `${pad(h)}:${pad(m)}` });
    }
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
              return (
                <button
                  key={day} type="button"
                  className={`dtp-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => pickDate(day)}
                >
                  {day}
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
          <div className="dtp-time-grid">
            {hours.map(({ h, m, label }) => (
              <button
                key={label} type="button" dir="ltr"
                className={`dtp-time ${selectedHour === h && selectedMinute === m ? 'selected' : ''}`}
                onClick={() => pickTime(h, m)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
