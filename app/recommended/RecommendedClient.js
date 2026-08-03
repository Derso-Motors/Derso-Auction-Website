'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase-client';

function fmt(n) { return n != null ? Number(n).toLocaleString('he-IL') : null; }

export default function RecommendedClient({ initialCars }) {
  const [cars, setCars] = useState(initialCars);

  async function mark(car, interest) {
    const next = car.client_interest === interest ? null : interest;
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, client_interest: next } : c)));
    const supabase = createClient();
    await supabase.from('recommended_cars').update({ client_interest: next }).eq('id', car.id);
  }

  if (!cars.length) {
    return <div className="empty" style={{ padding: 40 }}>עוד אין רכבים בהמלצה — ברגע שנמצא רכב שמתאים לך הוא יופיע כאן</div>;
  }

  return (
    <div className="inv-grid">
      {cars.map((car) => (
        <div key={car.id} className="inv-card">
          <div className="inv-card-img">
            {car.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={car.image_url} alt={car.title} />
            ) : (
              <div className="inv-card-noimg">🚗</div>
            )}
            {car.client_interest === 'interested' && <span className="rec-badge interested">מעניין אותי ✓</span>}
            {car.client_interest === 'not_interested' && <span className="rec-badge not-interested">לא רלוונטי</span>}
          </div>
          <div className="inv-card-body">
            <div className="inv-card-title">{car.title}</div>
            <div className="inv-card-chips">
              {car.year && <span>{car.year}</span>}
              {car.km != null && <span>{fmt(car.km)} ק"מ</span>}
            </div>
            <div className="inv-card-price">
              {car.list_price != null && <span className="strike">מחירון ₪{fmt(car.list_price)}</span>}
              {car.est_price != null && <b>₪{fmt(car.est_price)}</b>}
            </div>
            {car.notes && <div className="inv-card-notes">{car.notes}</div>}
            {car.auction_link && (
              <a href={car.auction_link} target="_blank" rel="noopener noreferrer" className="rec-link" dir="ltr">
                לצפייה במכרז ↗
              </a>
            )}
            <div className="inv-card-actions">
              <button
                className={`btn ${car.client_interest === 'interested' ? 'success' : 'secondary'}`}
                type="button" onClick={() => mark(car, 'interested')}>
                👍 מעניין אותי
              </button>
              <button
                className={`btn ${car.client_interest === 'not_interested' ? 'danger-outline' : 'secondary'}`}
                type="button" onClick={() => mark(car, 'not_interested')}>
                👎 לא בשבילי
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
