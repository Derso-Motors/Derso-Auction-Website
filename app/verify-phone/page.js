'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase-client';

// Phone verification: a WhatsApp code sent from the business number.
export default function VerifyPhonePage() {
  const router = useRouter();
  const [step, setStep] = useState('phone'); // phone | code | done
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxRefs = useRef([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      supabase.from('profiles').select('phone, phone_verified').eq('id', user.id).single().then(({ data }) => {
        if (data?.phone_verified) { setStep('done'); return; }
        if (data?.phone) setPhone(data.phone);
      });
    });
  }, [router]);

  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function api(payload) {
    try {
      const res = await fetch('/api/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      // network drop / offline — never throw, so busy state always resets
      return { ok: false, error: 'שגיאת תקשורת — נסה שוב' };
    }
  }

  async function sendCode(e) {
    e?.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    const j = await api({ action: 'send', phone });
    setBusy(false);
    if (!j.ok) { setError(j.error || 'שליחת הקוד נכשלה'); return; }
    setStep('code');
    setDigits(['', '', '', '', '', '']);
    setCooldown(60);
    setInfo('הקוד נשלח בווצאפ.');
    setTimeout(() => boxRefs.current[0]?.focus(), 50);
  }

  async function checkCode(codeStr) {
    setError(''); setBusy(true);
    const j = await api({ action: 'check', code: codeStr });
    setBusy(false);
    if (!j.ok) { setError(j.error || 'האימות נכשל'); setDigits(['', '', '', '', '', '']); boxRefs.current[0]?.focus(); return; }
    setStep('done');
    setTimeout(() => { router.push('/onboarding'); router.refresh(); }, 1200);
  }

  function setDigit(i, val) {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) boxRefs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === 6) checkCode(code);
  }

  function onKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxRefs.current[i - 1]?.focus();
  }

  function onPaste(e) {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = text.split('').concat(Array(6).fill('')).slice(0, 6);
    setDigits(next);
    if (text.length === 6) checkCode(text);
    else boxRefs.current[text.length]?.focus();
  }

  return (
    <div className="login-page">
      <main className="login-wrap" style={{ justifyContent: 'center' }}>
        <div className="login-box verify-box">
          {step !== 'done' && (
            <div className="login-box-header">
              <div className="verify-icon">📱</div>
              <h2>אימות מספר טלפון</h2>
              <p>דרסו — בית ליווי מקצועי למכרזים</p>
            </div>
          )}
          {error && <div className="error-msg">{error}</div>}
          {info && !error && <div className="info-msg">{info}</div>}

          {step === 'phone' && (
            <form onSubmit={sendCode}>
              <p className="verify-text">נשלח לך קוד אימות בוואטסאפ מהמספר הרשמי של דרסו, כדי לוודא שאפשר להשיג אותך בקלות.</p>
              <div className="field">
                <label>מספר הטלפון שלך</label>
                <input
                  type="tel" dir="ltr" inputMode="numeric" autoComplete="tel"
                  placeholder="050-1234567" value={phone} required
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ textAlign: 'left', letterSpacing: '0.5px' }}
                />
              </div>
              <button className="btn" style={{ width: '100%', marginTop: 6 }} disabled={busy}>
                {busy ? 'שולח...' : 'שליחת קוד בוואטסאפ 📤'}
              </button>
            </form>
          )}

          {step === 'code' && (
            <div>
              <p className="verify-text">
                הזן את הקוד בן 6 הספרות שנשלח אל
                {' '}<b dir="ltr" style={{ unicodeBidi: 'embed' }}>{phone}</b>
              </p>
              <div className="code-boxes" dir="ltr" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { boxRefs.current[i] = el; }}
                    className="code-box"
                    type="tel" inputMode="numeric" maxLength={2}
                    value={d} disabled={busy}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                  />
                ))}
              </div>
              {busy && <div className="verify-text" style={{ textAlign: 'center' }}>בודק את הקוד...</div>}
              <div className="verify-links">
                <a onClick={() => { setStep('phone'); setError(''); setInfo(''); }}>שינוי מספר</a>
                {cooldown > 0
                  ? <span className="muted">אפשר לשלוח שוב בעוד {cooldown} שניות</span>
                  : <a onClick={sendCode}>שליחת קוד חדש</a>}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="verify-done">
              <div className="verify-icon big">✅</div>
              <h2>המספר אומת בהצלחה!</h2>
              <p className="verify-text">מעביר אותך לאזור האישי...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
