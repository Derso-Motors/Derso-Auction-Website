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
        {packages.map((pkg, i) => (
          <article key={pkg.key} className={`pr-card ${pkg.featured ? 'featured' : ''}`} style={{ animationDelay: `${0.1 + i * 0.15}s` }}>
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
          width: 100%;
          color: var(--text);
        }
        .pr-hero { text-align: center; margin-bottom: 36px; animation: pr-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .pr-hero h1 {
          font-size: clamp(26px, 4vw, 40px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 10px;
          color: var(--text);
        }
        .pr-hero p { color: var(--muted-dim); font-size: 15px; margin: 0 auto; max-width: 560px; }

        @keyframes pr-rise {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pr-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(186, 199, 227, 0.1); }
          50% { box-shadow: 0 0 44px rgba(186, 199, 227, 0.22); }
        }
        @keyframes pr-shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }

        .pr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          align-items: stretch;
        }
        .pr-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
          animation: pr-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .pr-card:hover { border-color: var(--muted-dim); transform: translateY(-6px); box-shadow: 0 14px 36px rgba(0, 0, 0, 0.4); }
        .pr-card.featured {
          background: var(--surface-high);
          border-color: var(--accent);
          animation: pr-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both, pr-glow 3s ease-in-out 1s infinite;
        }
        @media (min-width: 900px) {
          .pr-card.featured { transform: translateY(-8px); }
          .pr-card.featured:hover { transform: translateY(-14px); }
        }
        .pr-topline {
          position: absolute;
          top: 0; right: 0; left: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--success), var(--accent));
          background-size: 200% 100%;
          animation: pr-shimmer 3s linear infinite;
        }
        .pr-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 18px; }
        .pr-card h3 { font-size: 22px; font-weight: 600; margin: 0 0 6px; color: var(--text); }
        .pr-card h3.accent { color: var(--accent); }
        .pr-desc { color: var(--muted-dim); font-size: 13px; margin: 0; min-height: 36px; }
        .pr-tag {
          background: var(--primary-container);
          color: var(--accent);
          border: 1px solid var(--accent);
          font-size: 11px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pr-price-row { display: flex; align-items: baseline; gap: 10px; }
        .pr-price { font-size: 38px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
        .pr-was { color: var(--muted-dim); text-decoration: line-through; font-size: 15px; }
        .pr-saving { color: var(--success); font-size: 12.5px; font-weight: 600; margin-top: 4px; }
        .pr-features { list-style: none; padding: 0; margin: 20px 0 24px; flex: 1; display: flex; flex-direction: column; gap: 12px; }
        .pr-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; color: var(--text); }
        .pr-check {
          color: var(--success);
          font-weight: 700;
          flex-shrink: 0;
          background: var(--success-bg);
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
          padding: 13px 24px;
          border-radius: var(--radius);
          border: 1.5px solid var(--accent);
          color: var(--accent);
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          margin-top: auto;
        }
        .pr-cta:hover { background: var(--primary-container); transform: scale(1.02); }
        .pr-cta:active { transform: scale(0.97); }
        .pr-cta.primary {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--on-primary);
          box-shadow: 0 4px 14px rgba(186, 199, 227, 0.25);
        }
        .pr-cta.primary:hover { filter: brightness(1.1); }

        .pr-guarantee {
          margin-top: 28px;
          background: var(--surface-lowest);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 28px 24px;
          animation: pr-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.55s both;
        }
        .pr-guarantee h3 { display: flex; align-items: center; gap: 10px; font-size: 20px; margin: 0 0 22px; color: var(--text); }
        .pr-guarantee-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 22px; }
        .pr-gicon {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: var(--surface-high);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          margin-bottom: 10px;
        }
        .pr-guarantee h4 { font-size: 15px; margin: 0 0 6px; color: var(--text); }
        .pr-guarantee p { font-size: 13px; color: var(--muted-dim); margin: 0; line-height: 1.6; }
        .pr-fineprint { margin: 22px 0 0; font-size: 12px; color: var(--muted-dim); text-align: center; }
        .pr-fineprint a { color: var(--accent); }
      `}</style>
    </div>
  );
}
