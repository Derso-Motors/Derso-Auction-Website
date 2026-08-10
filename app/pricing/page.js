import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { REPORT_PACKAGES, buildPaymentUrl } from '../../lib/grow';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PricingPage({ searchParams }) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('credits, full_name').eq('id', user.id).single();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';

  return (
    <Shell active="pricing">
      <style>{`
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .pricing-card {
          background: var(--card-bg, #fff);
          border: 2px solid var(--border, #e5e7eb);
          border-radius: 16px;
          padding: 28px 24px;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pricing-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }
        .pricing-card.featured {
          border-color: var(--accent, #2563eb);
          box-shadow: 0 0 0 1px var(--accent, #2563eb), 0 8px 32px rgba(37,99,235,0.12);
          transform: scale(1.03);
        }
        .pricing-card.featured:hover {
          transform: scale(1.03) translateY(-2px);
        }
        .pricing-tag {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          background: var(--bg-muted, #f3f4f6);
          color: var(--fg-muted, #6b7280);
          margin-bottom: 12px;
        }
        .pricing-tag.featured {
          background: var(--accent, #2563eb);
          color: #fff;
        }
        .pricing-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 16px;
          line-height: 1.3;
        }
        .pricing-saving {
          display: inline-block;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .pricing-price {
          margin-bottom: 6px;
        }
        .pricing-price .old {
          text-decoration: line-through;
          color: var(--fg-muted, #9ca3af);
          font-size: 16px;
          margin-inline-end: 8px;
        }
        .pricing-price .current {
          font-size: 36px;
          font-weight: 800;
          color: var(--fg, #111);
        }
        .pricing-per-unit {
          font-size: 13px;
          color: var(--fg-muted, #6b7280);
          margin-bottom: 16px;
        }
        .pricing-desc {
          font-size: 13.5px;
          line-height: 1.7;
          color: var(--fg-muted, #6b7280);
          flex: 1;
          margin-bottom: 20px;
        }
        .pricing-cta {
          display: block;
          text-align: center;
          padding: 14px 20px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 0.15s;
          cursor: pointer;
        }
        .pricing-cta:hover { opacity: 0.9; }
        .pricing-cta.primary {
          background: var(--accent, #2563eb);
          color: #fff;
        }
        .pricing-cta.secondary {
          background: var(--bg-muted, #f3f4f6);
          color: var(--fg, #111);
          border: 1px solid var(--border, #e5e7eb);
        }
        .pricing-cta.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .pricing-guarantee {
          margin-top: 32px;
          padding: 20px 24px;
          border-radius: 12px;
          background: var(--bg-muted, #f8fafc);
          border: 1px solid var(--border, #e5e7eb);
        }
        .pricing-guarantee h3 {
          font-size: 16px;
          margin-bottom: 8px;
        }
        .pricing-guarantee ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .pricing-guarantee li {
          font-size: 13.5px;
          line-height: 1.8;
          color: var(--fg-muted, #6b7280);
          padding-inline-start: 24px;
          position: relative;
        }
        .pricing-guarantee li::before {
          content: '✓';
          position: absolute;
          inset-inline-start: 0;
          color: var(--success, #10b981);
          font-weight: 700;
        }
        .pricing-disclaimer {
          margin-top: 24px;
          font-size: 12px;
          color: var(--fg-muted, #9ca3af);
          line-height: 1.6;
        }
        @media (max-width: 900px) {
          .pricing-card.featured { transform: scale(1); }
          .pricing-card.featured:hover { transform: translateY(-2px); }
        }
      `}</style>

      <div className="page-title">המחירונים שלנו</div>
      <div className="page-sub">חבילות דוחות בדיקה לכלי רכב · כולל טפסי סליקה משפטיים</div>

      {searchParams?.ok && <div className="info-msg">{searchParams.ok}</div>}
      {searchParams?.err && <div className="error-msg">{searchParams.err}</div>}

      <div className="pricing-grid">
        {REPORT_PACKAGES.map((pkg) => {
          let payUrl;
          try {
            payUrl = buildPaymentUrl({
              sum: pkg.price,
              description: `דרסו — ${pkg.label}`,
              successUrl: `${baseUrl}/pricing?ok=${encodeURIComponent(`רכישת ${pkg.label} התקבלה בהצלחה! הדוחות נוספו לחשבונך ✓`)}`,
              cancelUrl: `${baseUrl}/pricing?err=${encodeURIComponent('התשלום בוטל')}`,
              userId: user.id,
              custom2: pkg.key,
            });
          } catch {
            payUrl = null;
          }

          return (
            <div key={pkg.key} className={`pricing-card ${pkg.featured ? 'featured' : ''}`}>
              <span className={`pricing-tag ${pkg.tagStyle === 'featured' ? 'featured' : ''}`}>
                {pkg.tag}
              </span>

              <div className="pricing-title">{pkg.label}</div>

              {pkg.saving > 0 && (
                <div className="pricing-saving">חיסכון של ₪{pkg.saving.toLocaleString()}</div>
              )}

              <div className="pricing-price">
                {pkg.saving > 0 && <span className="old">₪{pkg.fullValue.toLocaleString()}</span>}
                <span className="current">₪{pkg.price.toLocaleString()}</span>
              </div>

              {pkg.reports > 1 && (
                <div className="pricing-per-unit">₪{pkg.perUnit.toLocaleString()} לערכה (דוח + טופס)</div>
              )}

              <div className="pricing-desc">{pkg.description}</div>

              {payUrl ? (
                <a href={payUrl} className={`pricing-cta ${pkg.featured ? 'primary' : 'secondary'}`}>
                  {pkg.cta}
                </a>
              ) : (
                <div className="pricing-cta secondary disabled">בקרוב</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pricing-guarantee">
        <h3>🔒 גמישות מלאה ואי-תג תפוגה</h3>
        <ul>
          <li>בנק הדוחות נשמר בחשבונך ללא הגבלת זמן</li>
          <li>זכית ברכב כבר בדוח השני? יתרת הדוחות נשארת זמינה</li>
          <li>ניתן להעביר יתרה לבן משפחה או מכר</li>
          <li>כל דוח כולל טופס סליקה משפטי (בשמאי/כונס) בשווי ₪330</li>
          <li>תעדוף שיגור סיירים בשטח ללקוחות חבילות</li>
        </ul>
      </div>

      <div className="pricing-disclaimer">
        * שירותי הבדיקה והדוחות ניתנים לצרכי מידע בלבד ואינם מהווים חוות דעת מקצועית מחייבת, ייעוץ משפטי או התחייבות מצד דרסו לגבי מצבו הטכני, המשפטי או הכלכלי של כלי הרכב הנבדק. דרסו אינה אחראית לכל נזק ישיר או עקיף הנובע מהסתמכות על תוכן הדוחות. לפרטים המלאים ראו את <Link href="/terms" style={{ color: 'var(--accent)' }}>תנאי השימוש</Link>.
      </div>
    </Shell>
  );
}
