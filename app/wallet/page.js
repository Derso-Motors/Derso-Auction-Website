import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { CREDIT_PACKAGES, buildPaymentUrl } from '../../lib/grow';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: txns }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('credit_transactions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(30),
  ]);

  const credits = Number(profile?.credits || 0);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';

  const packages = CREDIT_PACKAGES.map((pkg) => {
    const payUrl = buildPaymentUrl({
      amount: pkg.amount,
      description: `דרסו — טעינת ארנק ${pkg.label}`,
      userId: user.id,
      orderId: pkg.key,
      successUrl: `${baseUrl}/wallet?ok=${encodeURIComponent('התשלום התקבל! הקרדיטים יתעדכנו תוך דקה ✓')}`,
      cancelUrl: `${baseUrl}/wallet?err=${encodeURIComponent('התשלום בוטל')}`,
      payerEmail: user.email,
      payerPhone: profile?.phone,
      payerName: profile?.full_name,
    });
    return { ...pkg, payUrl };
  });

  return (
    <Shell active="wallet">
      <div className="page-title">ארנק דרסו</div>
      <div className="page-sub">טעינת קרדיטים לתשלום מהיר על דוחות ושירותים</div>

      {/* Balance card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--surface-high) 0%, var(--surface) 100%)', textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>יתרת הארנק שלך</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
          ₪{credits.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          ניתן לשלם בקרדיטים על דוחות בדיקה ושירותים נוספים
        </div>
      </div>

      {/* Credit packages */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 16 }}>טעינת קרדיטים</h3>
        <div className="grid cols-2" style={{ gap: 16 }}>
          {packages.map((pkg) => (
            <div
              key={pkg.key}
              className="card"
              style={{
                position: 'relative',
                border: pkg.popular ? '2px solid var(--primary)' : '1px solid var(--border)',
                textAlign: 'center',
                padding: '24px 16px',
              }}
            >
              {pkg.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--primary)', color: '#000', fontSize: 11, fontWeight: 700,
                  padding: '2px 12px', borderRadius: 12, whiteSpace: 'nowrap',
                }}>
                  ⭐ הכי פופולרי
                </div>
              )}
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>
                ₪{pkg.amount.toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, margin: '6px 0' }}>
                + בונוס ₪{pkg.bonus} 🎁
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                סה"כ ₪{pkg.total.toLocaleString()} בארנק
              </div>
              {pkg.payUrl ? (
                <a href={pkg.payUrl} className="btn" style={{ display: 'block', textDecoration: 'none' }}>
                  טעינה — ₪{pkg.amount.toLocaleString()}
                </a>
              ) : (
                <div className="btn secondary" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  בקרוב
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 12 }}>
          התשלום מאובטח דרך Grow 🔒 — כרטיס אשראי, bit, Apple Pay, Google Pay
        </div>
      </div>

      {/* Transaction history */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>היסטוריית תנועות</h3>
        {!txns?.length && <div className="empty">אין תנועות עדיין</div>}
        {txns?.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>תיאור</th><th>סכום</th><th>תאריך</th></tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td>{t.reason}</td>
                    <td style={{
                      color: t.amount >= 0 ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {t.amount >= 0 ? '+' : ''}₪{Number(t.amount).toLocaleString()}
                    </td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(t.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="card" style={{ background: 'var(--surface-lowest)', border: '1px solid var(--border)', marginTop: 16 }}>
        <h4 style={{ marginBottom: 8, fontSize: 13 }}>💡 איך זה עובד?</h4>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>
          <strong>1.</strong> בחר חבילת קרדיטים וטען את הארנק 💳<br />
          <strong>2.</strong> הקרדיטים מתעדכנים אוטומטית תוך דקה ⚡<br />
          <strong>3.</strong> בהזמנת דוח — סמן "שלם מקרדיטים" ושלם מיידית ✅<br />
          <strong>4.</strong> ככל שהחבילה גדולה יותר, הבונוס גדל! 🎁<br />
        </div>
      </div>
    </Shell>
  );
}
