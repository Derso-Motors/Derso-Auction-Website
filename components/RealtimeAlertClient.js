'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Dashboard "real-time alert" banner with a dismiss (X) button. Dismissal is
// remembered (localStorage) against the latest-message signature, so the banner
// stays hidden until a NEW client message arrives.
export default function RealtimeAlertClient({ count, name, body, sig }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (sig && localStorage.getItem('rt-alert-dismissed') === sig) setHidden(true);
    } catch {}
  }, [sig]);

  if (hidden) return null;

  function dismiss() {
    try { if (sig) localStorage.setItem('rt-alert-dismissed', sig); } catch {}
    setHidden(true);
  }

  return (
    <div className="alert-box" style={{ marginBottom: 16 }}>
      <div className="alert-box-icon">⚠</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: 4 }}>התראת זמן אמת</div>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          {count} הודעות חדשות מלקוחות ממתינות למענה.
          {name && (
            <> האחרונה מ-<span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--primary)' }}>{name}</span>: &quot;{body?.substring(0, 60)}{body?.length > 60 ? '...' : ''}&quot;</>
          )}
        </div>
      </div>
      <Link href="/admin/messages" style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', whiteSpace: 'nowrap', flexShrink: 0 }}>צפה בהודעות</Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="סגור התראה"
        title="סגור"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: '2px 6px',
          flexShrink: 0, marginInlineStart: 4,
        }}
      >
        ✕
      </button>
    </div>
  );
}
