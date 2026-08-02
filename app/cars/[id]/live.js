'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../../lib/supabase-client';

export default function CarLive({ carId, initialStages, initialUpdates }) {
  const [stages, setStages] = useState(initialStages);
  const [updates, setUpdates] = useState(initialUpdates);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`car-${carId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'car_stages', filter: `car_id=eq.${carId}` }, (payload) => {
        setStages((prev) => {
          const next = prev.map((s) => (s.id === payload.new?.id ? payload.new : s));
          return next.sort((a, b) => a.step_number - b.step_number);
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'car_updates', filter: `car_id=eq.${carId}` }, (payload) => {
        setUpdates((prev) => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carId]);

  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>סטטוס הרכב</h3>
        <ul className="ladder">
          {stages.map((s) => (
            <li key={s.id} className={s.status}>
              <div className="dot">{s.status === 'done' ? '✓' : s.step_number}</div>
              <div className="stage-body">
                <div className="stage-title">{s.title}</div>
                {s.completed_at && (
                  <div className="stage-date">
                    הושלם ב-{new Date(s.completed_at).toLocaleDateString('he-IL')}
                  </div>
                )}
                {s.description && <div className="muted" style={{ marginTop: 2 }}>{s.description}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>עדכונים</h3>
        {!updates.length && <div className="empty">אין עדכונים עדיין</div>}
        <ul className="timeline">
          {updates.map((u) => (
            <li key={u.id}>
              <div className="t-date">{new Date(u.created_at).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' })}</div>
              <div>{u.body}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
