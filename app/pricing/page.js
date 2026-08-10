import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import Link from 'next/link';
import { REPORT_PACKAGES, buildPaymentUrl } from '../../lib/grow';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const { user } = await requireUser();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';

  return (
    <Shell active="pricing">
      <div className="page-title">המחירונים שלנו</div>
      <div className="page-sub">חבילות בדיקה מקצועיות לרכבי מכרז — כולל טופס סליקה משפטי</div>

      <div className="pricing-grid">
        {REPORT_PACKAGES.map((pkg) => {
          let payUrl = null;
          try {
            payUrl = buildPaymentUrl({
              sum: pkg.price,
              description: `דרסו — ${pkg.label}`,
              successUrl: `${baseUrl}/reports?ok=${encodeURIComponent('התשלום התקבל! החבילה תופעל בקרוב ✓')}`,
              cancelUrl: `${baseUrl}/pricing?err=${encodeURIComponent('התשלום בוטל')}`,
              userId: user.id,
              custom2: pkg.key,
            });
          } catch {}

          return (
            <div key={pkg.key} className={`pricing-card ${pkg.featured ? 'featured' : ''}`}>
              {pkg.tag && <div className="pricing-tag">{pkg.tag}</div>}
              <h3>{pkg.label}</h3>
              <div className="pricing-includes">
                <div>📋 {pkg.reports} דוח{pkg.reports > 1 ? 'ות' : ''} בדיקה מלא{pkg.reports > 1 ? 'ים' : ''}</div>
                <div>📄 {pkg.forms} טופס{pkg.forms > 1 ? 'י' : ''} סליקה משפטי{pkg.forms > 1 ? 'ים' : ''}</div>
              </div>
              {pkg.saving > 0 && (
                <div className="pricing-saving">חיסכון של ₪{pkg.saving.toLocaleString()}</div>
              )}
              <div className="pricing-price">
                {pkg.fullValue > pkg.price && (
                  <span className="pricing-was">₪{pkg.fullValue.toLocaleString()}</span>
                )}
                <span className="pricing-now">₪{pkg.price.toLocaleString()}</span>
              </div>
              <div className="pricing-per-unit">₪{pkg.perUnit.toLocaleString()} לדוח</div>
              {pkg.description && <p className="pricing-desc">{pkg.description}</p>}
              {payUrl ? (
                <a href={payUrl} className="btn pricing-cta">{pkg.cta}</a>
              ) : (
                <span className="btn disabled">{pkg.cta}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 24, textAlign: 'center' }}>
        <h3>🛡️ התחייבות שלנו</h3>
        <div className="pricing-guarantees">
          <div>✅ ללא תפוגה — הדוחות שלך לעולם</div>
          <div>✅ ניתן להעברה — קנית ולא השתמשת? העבר ללקוח אחר</div>
          <div>✅ עדיפות בטיפול — חבילה = שירות VIP</div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>* המחירים כוללים מע"מ. <Link href="/terms" style={{ color: 'var(--accent)' }}>תנאי שימוש</Link></p>
      </div>
    </Shell>
  );
}
