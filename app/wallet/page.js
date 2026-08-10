import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { CREDIT_PACKAGES, growLinkWithParams } from '../../lib/grow';
import PayPopup from '../../components/PayPopup';
import ThankYouOverlay from '../../components/ThankYouOverlay';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WalletPage({ searchParams }) {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: txns }] = await Promise.all([
    supabase.from('profiles').select('credits').eq('id', user.id).single(),
    supabase.from('credit_transactions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);

  const credits = Number(profile?.credits || 0);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';

  return (
    <Shell active="wallet">
      <div className="page-title">💳 ארנק דרסו</div>
      <div className="page-sub">טעינת קרדיטים, היתרה שלך ופירוט תנועות</div>

      {searchParams?.ok && <ThankYouOverlay message={searchParams.ok} />}
      {searchParams?.err && <div className="error-msg">{searchParams.err}</div>}

      <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div className="muted" style={{ fontSize: 14, marginBottom: 4 }}>היתרה שלך</div>
        <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>
          ₪{credits.toLocaleString()}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          קרדיטים להשלמת עסקאות ושירותים נוספים
        </div>
      </div>

      <div className="page-title" style={{ fontSize: 18, marginTop: 24 }}>חבילות טעינה</div>
      <div className="grid cols-2" style={{ gap: 16 }}>
        {CREDIT_PACKAGES.map((pkg) => {
          const payUrl = growLinkWithParams(pkg.link, {
            userId: user.id,
            custom2: pkg.key,
            successUrl: `${baseUrl}/wallet?ok=${encodeURIComponent(`חבילת ${pkg.label} נטענה בהצלחה! ₪${pkg.credits.toLocaleString()} קרדיטים נוספו ✓`)}`,
            cancelUrl: `${baseUrl}/wallet?err=${encodeURIComponent('התשלום בוטל')}`,
          });

          return (
            <div key={pkg.key} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              {pkg.tag && (
                <div style={{
                  position: 'absolute', top: 12, left: -28,
                  background: pkg.tag === 'הכי פופולרי' ? 'var(--accent)' : 'var(--success)',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  padding: '3px 32px', transform: 'rotate(-45deg)',
                  transformOrigin: 'center',
                }}>{pkg.tag}</div>
              )}
              <h3 style={{ marginBottom: 4 }}>{pkg.label}</h3>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>₪{pkg.credits.toLocaleString()}</div>
              <div className="muted" style={{ fontSize: 13 }}>קרדיטים נטענים מיידית לארנק</div>
              <div style={{ fontSize: 14, margin: '10px 0', color: 'var(--fg-muted)' }}>לתשלום: ₪{pkg.price.toLocaleString()}</div>
              <PayPopup url={payUrl} className="btn" style={{ display: 'block', textAlign: 'center', width: '100%', textDecoration: 'none' }}>
                טעינה — ₪{pkg.price.toLocaleString()}
              </PayPopup>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <h3 style={{ margin: 0 }}>איך זה עובד?</h3>
        </div>
        <ol className="muted" style={{ fontSize: 13.5, lineHeight: 1.8, paddingInlineStart: 20, margin: 0 }}>
          <li>בוחרים חבילת קרדיטים ומשלמים בכרטיס אשראי (סליקה מאובטחת של Grow)</li>
          <li>הקרדיטים נטענים אוטומטית לארנק תוך דקות</li>
          <li>משתמשים בקרדיטים להשלמת עסקאות ושירותים נוספים</li>
        </ol>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>📋 פירוט תנועות</h3>
        {!txns?.length && <div className="empty">אין תנועות עדיין</div>}
        {txns?.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>פירוט</th><th>סכום</th><th>תאריך</th></tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td>{t.reason}</td>
                    <td style={{ color: t.amount >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {t.amount >= 0 ? '+' : ''}₪{Math.abs(Number(t.amount)).toLocaleString()}
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('he-IL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link href="/reports" style={{ color: 'var(--accent)' }}>→ לדוחות ותשלומים</Link>
      </div>
    </Shell>
  );
}
