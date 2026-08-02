import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { timeAgo } from '../../../lib/utils';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = ['awaiting_payment', 'paid', 'delivered', 'cancelled'];

async function deleteOrder(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  await supabase.from('report_orders').delete().eq('id', formData.get('id'));
  revalidatePath('/admin/orders');
}

async function updateOrderStatus(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  const status = formData.get('status');
  if (!ALLOWED_STATUSES.includes(status)) return;
  const patch = { status };
  const fileUrl = formData.get('file_url');
  if (fileUrl) {
    if (!fileUrl.startsWith('https://')) return;
    patch.file_url = fileUrl;
  }
  await supabase.from('report_orders').update(patch).eq('id', formData.get('order_id'));
  revalidatePath('/admin/orders');
}

export default async function OrdersListPage() {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');

  const { data: orders } = await supabase
    .from('report_orders')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false });

  const statusLabel = { awaiting_payment: 'ממתין לתשלום', paid: 'שולם', delivered: 'נמסר', cancelled: 'בוטל' };

  return (
    <Shell active="orders">
      <div className="page-title">כל הזמנות הדוחות</div>
      <div className="page-sub">היסטוריית הזמנות דוחות מלאה</div>
      <div className="card">
        {!orders?.length && <div className="empty">אין הזמנות</div>}
        {orders?.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>לקוח</th><th>דוח</th><th>סכום</th><th>סטטוס</th><th>לפני</th><th>עדכון</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.profiles?.full_name || '—'}</td>
                    <td>{o.report_type}</td>
                    <td>₪{Number(o.amount).toLocaleString()}</td>
                    <td><span className={`badge ${o.status}`}>{statusLabel[o.status] || o.status}</span></td>
                    <td className="muted">{timeAgo(o.created_at)}</td>
                    <td>
                      <form action={updateOrderStatus} className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <input type="hidden" name="order_id" value={o.id} />
                        <select name="status" defaultValue={o.status} style={{ width: 140 }}>
                          <option value="awaiting_payment">ממתין לתשלום</option>
                          <option value="paid">שולם</option>
                          <option value="delivered">נמסר</option>
                          <option value="cancelled">בוטל</option>
                        </select>
                        <input name="file_url" placeholder="קובץ דוח" dir="ltr" style={{ width: 140 }} />
                        <SubmitButton className="btn small secondary">עדכון</SubmitButton>
                      </form>
                    </td>
                    <td>
                      <form action={deleteOrder}>
                        <input type="hidden" name="id" value={o.id} />
                        <DeleteButton title="מחיקה" />
                      </form>
                    </td>
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
