'use client';

import { useState, useMemo } from 'react';
import { DeleteButton } from './SubmitButton';
import DateTimePicker from './DateTimePicker';

const TZ = 'Asia/Jerusalem';

// טבלת פגישות עם חיפוש/סינון + גלילה פנימית (לא גוררת את הדף).
export default function MeetingsTable({ meetings = [], deleteAction, rescheduleAction, meetingTypes = [] }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => {
    const norm = (s) => String(s || '').toLowerCase();
    const term = norm(q).trim();
    return (meetings || []).map((m) => {
      const d = new Date(m.scheduled_at);
      return {
        ...m,
        _date: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }),
        _time: d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
        _past: d < new Date(),
        _dtLocal: (() => {
          const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
          const g = (t) => p.find((x) => x.type === t)?.value || '';
          return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
        })(),
        _type: (meetingTypes.find((t) => t.value === m.location) || {}),
      };
    }).filter((m) => {
      if (!term) return true;
      return [m.title, m.name, m.phone, m.location, m._date, m._time].some((f) => norm(f).includes(term));
    });
  }, [meetings, q, meetingTypes]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 חיפוש לפי שם, טלפון, נושא, תאריך…"
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line, rgba(0,0,0,.12))', fontSize: 14, fontFamily: 'inherit' }}
        />
        <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{rows.length} פגישות</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">{q ? 'אין תוצאות לחיפוש' : 'אין פגישות'}</div>
      ) : (
        <div style={{ maxHeight: 460, overflowY: 'auto', borderRadius: 10 }}>
          <table className="data">
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--card, #fff)' }}>
              <tr><th>נושא</th><th>לקוח</th><th>טלפון</th><th>תאריך</th><th>שעה</th><th>סוג</th><th>הערות</th><th>סטטוס</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ opacity: m._past ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 600 }}>{m.title}</td>
                  <td>{m.name || '—'}</td>
                  <td dir="ltr" style={{ fontSize: 12 }}>{m.phone || '—'}</td>
                  <td>{m._date}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--primary)' }}>{m._time}</td>
                  <td>{m._type.emoji ? `${m._type.emoji} ${m._type.value}` : (m.location || '—')}</td>
                  <td className="muted" style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
                  <td><span className={`badge ${m._past ? 'done' : 'in_progress'}`}>{m._past ? 'עבר' : 'מתוכנן'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {rescheduleAction && (
                        <button type="button" className="btn small secondary" title="שינוי מועד"
                          onClick={() => setEditing(editing === m.id ? null : m.id)}>
                          🕐
                        </button>
                      )}
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <DeleteButton title="מחיקה" />
                      </form>
                    </div>
                    {editing === m.id && rescheduleAction && (
                      <form action={rescheduleAction} style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
                        <input type="hidden" name="id" value={m.id} />
                        <DateTimePicker name="when" includeTime required defaultValue={m.scheduled_at} />
                        <button type="submit" className="btn small">שמור</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
