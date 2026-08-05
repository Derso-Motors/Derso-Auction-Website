'use client';
import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

export default function PaymentPopup({ order, onClose }) {
  const [loading, setLoading] = useState(false);

  const [confirmPay, setConfirmPay] = useState(false);

  const handlePayment = () => {
    setConfirmPay(false);
    setLoading(true);
    // Redirect to external payment page
    // TODO: Replace with actual payment provider URL
    window.open(`https://pay.example.com?order=${order.id}&amount=${order.amount}`, '_blank');
    setLoading(false);
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      {confirmPay && (
        <ConfirmDialog
          icon="💳"
          title="להמשיך לעמוד התשלום?"
          sub="תועבר לדף תשלום מאובטח בחלון חדש"
          confirmLabel="כן, לתשלום"
          danger={false}
          onConfirm={handlePayment}
          onClose={() => setConfirmPay(false)}
        />
      )}
      <div className="popup-box" onClick={e => e.stopPropagation()}>
        <div className="popup-header">
          <h3 style={{ margin: 0, fontSize: 16 }}>תשלום עבור דוח</h3>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="popup-body">
          <div className="popup-row">
            <span className="popup-label">סוג דוח:</span>
            <span>{order.report_type}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">רכב:</span>
            <span>{order.license_plate || 'לא צוין'}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">סכום לתשלום:</span>
            <span className="price">₪{Number(order.amount).toLocaleString()}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">סטטוס:</span>
            <span className={`badge ${order.status}`}>
              {order.status === 'awaiting_payment' ? 'ממתין לתשלום' : order.status === 'paid' ? 'שולם' : order.status}
            </span>
          </div>
        </div>
        <div className="popup-actions">
          {order.status === 'awaiting_payment' && (
            <button className="btn" onClick={() => setConfirmPay(true)} disabled={loading}>
              {loading ? 'מעביר...' : 'המשך לתשלום'}
            </button>
          )}
          <button className="btn secondary" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

export function PaymentButton({ order }) {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <>
      <button
        className="btn small"
        onClick={() => setShowPopup(true)}
        style={{ whiteSpace: 'nowrap' }}
      >
        {order.status === 'awaiting_payment' ? 'שלם עכשיו' : 'פרטי תשלום'}
      </button>
      {showPopup && <PaymentPopup order={order} onClose={() => setShowPopup(false)} />}
    </>
  );
}
