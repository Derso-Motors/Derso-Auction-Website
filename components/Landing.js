import Link from 'next/link';

// דף נחיתה ציבורי — מוצג בעמוד הבית לאורחים (לא מחוברים). ללא Shell.
export default function Landing() {
  return (
    <div className="legal-public" style={{ display: 'flex', flexDirection: 'column' }}>
      <header className="legal-public-header">
        <div className="topbar-brand">דרסו</div>
        <Link href="/login" className="btn small">כניסה / הרשמה</Link>
      </header>

      <main className="legal-public-main main-anim" style={{ flex: 1, width: '100%' }}>
        <section data-reveal style={{ textAlign: 'center', padding: '48px 0 36px' }}>
          <h1 className="page-title" style={{ fontSize: 34, lineHeight: 1.3 }}>
            דרסו — ליווי מקצועי למכרזי רכב
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7, maxWidth: 560, margin: '14px auto 0' }}>
            קונים רכב ממכרזים בליווי מלא — סינון הזדמנויות, ליווי בהצעות ודוחות בדיקה,
            עד שהרכב הנכון אצלך ביד.
          </p>
        </section>

        <div className="grid cols-3">
          <div data-reveal className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>איתור הזדמנויות</div>
            <p className="muted" style={{ lineHeight: 1.6 }}>סורקים מכרזים ומאתרים רכבים מתחת למחיר השוק</p>
          </div>
          <div data-reveal="2" className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🤝</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>ליווי מלא</div>
            <p className="muted" style={{ lineHeight: 1.6 }}>מלווים אותך מהצעה ועד מסירה</p>
          </div>
          <div data-reveal="3" className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>דוחות בדיקה</div>
            <p className="muted" style={{ lineHeight: 1.6 }}>דוח מקצועי + טופס סליקה משפטי לפני כל הצעה</p>
          </div>
        </div>

        <div data-reveal className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 14, margin: '32px 0 20px' }}>
          <Link href="/login" className="btn" style={{ fontSize: 15, padding: '12px 28px' }}>כניסה / הרשמה</Link>
          <a href="https://wa.me/972559506913" target="_blank" rel="noreferrer" className="btn secondary" style={{ fontSize: 15, padding: '12px 28px' }}>
            דברו איתנו בוואטסאפ
          </a>
        </div>
      </main>

      <footer className="login-footer">
        <div className="login-footer-links">
          <Link href="/terms">תקנון</Link>
          <Link href="/privacy">מדיניות פרטיות</Link>
          <Link href="/disclaimer">הבהרה משפטית</Link>
        </div>
        <p>© 2026 דרסו</p>
      </footer>
    </div>
  );
}
