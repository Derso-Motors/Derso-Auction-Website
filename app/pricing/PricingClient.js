'use client';

import PayPopup from '../../components/PayPopup';

export default function PricingClient({ packages }) {
  return (
    <div className="pr-root" dir="rtl">
      <div className="pr-hero">
        <h1>המחירונים שלנו</h1>
        <p>חבילות בדיקה מקצועיות לרכבי מכרז — כולל טופס סליקה משפטי</p>
      </div>

      <div className="pr-grid">
        {packages.map((pkg) => (
          <article key={pkg.key} className={`pr-card ${pkg.featured ? 'featured' : ''}`}>
            {pkg.featured && <div className="pr-topline" />}
            <div className="pr-card-head">
              <div>
                <h3 className={pkg.featured ? 'accent' : ''}>{pkg.label}</h3>
                <p className="pr-desc">{pkg.description}</p>
              </div>
              {pkg.tag && <span className="pr-tag">{pkg.tag}</span>}
            </div>
            <div className="pr-price-row">
              <span className="pr-price">₪{pkg.price.toLocaleString()}</span>
              {pkg.fullValue > pkg.price && <span className="pr-was">₪{pkg.fullValue.toLocaleString()}</span>}
            </div>
            {pkg.saving > 0 && (
              <div className="pr-saving">חיסכון של ₪{pkg.saving.toLocaleString()} • ₪{pkg.perUnit.toLocaleString()} לדוח</div>
            )}
            <ul className="pr-features">
              {pkg.features.map((f) => (
                <li key={f}><span className="pr-check">✓</span>{f}</li>
              ))}
            </ul>
            <PayPopup url={pkg.payUrl} className={`pr-cta ${pkg.featured ? 'primary' : ''}`}>
              {pkg.cta}
            </PayPopup>
          </article>
        ))}
      </div>

      <section className="pr-guarantee">
        <h3><span className="pr-check big">✓</span> ההתחייבות שלנו</h3>
        <div className="pr-guarantee-grid">
          <div>
            <div className="pr-gicon">♾️</div>
            <h4>ללא תפוגה</h4>
            <p>הדוחות שלך שמורים במערכת לעולם, ללא מגבלת זמן.</p>
          </div>
          <div>
            <div className="pr-gicon">🔁</div>
            <h4>ניתן להעברה</h4>
            <p>קנית ולא השתמשת? תוכל להעביר את הזכות ללקוח אחר בקלות.</p>
          </div>
          <div>
            <div className="pr-gicon">⭐</div>
            <h4>עדיפות בטיפול</h4>
            <p>רוכשי חבילות נהנים משירות VIP ומענה מהיר בזמן אמת.</p>
          </div>
        </div>
        <p className="pr-fineprint">* המחירים כוללים מע"מ · <a href="/terms">תנאי שימוש</a></p>
      </section>

      <style jsx>{`
        .pr-root {
          --pr-bg: #051424;
          --pr-card: rgba(13, 28, 45, 0.6);
          --pr-card-hi: #1c2b3c;
          --pr-border: rgba(255, 255, 255, 0.1);
          --pr-text: #d4e4fa;
          --pr-muted: #c6c6cd;
          --pr-accent: #4edea3;
          --pr-on-accent: #003824;
          background: var(--pr-bg);
          color: var(--pr-text);
          border-radius: 24px;
          padding: 40px 24px 32px;
          margin: -8px 0 16px;
          font-family: 'Inter', 'Heebo', system-ui, sans-serif;
          overflow: hidden;
          position: relative;
        }
        .pr-root::before {
          content: '';
          position: absolute;
          top: -20%; left: -10%;
          width: 50%; height: 50%;
          background: rgba(78, 222, 163, 0.06);
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
        }
        .pr-hero { text-align: center; margin-bottom: 36px; position: relative; }
        .pr-hero h1 {
          font-size: clamp(26px, 4vw, 44px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 10px;
          color: var(--pr-text);
        }
        .pr-hero p { color: var(--pr-muted); font-size: 15px; margin: 0 auto; max-width: 560px; }

        .pr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          align-items: stretch;
        }
        .pr-card {
          background: var(--pr-card);
          backdrop-filter: blur(16px);
          border: 1px solid var(--pr-border);
          border-radius: 24px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
        }
        .pr-card:hover { border-color: rgba(255, 255, 255, 0.25); }
        .pr-card.featured {
          background: var(--pr-card-hi);
          border-color: rgba(78, 222, 163, 0.35);
          box-shadow: 0 0 40px rgba(78, 222, 163, 0.12);
        }
        @media (min-width: 900px) {
          .pr-card.featured { transform: translateY(-10px); }
        }
        .pr-topline {
          position: absolute;
          top: 0; right: 0; left: 0;
          height: 3px;
          background: linear-gradient(90deg, #4edea3, #c0c6de);
        }
        .pr-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 18px; }
        .pr-card h3 { font-size: 22px; font-weight: 600; margin: 0 0 6px; color: var(--pr-text); }
        .pr-card h3.accent { color: var(--pr-accent); }
        .pr-desc { color: var(--pr-muted); font-size: 13px; margin: 0; min-height: 36px; }
        .pr-tag {
          background: rgba(78, 222, 163, 0.1);
          color: var(--pr-accent);
          border: 1px solid rgba(78, 222, 163, 0.25);
          font-size: 11px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pr-price-row { display: flex; align-items: baseline; gap: 10px; }
        .pr-price { font-size: 38px; font-weight: 700; letter-spacing: -0.02em; color: var(--pr-text); }
        .pr-was { color: var(--pr-muted); text-decoration: line-through; font-size: 15px; }
        .pr-saving { color: var(--pr-accent); font-size: 12.5px; font-weight: 600; margin-top: 4px; }
        .pr-features { list-style: none; padding: 0; margin: 20px 0 24px; flex: 1; display: flex; flex-direction: column; gap: 12px; }
        .pr-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; color: var(--pr-text); }
        .pr-check {
          color: var(--pr-accent);
          font-weight: 700;
          flex-shrink: 0;
          background: rgba(78, 222, 163, 0.12);
          border-radius: 50%;
          width: 20px; height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .pr-check.big { width: 28px; height: 28px; font-size: 15px; }
        .pr-cta {
          display: block;
          text-align: center;
          padding: 14px 24px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: var(--pr-text);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          margin-top: auto;
        }
        .pr-cta:hover { background: rgba(255, 255, 255, 0.06); border-color: var(--pr-accent); color: var(--pr-accent); }
        .pr-cta.primary {
          background: var(--pr-accent);
          border-color: var(--pr-accent);
          color: var(--pr-on-accent);
          box-shadow: 0 4px 14px rgba(78, 222, 163, 0.35);
        }
        .pr-cta.primary:hover { background: #6ffbbe; color: var(--pr-on-accent); }

        .pr-guarantee {
          margin-top: 28px;
          background: rgba(1, 15, 31, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          padding: 28px 24px;
          position: relative;
          overflow: hidden;
        }
        .pr-guarantee h3 { display: flex; align-items: center; gap: 10px; font-size: 20px; margin: 0 0 22px; color: var(--pr-text); }
        .pr-guarantee-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 22px; }
        .pr-gicon {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: var(--pr-card-hi);
          border: 1px solid var(--pr-border);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          margin-bottom: 10px;
        }
        .pr-guarantee h4 { font-size: 15px; margin: 0 0 6px; color: var(--pr-text); }
        .pr-guarantee p { font-size: 13px; color: var(--pr-muted); margin: 0; line-height: 1.6; }
        .pr-fineprint { margin: 22px 0 0; font-size: 12px; color: var(--pr-muted); text-align: center; }
        .pr-fineprint a { color: var(--pr-accent); }
      `}</style>
    </div>
  );
}
