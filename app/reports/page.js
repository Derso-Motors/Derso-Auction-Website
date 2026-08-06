import { SubmitButton } from '../../components/SubmitButton';
import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const REPORT_TYPES = [
  { key: 'history', label: 'דוח היסטוריה (בעלויות, תאונות, שעבודים)', price: 149 },
  { key: 'mechanical', label: 'בדיקה מכנית מלאה לפני מכרז', price: 490 },
  { key: 'valuation', label: 'הערכת שווי ומחירון מדויק', price: 99 },
];

async function orderReport(formData) {
  'use server';
  const { supabase } = await requireUser();
  const P = '/reports';
  const type = REPORT_TYPES.find((t) => t.key === formData.get('report_type'));
  if (!type) redirect(P + '?err=' + encodeURIComponent('סוג דוח לא תקין'));

  const useCredits = formData.get('use_credits') === 'on';

  // Atomic: deducts credits (when covered) and inserts the order in one
  // transaction. A failed insert rolls back the deduction — no manual refund.
  const { data: status, error } = await supabase.rpc('order_report', {
    p_report_type: type.label,
    p_license_plate: formData.get('license_plate') || '',
    p_amount: type.price,
    p_use_credits: useCredits,
  });

  if (error) redirect(P + '?err=' + encodeURIComponent('הזמנת הדוח נכשלה — לא בוצע חיוב, נסו שוב'));

  revalidatePath(P);
  if (status === 'paid') {
    redirect(P + '?ok=' + encodeURIComponent(`הדוח הוזמן ושולם בקרדיטים (₪${type.price}) ✓`));
  }
  redirect(P + '?ok=' + encodeURIComponent(useCredits
    ? 'הדוח הוזמן — היתרה לא מספיקה לחיוב בקרדיטים, ההזמנה ממתינה לתשלום'
    : 'הדוח הוזמן — ממתין לתשלום, ניצור קשר עם פרטי סליקה'));
}

export default async function ReportsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: orders }, { data: txns }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('report_orders').select('*').eq('client_id', user.id).order('created_at', { ascending: false }),
    supabase.from('credit_transactions').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

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
            <div className="field row" style={{ gap: 8 }}>
              <input type="checkbox" name="use_credits" id="use_credits" style={{ width: 'auto' }} />
              <label htmlFor="use_credits" style={{ margin: 0 }}>
                לשלם מיתרת הקרדיטים (₪{Number(profile?.credits || 0).toLocaleString()} זמין)
              </label>
            </div>
            <SubmitButton className="btn" style={{ width: '100%' }}>הזמנת דוח</SubmitButton>
            <div className="muted" style={{ marginTop: 10 }}>
              הזמנה ללא קרדיטים תקבל סטטוס "ממתין לתשלום" — ניצור קשר עם פרטי סליקה מאובטחים.
            </div>
          </form>
        </div>

        <div className="card">
          <h3>יתרת קרדיטים — ₪{Number(profile?.credits || 0).toLocaleString()}</h3>
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
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.report_type}</td>
                    <td dir="ltr">{o.license_plate || '—'}</td>
                    <td>₪{Number(o.amount).toLocaleString()}{o.paid_with_credits ? ' (קרדיטים)' : ''}</td>
                    <td><span className={`badge ${o.status}`}>{statusLabel[o.status]}</span></td>
                    <td className="muted">{new Date(o.created_at).toLocaleDateString('he-IL')}</td>
                    <td>{o.file_url && <a href={o.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>הורדת דוח</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
