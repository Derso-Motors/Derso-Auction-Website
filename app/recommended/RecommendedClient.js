'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase-client';

function fmt(n) { return n != null ? Number(n).toLocaleString('he-IL') : null; }

const INSPECTION_OPTIONS = [
  { scope: 'full',   icon: '🛡️', title: 'בדיקה מלאה + טופס סליקה', sub: 'הכי מומלץ — דוח בדיקה מקיף וגם טופס סליקה משפטי', claim: true, featured: true },
  { scope: 'report', icon: '📋', title: 'רק דוח בדיקה', sub: 'דוח בדיקה מלא לרכב לפני המכרז', claim: true },
  { scope: 'form',   icon: '📄', title: 'רק טופס סליקה', sub: 'טופס סליקה משפטי בלבד', claim: true },
  { scope: 'none',   icon: '🚫', title: 'לא מעוניין בבדיקות', sub: 'קביעת מכרז בלי בדיקה מקדימה', claim: false },
];

export default function RecommendedClient({ initialCars, inspectionBalance = 0 }) {
  const [cars, setCars] = useState(initialCars);
  const [toast, setToast] = useState(null);
  const [busyCar, setBusyCar] = useState(null);
  const [modalCar, setModalCar] = useState(null);
  const [step, setStep] = useState('price'); // 'price' | 'inspect'
  const [maxBid, setMaxBid] = useState('');
  const [balance, setBalance] = useState(inspectionBalance);
  const [noBalance, setNoBalance] = useState(false);
  const [working, setWorking] = useState(false);

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

  async function bookAuction(car) {
    const supabase = createClient();
    const bid = Number(String(maxBid).replace(/[^\d]/g, '')) || null;
    const { data, error } = await supabase.rpc('request_auction_meeting', { p_car_id: car.id, p_max_bid: bid });
    if (error || !data?.ok) {
      if (data?.error === 'already_requested') {
        showToast('כבר ביקשת מכרז על הרכב הזה — הוא בפגישות שלך.', false);
      } else {
        showToast('לא הצלחנו לקבוע כרגע. נסה שוב או פנה אלינו בצ׳אט.', true);
      }
      return false;
    }
    setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, client_interest: 'interested' } : c)));
    return data;
  }

  async function chooseOption(opt) {
    if (working || !modalCar) return;
    setWorking(true);
    const car = modalCar;
    const supabase = createClient();

    if (opt.claim) {
      const { data, error } = await supabase.rpc('claim_inspection', { p_car_id: car.id, p_scope: opt.scope });
      if (error || !data?.ok) {
        setWorking(false);
        if (data?.error === 'no_balance') {
          setNoBalance(true);
          return;
        }
        showToast('משהו השתבש — נסה שוב', true);
        return;
      }
      setBalance(data.remaining ?? Math.max(0, balance - 1));
    }

    setBusyCar(car.id);
    const booked = await bookAuction(car);
    setBusyCar(null);
    setWorking(false);
    setModalCar(null);
    setNoBalance(false);
    if (booked) {
      showToast(opt.claim
        ? `🎉 המכרז נקבע והבדיקה שוריינה! (${opt.title}) — שלחנו אישור בוואטסאפ`
        : (booked.scheduled
          ? '🎉 המכרז נוסף לפגישות שלך וליומן שלנו — שלחנו אישור בוואטסאפ!'
          : '🎉 הבקשה נרשמה ביומן שלנו — נחזור אליך לתיאום, שלחנו אישור בוואטסאפ!'));
    }
  }

  if (!cars.length) {
    return <div className="empty" style={{ padding: 40 }}>עוד אין רכבים בהמלצה — ברגע שנמצא רכב שמתאים לך הוא יופיע כאן</div>;
  }

  return (
    <>
      {toast && <div className={`inv-toast${toast.isErr ? ' toast-err' : ''}`}>{toast.msg}</div>}

      {modalCar && (
        <div className="insp-overlay" onClick={() => !working && (setModalCar(null), setNoBalance(false))}>
          <div className="insp-box" onClick={(e) => e.stopPropagation()}>
            {!noBalance && step === 'price' ? (
              <>
                <div className="insp-title">🚗 קובעים מכרז על</div>
                <div className="insp-car">{modalCar.title}</div>
                <div className="insp-sub">
                  💰 <b style={{ color: 'var(--text)' }}>מה המחיר המקסימלי שאתה מוכן להגיש על הרכב הזה?</b>
                  {modalCar.est_price != null && <> (מחיר מוערך: ₪{Number(modalCar.est_price).toLocaleString()})</>}
                </div>
                <input
                  className="insp-bid"
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="למשל: 90,000"
                  value={maxBid}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setMaxBid(digits ? Number(digits).toLocaleString() : '');
                  }}
                />
                <button type="button" className="insp-next" disabled={!maxBid} onClick={() => setStep('inspect')}>
                  המשך ←
                </button>
              </>
            ) : !noBalance ? (
              <>
                <div className="insp-title">🛡️ רגע לפני שסוגרים — בדיקה?</div>
                <div className="insp-car">{modalCar.title}</div>
                <div className="insp-sub">
                  רכב מכרז בלי בדיקה = הימור. 9 מתוך 10 לקוחות שלנו בודקים לפני.
                  {balance > 0 && <b> נשארו לך {balance} בדיקות בחבילה 🎁</b>}
                </div>
                <div className="insp-options">
                  {INSPECTION_OPTIONS.map((opt) => (
                    <button key={opt.scope} type="button" disabled={working}
                      className={`insp-opt ${opt.featured ? 'featured' : ''} ${opt.scope === 'none' ? 'plain' : ''}`}
                      onClick={() => chooseOption(opt)}>
                      <span className="insp-opt-icon">{opt.icon}</span>
                      <span className="insp-opt-text">
                        <b>{opt.title}</b>
                        <small>{opt.sub}</small>
                      </span>
                      {opt.featured && <span className="insp-opt-tag">מומלץ</span>}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="insp-title" style={{ fontSize: 34 }}>😕</div>
                <div className="insp-car">אין לך בדיקות זמינות בחבילה</div>
                <div className="insp-sub">כדי לשריין בדיקה לרכב הזה, רכשו חבילת בדיקות — זה לוקח דקה והבדיקה נשמרת לכם.</div>
                <a href="/pricing" className="btn" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>💲 למחירונים ורכישה →</a>
                <button type="button" className="btn secondary" style={{ width: '100%' }} disabled={working}
                  onClick={() => chooseOption(INSPECTION_OPTIONS[3])}>
                  להמשיך לקביעת מכרז בלי בדיקה
                </button>
              </>
            )}
            <button type="button" className="insp-close" disabled={working} onClick={() => { setModalCar(null); setNoBalance(false); }}>✕</button>
          </div>
        </div>
      )}

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
                  onClick={() => { setModalCar(car); setStep('price'); setMaxBid(''); setNoBalance(false); }}>
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

      <style jsx>{`
        .insp-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center;
          animation: insp-fade 0.25s ease both;
          padding: 16px;
        }
        @keyframes insp-fade { from { opacity: 0; } to { opacity: 1; } }
        .insp-box {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px 24px 22px;
          max-width: 430px; width: 100%;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: insp-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes insp-pop { from { opacity: 0; transform: scale(0.85) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .insp-title { font-size: 15px; color: var(--muted-dim); text-align: center; }
        .insp-car { font-size: 19px; font-weight: 700; text-align: center; margin: 4px 0 8px; color: var(--text); }
        .insp-sub { font-size: 13.5px; color: var(--muted); text-align: center; margin-bottom: 18px; line-height: 1.6; }
        .insp-sub b { color: var(--success); display: block; margin-top: 4px; }
        .insp-options { display: flex; flex-direction: column; gap: 10px; }
        .insp-opt {
          display: flex; align-items: center; gap: 12px;
          background: var(--surface-low);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          cursor: pointer;
          text-align: right;
          font-family: inherit;
          color: var(--text);
          transition: all 0.15s;
          position: relative;
        }
        .insp-opt:hover:not(:disabled) { border-color: var(--accent); background: var(--surface-high); transform: translateY(-1px); }
        .insp-opt:disabled { opacity: 0.6; cursor: wait; }
        .insp-opt.featured { border-color: var(--success); background: var(--success-bg); }
        .insp-opt.featured:hover:not(:disabled) { border-color: var(--success); filter: brightness(1.1); }
        .insp-opt.plain { border-style: dashed; opacity: 0.85; }
        .insp-opt-icon { font-size: 22px; flex-shrink: 0; }
        .insp-opt-text { display: flex; flex-direction: column; gap: 2px; }
        .insp-opt-text b { font-size: 14px; }
        .insp-opt-text small { font-size: 12px; color: var(--muted-dim); }
        .insp-opt-tag {
          position: absolute; top: -8px; left: 12px;
          background: var(--success); color: #fff;
          font-size: 10px; font-weight: 700;
          padding: 2px 10px; border-radius: 999px;
        }
        .insp-close {
          position: absolute; top: 10px; left: 10px;
          background: none; border: none; color: var(--muted-dim);
          font-size: 16px; cursor: pointer; padding: 6px;
        }
        .insp-close:hover { color: var(--text); }
        .insp-bid {
          width: 100%;
          background: var(--surface-low);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          text-align: center;
          margin-bottom: 12px;
          font-family: inherit;
        }
        .insp-bid:focus { outline: none; border-color: var(--accent); }
        .insp-next {
          width: 100%;
          background: var(--accent);
          color: var(--on-primary);
          border: none;
          border-radius: 999px;
          padding: 13px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .insp-next:hover:not(:disabled) { filter: brightness(1.1); }
        .insp-next:disabled { opacity: 0.45; cursor: not-allowed; }
        .insp-skip {
          width: 100%;
          background: none;
          border: none;
          color: var(--muted-dim);
          font-size: 12.5px;
          margin-top: 10px;
          cursor: pointer;
          font-family: inherit;
          text-decoration: underline;
        }
        .insp-skip:hover { color: var(--text); }
      `}</style>
    </>
  );
}
