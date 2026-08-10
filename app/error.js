'use client';

// Catches errors inside the root layout's {children} — keeps the layout
// shell (nav, sidebar) intact so the user can navigate away normally.
export default function Error({ error, reset }) {
  return (
    <div className="error-boundary">
      <div className="error-card">
        <span className="error-icon">⚠️</span>
        <h2>משהו השתבש</h2>
        <p>קרתה שגיאה — אפשר לנסות שוב או לחזור לעמוד אחר.</p>
        <div className="error-actions">
          <button onClick={() => reset()}>נסה שוב</button>
          <a href="/admin/calendar">📅 יומן</a>
          <a href="/admin">🏠 לוח בקרה</a>
        </div>
      </div>

      <style jsx>{`
        .error-boundary {
          display: flex; align-items: center; justify-content: center;
          min-height: 60vh; padding: 24px;
        }
        .error-card {
          text-align: center; max-width: 400px; padding: 40px 28px;
          border-radius: 14px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .error-icon { font-size: 40px; }
        h2 { margin: 14px 0 6px; font-size: 20px; }
        p { margin: 0 0 24px; font-size: 13px; color: var(--muted); line-height: 1.6; }
        .error-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
        .error-actions button {
          padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer;
          background: var(--primary, #6366f1); color: #fff; font-size: 13px; font-weight: 600;
        }
        .error-actions a {
          padding: 9px 18px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          color: var(--text, #e4e4e7); font-size: 13px; text-decoration: none;
        }
      `}</style>
    </div>
  );
}
