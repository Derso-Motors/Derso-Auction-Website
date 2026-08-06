'use client';

import { useRef, useState } from 'react';

// Drop-in button for server-action forms: reads the form's Bidspirit link input
// (name=linkField), pulls the car details from /api/lot-lookup, and fills the
// mapped inputs by name. Nothing is submitted — the admin reviews/edits first.
// `map` = { apiField: inputName }, e.g. { title:'title', year:'year', km:'km' }.
export default function BidspiritLinkFill({ map, linkField = 'auction_link' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function pull() {
    const formEl = ref.current?.closest('form');
    const url = formEl?.querySelector(`[name="${linkField}"]`)?.value?.trim();
    if (!url) { setErr('הדבק קישור Bidspirit בשדה הקישור קודם'); setMsg(''); return; }
    setBusy(true); setErr(''); setMsg('');
    try {
      const res = await fetch('/api/lot-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await res.json().catch(() => ({ ok: false }));
      if (!j.ok) { setErr(j.error || 'לא הצלחתי למשוך את הרכב מהקישור'); return; }
      let filled = 0;
      for (const [apiField, inputName] of Object.entries(map)) {
        const val = j.car[apiField];
        if (val == null || val === '') continue;
        const el = formEl?.querySelector(`[name="${inputName}"]`);
        if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); filled++; }
      }
      setMsg(filled ? '✓ הפרטים נמשכו — בדוק וערוך לפני שמירה/שליחה' : 'נמשך, אך לא נמצאו שדות למילוי');
    } catch {
      setErr('שגיאת תקשורת — נסה שוב');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="field" style={{ marginTop: -2 }}>
      <button className="btn secondary" type="button" disabled={busy} onClick={pull}>
        {busy ? 'מושך פרטים...' : '🔗 משוך פרטים מהקישור'}
      </button>
      {msg && <div className="muted" style={{ fontSize: 12, color: 'var(--success, #16a34a)', marginTop: 4 }}>{msg}</div>}
      {err && <div className="error-msg" style={{ marginTop: 4 }}>{err}</div>}
    </div>
  );
}
