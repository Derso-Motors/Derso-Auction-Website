import { SubmitButton } from '../../components/SubmitButton';
import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { buildPaymentUrl } from '../../lib/grow';
import ThankYouOverlay from '../../components/ThankYouOverlay';

export const dynamic = 'force-dynamic';

function getPayUrl(order) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';
    return buildPaymentUrl({
      sum: Number(order.amount),
      description: `דרסו — ${order.report_type}`,
      successUrl: `${baseUrl}/reports?ok=${encodeURIComponent('התשלום התקבל בהצלחה! הדוח יוכן בקרוב ✓')}`,
      cancelUrl: `${baseUrl}/reports?err=${encodeURIComponent('התשלום בוטל')}`,
      userId: order.client_id,
      custom2: order.id,
    });
  } catch {
    return null;
  }
}

export default async function ReportsPage({ searchParams }) {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: orders }, { data: txns }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('report_orders').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('credit_transactions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

  const credits = Number(profile?.credits || 0);

  const statusLabel = {
    pending: 'ממתין', awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל',
  };

  return (
    <Shell active="reports">
      <div className="page-title">דוחות ותשלומים</div>
      <div className="page-sub">מעקב הזמנות, תשלומים ויתרת קרדיטים</div>

      {searchParams?.err && <div className="error-msg">{searchParams.err}</div>}
      {searchParams?.ok && !searchParams?.err && <ThankYouOverlay message={searchParams.ok} />}

      <div className="grid cols-2">
        <div className="card">
          <h3>📋 הזמנת דוח חדש</h3>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            בדיקות מקצועיות לרכבי מכרז — דוח מלא + טופס סליקה משפטי. בחר חבילה מתאימה:
          </p>
          <Link href="/pricing" className="btn" style={{ width: '100%', display: 'block', textAlign: 'center', marginTop: 12 }}>
            💲 לצפייה במחירונים ורכישה →
          </Link>
        </div>

        <div className="card">
          <h3>יתרת קרדיטים — ₪{credits.toLocaleString()}</h3>
          {!txns?.length && <div className="empty">אין תנועות קרדיט</div>}
          <table className="data">
            <tbody>
              {txns?.map((t) => (
                <tr key={t.id}>
                  <td>{t.reason}</td>
                  <td style={{ color: t.amount >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {t.amount >= 0 ? '+' : ''}₪{Number(t.amount).toLocaleString()}
                  </td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10 }}>
            <Link href="/wallet" style={{ color: 'var(--accent)', fontSize: 13 }}>💳 לטעינת קרדיטים →</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>ההזמנות שלי</h3>
        {!orders?.length && <div className="empty">אין הזמנות עדיין</div>}
        {orders?.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>דוח</th><th>רישוי</th><th>סכום</th><th>סטטוס</th><th>תאריך</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const payUrl = o.status === 'awaiting_payment' ? getPayUrl(o) : null;
                  return (
                    <tr key={o.id}>
                      <td>{o.report_type}</td>
                      <td dir="ltr">{o.license_plate || '—'}</td>
                      <td>₪{Number(o.amount).toLocaleString()}{o.paid_with_credits ? ' (קרדיטים)' : ''}</td>
                      <td><span className={`badge ${o.status}`}>{statusLabel[o.status]}</span></td>
                      <td className="muted">{new Date(o.created_at).toLocaleDateString('he-IL')}</td>
                      <td>
                        {o.file_url && <a href={o.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>הורדת דוח</a>}
                        {payUrl && <a href={payUrl} className="btn" style={{ padding: '4px 12px', fontSize: 12 }}>💳 לתשלום</a>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
