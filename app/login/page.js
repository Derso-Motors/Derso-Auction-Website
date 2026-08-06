'use client';

import { useState, useEffect } from 'react';
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
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [agree, setAgree] = useState(false);

  // Prefill a remembered email
  useEffect(() => {
    try {
      const saved = localStorage.getItem('derso_saved_email');
      if (saved) { setEmail(saved); setRemember(true); }
    } catch {}
  }, []);

  // Surface messages passed in the URL (e.g. from the OAuth callback or logout)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('err');
      const ok = params.get('ok');
      if (err) setError(err);
      if (ok) setInfo(ok);
      if (err || ok) window.history.replaceState({}, '', window.location.pathname);
    } catch {}
  }, []);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function signInWithGoogle() {
    setError(''); setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError('שגיאה בהתחברות עם Google');
      setGoogleLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) { setError('לא הצלחנו לשלוח את המייל. בדוק את הכתובת ונסה שוב.'); return; }
        setInfo('נשלח אליך מייל עם קישור לאיפוס הסיסמה. בדוק גם בספאם.');
        setMode('login');
        return;
      }
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError('פרטי התחברות שגויים'); return; }
        try {
          if (remember) localStorage.setItem('derso_saved_email', email);
          else localStorage.removeItem('derso_saved_email');
        } catch {}
        router.push('/');
        router.refresh();
      } else {
        if (password.length < 8) { setError('סיסמה חייבת להכיל לפחות 8 תווים'); return; }
        if (!agree) { setError('כדי להירשם יש לאשר את תנאי השימוש, מדיניות הפרטיות והסרת האחריות'); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, phone, accepted_terms: true, accepted_terms_at: new Date().toISOString() } },
        });
        if (error) { setError('שגיאה בהרשמה. נסה שוב מאוחר יותר.'); return; }
        // WhatsApp welcome + verification note (best effort, non-blocking)
        if (phone) {
          fetch('/api/auth/welcome', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, name: fullName }),
          }).catch(() => {});
        }
        setInfo('נרשמת בהצלחה! נשלח אליך מייל אימות — ואחרי ההתחברות הראשונה נאמת גם את הטלפון בוואטסאפ 📱');
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-wrap">
        {/* Hero Section */}
        <div className="login-hero">
          <div className="login-hero-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            חיבור מאובטח בלבד
          </div>
          <h1 className="login-hero-title">
            דרסו — בית ליווי מקצועי למכרזים
            <span>מערכת ניהול וליווי רכישת רכבים</span>
          </h1>
          <p className="login-hero-desc">
            פלטפורמה מקצועית לליווי לקוחות ברכישת רכבים ממכרזים. המערכת מספקת מעקב בזמן אמת, דוחות מקצועיים ותמיכה אישית לאורך כל התהליך.
          </p>
          <div className="login-hero-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
            אישור ידני לכל משתמש
          </div>
        </div>

        {/* Login Card */}
        <div className="login-box">
          <div className="login-box-header">
            <div className="login-box-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            </div>
            <h2>{mode === 'login' ? 'כניסה למערכת' : mode === 'forgot' ? 'איפוס סיסמה' : 'הרשמה למערכת'}</h2>
            <p>{mode === 'login' ? 'הזן את פרטיך כדי להתחבר' : mode === 'forgot' ? 'נשלח לך קישור לאיפוס למייל' : 'צור חשבון חדש במערכת'}</p>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {info && <div className="info-msg">{info}</div>}

          <button className="google-btn" onClick={signInWithGoogle} disabled={googleLoading} type="button">
            {googleLoading ? 'רגע...' : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                התחברות עם Google
              </>
            )}
          </button>
          <div className="or-divider">או</div>

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="field">
                  <label>שם מלא</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="ישראל ישראלי" />
                </div>
                <div className="field">
                  <label>טלפון</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="050-1234567" />
                </div>
              </>
            )}
            <div className="field">
              <label>אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" placeholder="your@email.com" />
            </div>
            {mode !== 'forgot' && (
              <div className="field">
                <label>סיסמה</label>
                <div className="pass-wrap">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" minLength={mode === 'signup' ? 8 : undefined} placeholder="••••••••" />
                  <button type="button" className="pass-eye" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'הסתרת סיסמה' : 'הצגת סיסמה'} title={showPass ? 'הסתרת סיסמה' : 'הצגת סיסמה'}>
                    {showPass ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            {mode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -6, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 'auto' }} />
                  זכור אותי
                </label>
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--muted-dim)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', padding: 0 }} onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}>שכחת סיסמה?</button>
              </div>
            )}
            {mode === 'signup' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', margin: '2px 0 8px', lineHeight: 1.5 }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required style={{ width: 'auto', marginTop: 3 }} />
                <span>
                  קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" style={{ color: 'var(--accent)' }}>תנאי השימוש</a>, ל<a href="/privacy" target="_blank" style={{ color: 'var(--accent)' }}>מדיניות הפרטיות</a> ול<a href="/disclaimer" target="_blank" style={{ color: 'var(--accent)' }}>הסרת האחריות</a>,
                  ובכלל זה: זכות הפדיון של החייב וסעד בלעדי של השבת דמי השירות בביטול עסקה, מכר רכבים במצבם (AS-IS) ותקרת האחריות.
                </span>
              </label>
            )}
            <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={loading}>
              {loading ? 'רגע...' : mode === 'login' ? 'התחברות' : mode === 'forgot' ? 'שליחת קישור לאיפוס' : 'הרשמה'}
            </button>
          </form>
          <div className="divider" />
          <div style={{ textAlign: 'center', fontSize: 13.5 }}>
            {mode === 'forgot' ? (
              <span><button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }} onClick={() => { setMode('login'); setError(''); }}>← חזרה להתחברות</button></span>
            ) : mode === 'login' ? (
              <span>אין לך חשבון? <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }} onClick={() => { setMode('signup'); setError(''); }}>הרשמה</button></span>
            ) : (
              <span>יש לך חשבון? <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }} onClick={() => { setMode('login'); setError(''); }}>התחברות</button></span>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="login-footer">
        <div className="login-footer-links">
          <a href="/terms">תנאי שימוש</a>
          <a href="/privacy">מדיניות פרטיות</a>
          <a href="/disclaimer">הסרת אחריות</a>
        </div>
        <p>כל הזכויות שמורות לדרסו — בית ליווי מקצועי למכרזים © {new Date().getFullYear()}. המידע מסווג ומוגן.</p>
      </footer>
    </div>
  );
}
