'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError('פרטי התחברות שגויים'); return; }
        router.push('/');
        router.refresh();
      } else {
        if (password.length < 8) { setError('סיסמה חייבת להכיל לפחות 8 תווים'); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, phone } },
        });
        if (error) { setError('שגיאה בהרשמה. יתכן שהחשבון כבר קיים.'); return; }
        setInfo('נשלח אליך מייל אימות. יש לאשר אותו ואז להתחבר.');
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="logo">דרסו — ליווי למכרזים</div>
        <div className="logo-sub">אזור לקוחות — חיבור מאובטח בלבד</div>
        {error && <div className="error-msg">{error}</div>}
        {info && <div className="info-msg">{info}</div>}
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <div className="field">
                <label>שם מלא</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="field">
                <label>טלפון</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
              </div>
            </>
          )}
          <div className="field">
            <label>אימייל</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
          </div>
          <div className="field">
            <label>סיסמה</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" minLength={mode === 'signup' ? 8 : undefined} />
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
            {loading ? 'רגע...' : mode === 'login' ? 'התחברות' : 'הרשמה'}
          </button>
        </form>
        <div className="divider" />
        <div style={{ textAlign: 'center', fontSize: 13.5 }}>
          {mode === 'login' ? (
            <span>אין לך חשבון? <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setMode('signup'); setError(''); }}>הרשמה</a></span>
          ) : (
            <span>יש לך חשבון? <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setMode('login'); setError(''); }}>התחברות</a></span>
          )}
        </div>
      </div>
    </div>
  );
}
