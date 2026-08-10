import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { notFound } from 'next/navigation';
import CarLive from './live';

export const dynamic = 'force-dynamic';

import { STAGES } from '../../../lib/stages';

export default async function CarPage({ params }) {
  const { supabase, user } = await requireUser();
  const { data: car } = await supabase
    .from('cars')
    .select('*, car_stages(*), car_updates(*)')
    .eq('id', params.id)
    .single();

  if (!car) notFound();

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin' && car.client_id !== user.id) notFound();

  const stages = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
  const updates = (car.car_updates || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const doneCount = stages.filter(s => s.status === 'done').length;
  const current = stages.find(s => s.status === 'in_progress');
  const progressPct = Math.round((doneCount / 6) * 100);

  return (
    <Shell active="home">
      {/* Header with status badge */}
      <div className="row between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
        <div>
          {car.license_plate && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-highest)', padding: '3px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted)', marginBottom: 8 }}>
              REF: {car.license_plate}
            </div>
          )}
          <div className="page-title">{car.title}</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {car.year ? `שנתון ${car.year}` : ''}{car.km ? ` · ${Number(car.km).toLocaleString()} ק"מ` : ''}
            {car.won_price ? ` · נרכש ב-₪${Number(car.won_price).toLocaleString()}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${doneCount >= 6 ? 'paid' : 'in_progress'}`}>
            {doneCount >= 6 ? 'הושלם' : current ? current.title : STAGES[doneCount] || 'בתהליך'}
          </span>
        </div>
      </div>

      <div className="car-detail-grid">
        {/* Main Content */}
        <div className="car-detail-main">
          {/* Image */}
          {car.image_url && (
            <div className="car-image-wrap">
              <img src={car.image_url} alt={car.title} />
              <div className="car-image-badge">
                {doneCount >= 6 ? 'הושלם' : 'פעיל — בתהליך'}
              </div>
            </div>
          )}

          {/* Specs Table */}
          <div className="card">
            <h3>מפרט טכני</h3>
            <table className="spec-table">
              <tbody>
                {car.year && <tr><td>שנת ייצור</td><td>{car.year}</td></tr>}
                {car.km && <tr><td>קילומטראז׳</td><td>{Number(car.km).toLocaleString()} ק"מ</td></tr>}
                {car.license_plate && <tr><td>לוחית רישוי</td><td>{car.license_plate}</td></tr>}
                {car.won_price && <tr><td>מחיר זכייה</td><td style={{ color: 'var(--primary)' }}>₪{Number(car.won_price).toLocaleString()}</td></tr>}
                {car.color && <tr><td>צבע</td><td>{car.color}</td></tr>}
                {car.engine && <tr><td>מנוע</td><td>{car.engine}</td></tr>}
                {car.transmission && <tr><td>תיבת הילוכים</td><td>{car.transmission}</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Live updates (stages + timeline) */}
          <CarLive carId={car.id} initialStages={stages} initialUpdates={updates} />

          {car.auction_link && (
            <div className="card">
              <a href={car.auction_link} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 14 }}>
                צפייה בעמוד המכרז המקורי
              </a>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="car-detail-side">
          {/* Progress Score */}
          <div className="card">
            <h3>התקדמות תהליך</h3>
            <div className="score-gauge">
              <div className="gauge-num" style={{ color: doneCount >= 6 ? 'var(--success)' : 'var(--primary)' }}>
                {doneCount}/6
              </div>
              <div className="gauge-label">שלבים הושלמו</div>
            </div>
            <div className="score-bar" style={{ marginBottom: 12 }}>
              <div className="score-bar-fill" style={{ width: `${progressPct}%`, background: doneCount >= 6 ? 'var(--success)' : 'var(--primary)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STAGES.map((name, i) => {
                const stage = stages.find(s => s.step_number === i + 1);
                const isDone = stage?.status === 'done';
                const isCurrent = stage?.status === 'in_progress';
                return (
                  <div key={i} className="row" style={{ gap: 8, fontSize: 13, opacity: !isDone && !isCurrent ? 0.5 : 1 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                      background: isDone ? 'var(--success-bg)' : isCurrent ? 'var(--primary-container)' : 'var(--surface-lowest)',
                      border: `2px solid ${isDone ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                      color: isDone ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'var(--muted-dim)',
                    }}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--primary)' : isDone ? 'var(--text)' : 'var(--muted-dim)' }}>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Info */}
          <div className="card">
            <h3>פרטים מהירים</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row between">
                <span className="muted" style={{ fontSize: 12 }}>עדכונים</span>
                <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{updates.length}</span>
              </div>
              {updates[0] && (
                <div className="row between">
                  <span className="muted" style={{ fontSize: 12 }}>עדכון אחרון</span>
                  <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--primary)' }}>
                    {new Date(updates[0].created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              )}
              <div className="row between">
                <span className="muted" style={{ fontSize: 12 }}>סטטוס</span>
                <span className={`badge ${doneCount >= 6 ? 'paid' : 'in_progress'}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                  {doneCount >= 6 ? 'הושלם' : 'בתהליך'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
