'use client';

// Next.js global-error replaces the *entire* HTML shell (including layout.js),
// so we must render <html> and <body> ourselves.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="he" dir="rtl">
      <body style={bodyStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={h1Style}>משהו השתבש</h1>
          <p style={pStyle}>קרתה שגיאה בלתי צפויה — אפשר לנסות שוב או לחזור לעמוד הראשי.</p>
          <div style={btnRow}>
            <button onClick={() => reset()} style={btnPrimary}>נסה שוב</button>
            <a href="/admin/calendar" style={btnSecondary}>📅 יומן</a>
            <a href="/admin" style={btnSecondary}>🏠 לוח בקרה</a>
          </div>
        </div>
      </body>
    </html>
  );
}

const bodyStyle = {
  margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: '#131315', fontFamily: 'system-ui, sans-serif',
  color: '#e4e4e7', padding: 24,
};
const cardStyle = {
  textAlign: 'center', maxWidth: 420, padding: '48px 32px', borderRadius: 16,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
};
const h1Style = { margin: '16px 0 8px', fontSize: 22, fontWeight: 700 };
const pStyle = { margin: '0 0 28px', fontSize: 14, color: '#a1a1aa', lineHeight: 1.6 };
const btnRow = { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' };
const btnPrimary = {
  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600,
};
const btnSecondary = {
  padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent', color: '#e4e4e7', fontSize: 14, textDecoration: 'none',
  fontWeight: 500,
};
