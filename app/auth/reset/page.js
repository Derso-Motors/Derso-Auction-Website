'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase-client';

// Landing page for the password-reset email link (Supabase signs the user in
// with a recovery session; here they choose a new password).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('הסיסמה חייבת להכיל לפחות 8 תווים'); return; }
    if (password !== confirm) { setError('הסיסמאות לא תואמות'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError('הקישור פג תוקף או שאינו תקין — בקש קישור איפוס חדש מדף ההתחברות.'); return; }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="login-page">
      <main className="login-wrap" style={{ justifyContent: 'center' }}>
        <div className="login-box">
          <div className="login-box-header">
            <h2>בחירת סיסמה חדשה 🔑</h2>
            <p>דרסו — בית ליווי מקצועי למכרזים</p>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label>סיסמה חדשה</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" minLength={8} placeholder="••••••••" />
            </div>
            <div className="field">
              <label>אימות סיסמה</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required dir="ltr" placeholder="••••••••" />
            </div>
            <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
              {loading ? 'רגע...' : 'עדכון סיסמה וכניסה'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
