import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { buildPaymentUrl } from '../../lib/grow';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const REPORT_TYPES = [
  { key: 'history', label: 'דוח היסטוריה (בעלויות, תאונות, שעבודים)', price: 149 },
  { key: 'mechanical', label: 'בדיקה מכנית מלאה לפני מכרז', price: 490 },
  { key: 'valuation', label: 'הערכת שווי ומחירון מדויק', price: 99 },
];

async function orderReport(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const type = REPORT_TYPES.find((t) => t.key === formData.get('report_type'));
  if (!type) return;

  const useCredits = formData.get('use_credits') === 'on';
  const { data: profile } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
  const canUseCredits = useCredits && Number(profile?.credits || 0) >= type.price;

  // If paying with credits — spend first, then insert order
  if (canUseCredits) {
    const { error: spendErr } = await supabase.rpc('spend_credits', { p_amount: type.price, p_reason: `תשלום עבור ${type.label}` });
    if (spendErr) {
      // spend failed — don't create the order
      const { redirect } = await import('next/navigation');
      redirect('/reports?err=' + encodeURIComponent('שגיאה בניכוי קרדיטים — נסה שוב'));
    }
  }

  const { data: order, error } = await supabase.from('report_orders').insert({
    client_id: user.id,
    report_type: type.label,
    license_plate: formData.get('license_plate') || null,
    amount: type.price,
    paid_with_credits: canUseCredits,
    status: canUseCredits ? 'paid' : 'awaiting_payment',
  }).select('id').single();

  if (error) {
    // If we already spent credits but insert failed — refund
    if (canUseCredits) {
      const { data: p } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
      await supabase.from('profiles').update({ credits: Number(p?.credits || 0) + type.price }).eq('id', user.id);
      await supabase.from('credit_transactions').insert({
        client_id: user.id, amount: type.price, reason: 'החזר — שגיאה ביצירת הזמנה',
      });
    }
    const { redirect } = await import('next/navigation');
    redirect('/reports?err=' + encodeURIComponent('שגיאה ביצירת ההזמנה'));
  }

  revalidatePath('/reports');
}

export default async function ReportsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: orders }, { data: txns }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('report_orders').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('credit_transactions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';

  const statusLabel = {
    pending: 'ממתין', awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל',
  };

  return (
    <Shell active="reports">
      <div className="page-title">דוחות ותשלומים</div>
      <div className="page-sub">הזמנת דוחות בדיקה, מעקב תשלומים ויתרת קרדיטים</div>

      <div className="grid cols-2">
        <div className="card">
          <h3>הזמנת דוח חדש</h3>
          <form action={orderReport}>
            <div className="field">
              <label>סוג דוח</label>
              <select name="report_type" required>
                {REPORT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label} — ₪{t.price}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>מספר רישוי (אופציונלי)</label>
              <input name="license_plate" dir="ltr" placeholder="123-45-678" />
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>שם פרטי</label>
                <input name="first_name" required defaultValue={profile?.full_name?.split(' ')[0] || ''} />
              </div>
              <div className="field">
                <label>שם משפחה</label>
                <input name="last_name" required defaultValue={profile?.full_name?.split(' ').slice(1).join(' ') || ''} />
              </div>
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>טלפון</label>
                <input name="phone" type="tel" required defaultValue={profile?.phone || ''} dir="ltr" />
              </div>
              <div className="field">
                <label>דוא״ל</label>
                <input name="email" type="email" required defaultValue={user.email || ''} dir="ltr" />
              </div>
            </div>
            <div className="field">
              <label>מדינה</label>
              <select name="country" required defaultValue="IL">
                <option value="IL">ישראל</option>
              </select>
            </div>
            <div className="field row" style={{ gap: 8 }}>
              <input type="checkbox" name="use_credits" id="use_credits" style={{ width: 'auto' }} />
              <label htmlFor="use_credits" style={{ margin: 0 }}>
                לשלם מיתרת הקרדיטים (₪{Number(profile?.credits || 0).toLocaleString()} זמין)
              </label>
            </div>
            <div className="field row" style={{ gap: 8 }}>
              <input type="checkbox" name="agree_terms" id="agree_terms" required style={{ width: 'auto' }} />
              <label htmlFor="agree_terms" style={{ margin: 0, fontSize: 13 }}>
                קראתי ואני מסכים ל<a href="/terms" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>תנאי השימוש</a> ול<a href="/privacy" target="_blank" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>מדיניות הפרטיות</a>
              </label>
            </div>
            <button className="btn" type="submit">הזמנת דוח</button>
          </form>
        </div>

        <div className="card">
          <h3>יתרת קרדיטים — ₪{Number(profile?.credits || 0).toLocaleString()}</h3>
          <a href="/wallet" style={{ display: 'inline-block', marginBottom: 12, color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>💳 טעינת קרדיטים →</a>
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
                  // Build Grow payment link for awaiting_payment orders
                  let payUrl = null;
                  if (o.status === 'awaiting_payment') {
                    payUrl = buildPaymentUrl({
                      amount: o.amount,
                      description: `דרסו — ${o.report_type}`,
                      userId: user.id,
                      orderId: o.id,
                      successUrl: `${baseUrl}/reports?ok=${encodeURIComponent('התשלום התקבל! הדוח יוכן בהקדם ✓')}`,
                      cancelUrl: `${baseUrl}/reports`,
                      payerEmail: user.email,
                      payerPhone: profile?.phone,
                      payerName: profile?.full_name,
                    });
                  }
                  return (
                    <tr key={o.id}>
                      <td>{o.report_type}</td>
                      <td dir="ltr">{o.license_plate || '—'}</td>
                      <td>₪{Number(o.amount).toLocaleString()}{o.paid_with_credits ? ' (קרדיטים)' : ''}</td>
                      <td><span className={`badge ${o.status}`}>{statusLabel[o.status]}</span></td>
                      <td className="muted">{new Date(o.created_at).toLocaleDateString('he-IL')}</td>
                      <td>
                        {o.file_url && <a href={o.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>הורדת דוח</a>}
                        {o.status === 'awaiting_payment' && payUrl && (
                          <a href={payUrl} className="btn small" style={{ textDecoration: 'none' }}>💳 לתשלום</a>
                        )}
                        {o.status === 'awaiting_payment' && !payUrl && (
                          <span className="muted" style={{ fontSize: 12 }}>ניצור קשר עם פרטי תשלום</span>
                        )}
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
