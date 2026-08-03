'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase-client';

export default function SettingsForm({ email, fullName, phone, credits, createdAt }) {
  const [name, setName] = useState(fullName);
  const [ph, setPh] = useState(phone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passSaved, setPassSaved] = useState(false);
  const [passError, setPassError] = useState('');

  async function saveProfile(e) {
    e.preventDefault();
    if (!name.trim()) { setError('שם מלא הוא שדה חובה'); return; }
    setSaving(true); setError(''); setSaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('לא מחובר'); setSaving(false); return; }
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), phone: ph.trim() || null })
      .eq('id', user.id);
    if (err) { setError('שגיאה בשמירה'); } else { setSaved(true); }
    setSaving(false);
  }

  async function changePassword(e) {
    e.preventDefault();
    setPassError(''); setPassSaved(false);
    if (newPass.length < 8) { setPassError('סיסמה חייבת להכיל לפחות 8 תווים'); return; }
    if (newPass !== confirmPass) { setPassError('הסיסמאות לא תואמות'); return; }
    setPassSaving(true);
    const supabase = createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: oldPass });
    if (signInErr) { setPassError('סיסמה נוכחית שגויה'); setPassSaving(false); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass });
    if (updateErr) { setPassError('שגיאה בעדכון סיסמה'); } else {
      setPassSaved(true); setOldPass(''); setNewPass(''); setConfirmPass('');
    }
    setPassSaving(false);
  }

  const joinDate = createdAt
    ? new Date(createdAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="card">
        <h3>פרטי חשבון</h3>
        <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>אימייל</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>{email}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>קרדיטים</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--primary)' }}>{credits}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>תאריך הצטרפות</div>
            <div style={{ fontSize: 14 }}>{joinDate}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>עדכון פרטים</h3>
        {error && <div className="error-msg">{error}</div>}
        {saved && <div className="info-msg">הפרטים עודכנו בהצלחה</div>}
        <form onSubmit={saveProfile}>
          <div className="field">
            <label>שם מלא</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="ישראל ישראלי" />
          </div>
          <div className="field">
            <label>טלפון</label>
            <input value={ph} onChange={e => setPh(e.target.value)} dir="ltr" placeholder="050-1234567" />
          </div>
          <button className="btn" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? 'שומר...' : 'שמירת שינויים'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>שינוי סיסמה</h3>
        {passError && <div className="error-msg">{passError}</div>}
        {passSaved && <div className="info-msg">הסיסמה שונתה בהצלחה</div>}
        <form onSubmit={changePassword}>
          <div className="field">
            <label>סיסמה נוכחית</label>
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} required dir="ltr" placeholder="••••••••" />
          </div>
          <div className="field">
            <label>סיסמה חדשה</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required dir="ltr" minLength={8} placeholder="••••••••" />
          </div>
          <div className="field">
            <label>אימות סיסמה חדשה</label>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required dir="ltr" minLength={8} placeholder="••••••••" />
          </div>
          <button className="btn secondary" disabled={passSaving} style={{ marginTop: 4 }}>
            {passSaving ? 'מעדכן...' : 'עדכון סיסמה'}
          </button>
        </form>
      </div>
    </div>
  );
}
