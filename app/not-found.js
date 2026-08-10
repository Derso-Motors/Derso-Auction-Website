import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: 24,
    }}>
      <div style={{
        textAlign: 'center', maxWidth: 400, padding: '40px 28px',
        borderRadius: 14, background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ margin: '14px 0 6px', fontSize: 20 }}>העמוד לא נמצא</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
          הכתובת לא קיימת או שהעמוד הוסר.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/admin/calendar" style={{
            padding: '9px 18px', borderRadius: 8, background: '#6366f1',
            color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>📅 יומן</Link>
          <Link href="/admin" style={{
            padding: '9px 18px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#e4e4e7', fontSize: 13, textDecoration: 'none',
          }}>🏠 לוח בקרה</Link>
        </div>
      </div>
    </div>
  );
}
