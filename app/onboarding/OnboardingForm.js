'use client';

import { useState } from 'react';

// Final onboarding step: BidSpirit + address + ID + payment card details.
// Runs after phone verification; required before using the account.
export default function OnboardingForm({ action, fullName, existing, err }) {
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState(existing.card_expiry || '');

  function onExpiry(v) {
    let x = v.replace(/[^\d]/g, '').slice(0, 4);
    if (x.length >= 3) x = x.slice(0, 2) + '/' + x.slice(2);
    setExpiry(x);
  }

  return (
    <div className="login-page">
      <main className="login-wrap" style={{ justifyContent: 'center' }}>
        <div className="login-box" style={{ maxWidth: 460 }}>
          <div className="login-box-header">
            <div className="verify-icon">📋</div>
            <h2>עוד צעד אחד, {fullName || 'וסיימנו'} 🙌</h2>
            <p>הפרטים ישמשו אותך לרכישות ותשלומים באתר — לא נחייב אותך כרגע</p>
          </div>

          {err && <div className="error-msg">{err}</div>}

          <form action={action} onSubmit={() => setBusy(true)}>
            <div className="onboard-section">🏷️ חשבון בידספיריט</div>
            <div className="field">
              <label>שם משתמש / אימייל בבידספיריט</label>
              <input name="bidspirit" defaultValue={existing.bidspirit_username || ''} required dir="ltr" placeholder="your@email.com" style={{ textAlign: 'left' }} />
            </div>

            <div className="onboard-section">🏠 כתובת</div>
            <div className="onboard-row">
              <div className="field">
                <label>עיר</label>
                <input name="city" defaultValue={existing.address_city || ''} required placeholder="תל אביב" />
              </div>
              <div className="field">
                <label>רחוב ומספר</label>
                <input name="street" defaultValue={existing.address_street || ''} required placeholder="הרצל 12" />
              </div>
            </div>

            <div className="onboard-section">💳 פרטי תשלום</div>
            <div className="field">
              <label>תעודת זהות</label>
              <input name="national_id" defaultValue={existing.national_id || ''} required dir="ltr" inputMode="numeric" maxLength={9} placeholder="123456789" style={{ textAlign: 'left', letterSpacing: '1px' }} />
            </div>
            <div className="field">
              <label>שם בעל הכרטיס</label>
              <input name="card_holder" defaultValue={existing.card_holder || fullName} required placeholder="ישראל ישראלי" />
            </div>
            <div className="onboard-row">
              <div className="field" style={{ flex: 2 }}>
                <label>מספר כרטיס</label>
                <input name="card_number" required dir="ltr" inputMode="numeric" maxLength={19}
                  placeholder={existing.card_last4 ? `•••• ${existing.card_last4}` : '4580 0000 0000 0000'}
                  style={{ textAlign: 'left', letterSpacing: '1px' }} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>תוקף</label>
                <input name="card_expiry" value={expiry} onChange={(e) => onExpiry(e.target.value)} required dir="ltr" inputMode="numeric" placeholder="08/28" style={{ textAlign: 'left' }} />
              </div>
            </div>
            <p className="muted" style={{ fontSize: 11.5, margin: '0 0 14px', lineHeight: 1.5 }}>
              🔒 מטעמי אבטחה אנחנו שומרים רק את 4 הספרות האחרונות של הכרטיס. לא מתבצע שום חיוב בשלב הזה.
            </p>

            <button className="btn" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'שומר...' : 'שמירה וסיום ההרשמה ✓'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
