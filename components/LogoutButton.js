'use client';

import { useState } from 'react';

// Sidebar logout button with a styled in-app confirmation dialog
// (instead of the browser's native confirm popup).
export default function LogoutButton({ action }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button className="icon-sidebar-item" type="button" title="התנתקות" onClick={() => setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
      {open && (
        <div className="confirm-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">👋</div>
            <div className="confirm-title">להתנתק מהאזור האישי?</div>
            <div className="confirm-sub">תמיד אפשר להתחבר שוב עם המייל או עם Google</div>
            <form action={action} onSubmit={() => setBusy(true)}>
              <div className="confirm-actions">
                <button className="btn danger" type="submit" disabled={busy}>
                  {busy ? 'מתנתק...' : 'כן, התנתקות'}
                </button>
                <button className="btn secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
