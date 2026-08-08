'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase-client';

function fmt(n) { return n != null ? Number(n).toLocaleString('he-IL') : null; }

export default function RecommendedClient({ initialCars }) {
  const [cars, setCars] = useState(initialCars);
  const [toast, setToast] = useState(null);
  const [busyCar, setBusyCar] = useState(null);

  function showToast(msg, isErr) {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 4000);
  }

  async function mark(car, interest) {
    const prevInterest = car.client_interest;
    const next = prevInterest === interest ? null : interest;
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, client_interest: next } : c)));
    const supabase = createClient();
    const { error } = await supabase.from('recommended_cars').update({ client_interest: next }).eq('id', car.id);
    if (error) {
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, client_interest: prevInterest } : c)));
      showToast('שמירת הסימון נכשלה — נסה שוב', true);
      return;
    }
    if (next === 'interested') showToast('סומן כמעניין ✓');
    else if (next === 'not_interested') showToast('סומן כלא רלוונטי ✓');
    else showToast('הסימון הוסר ✓');
  }

  async function requestAuction(car) {
    if (!window.confirm(`רוצה שנקבע בשבילך מכרז על "${car.title}"?\nזה יתווסף לפגישות שלך וליומן שלנו, ונעדכן בוואטסאפ.`)) return;
    setBusyCar(car.id);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('request_auction_meeting', { p_car_id: car.id });
    setBusyCar(null);
    if (error || !data?.ok) {
      if (data?.error === 'already_requested') {
        showToast('כבר ביקשת מכרז על הרכב הזה — הוא בפגישות שלך.', false);
      } else {
        showToast('לא הצלחנו לקבוע כרגע. נסה שוב או פנה אלינו בצ\'אט.', true);
      }
      return;
    }
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, client_interest: 'interested' } : c)));
    showToast(data.scheduled
      ? '🎉 המכרז נוסף לפגישות שלך וליומן שלנו — שלחנו אישור בוואטסאפ!'
      : '🎉 הבקשה נרשמה ביומן שלנו — נחזור אליך לתיאום, שלחנו אישור בוואטסאפ!');
  }

  if (!cars.length) {
    return <div className="empty" style={{ padding: 40 }}>עוד אין רכבים בהמלצה — ברגע שנמצא רכב שמתאים לך הוא יופיע כאן</div>;
  }

  return (
    <>
      {toast && <div className={`inv-toast${toast.isErr ? ' toast-err' : ''}`}>{toast.msg}</div>}
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
              {car.client_interest !== 'interested' ? (
                <button
                  className="btn success"
                  type="button"
                  disabled={busyCar === car.id}
                  onClick={() => requestAuction(car)}>
                  {busyCar === car.id ? '⏳ שולח...' : '📅 מעניין — קבעו מכרז'}
                </button>
              ) : (
                <button className="btn success" type="button" disabled>
                  ✓ מעניין אותי — מכרז ביומן
                </button>
              )}
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
    </>
  );
}
