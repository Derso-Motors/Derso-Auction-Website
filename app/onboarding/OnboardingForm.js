'use client';

import { useState } from 'react';

// Final onboarding step: BidSpirit + address + ID.
// Runs after phone verification; required before using the account.
export default function OnboardingForm({ action, fullName, existing, err }) {
  const [busy, setBusy] = useState(false);

  // Pre-fill the name only if it already looks like a real Hebrew name — never
  // the Google display name (e.g. "Nati Investments"), which must be replaced.
  const heName = /[֐-׿]/.test(fullName || '') && !/[A-Za-z]/.test(fullName || '');
  const parts = (fullName || '').trim().split(/\s+/);
  const defFirst = heName ? (parts[0] || '') : '';
  const defLast = heName ? parts.slice(1).join(' ') : '';

  return (
    <div className="login-page">
      <main className="login-wrap" style={{ justifyContent: 'center' }}>
        <div className="login-box" style={{ maxWidth: 460 }}>
          <div className="login-box-header">
            <div className="verify-icon">📋</div>
            <h2>עוד צעד אחד וסיימנו 🙌</h2>
            <p>הפרטים ישמשו אותך לרכישות ותשלומים באתר</p>
          </div>

          {err && <div className="error-msg">{err}</div>}

          <form action={action} onSubmit={() => setBusy(true)}>
            <div className="onboard-section">👤 השם שלך (בעברית)</div>
            <div className="onboard-row">
              <div className="field">
                <label>שם פרטי</label>
                <input name="first_name" defaultValue={defFirst} required placeholder="ישראל" />
              </div>
              <div className="field">
                <label>שם משפחה</label>
                <input name="last_name" defaultValue={defLast} required placeholder="ישראלי" />
              </div>
            </div>

            <div className="onboard-section">📧 פרטי התקשרות</div>
            <div className="field">
              <label>אימייל</label>
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

            <div className="onboard-section">🪪 זיהוי</div>
            <div className="field">
              <label>תעודת זהות</label>
              <input name="national_id" defaultValue={existing.national_id || ''} required dir="ltr" inputMode="numeric" maxLength={9} placeholder="123456789" style={{ textAlign: 'left', letterSpacing: '1px' }} />
            </div>

            <button className="btn" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'שומר...' : 'שמירה וסיום ההרשמה ✓'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
