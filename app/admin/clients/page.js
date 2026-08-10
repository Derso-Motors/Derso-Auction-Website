import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

async function grantCredits(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const amount = Number(formData.get('amount'));
  const P = '/admin/clients';
  if (!Number.isFinite(amount) || amount === 0) redirect(P + '?err=' + encodeURIComponent('סכום לא תקין'));
  const { data: p, error: pErr } = await supabase.from('profiles').select('credits').eq('id', clientId).single();
  if (pErr) redirect(P + '?err=' + encodeURIComponent('שגיאה בטעינת פרטי הלקוח'));
  const { error: updErr } = await supabase.from('profiles').update({ credits: Number(p?.credits || 0) + amount }).eq('id', clientId);
  if (updErr) redirect(P + '?err=' + encodeURIComponent('הזיכוי נכשל'));
  const { error: txErr } = await supabase.from('credit_transactions').insert({
    client_id: clientId, amount, reason: formData.get('reason') || 'זיכוי ידני',
  });
  if (txErr) redirect(P + '?err=' + encodeURIComponent('הזיכוי בוצע אך רישום התנועה נכשל'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent(`זוכו ₪${amount.toLocaleString()} ✓`));
}

async function deleteClient(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const P = '/admin/clients';
  const carIds = (await supabase.from('cars').select('id').eq('client_id', id)).data?.map(c => c.id) || [];
  const listIds = (await supabase.from('recommendation_lists').select('id').eq('client_id', id)).data?.map(l => l.id) || [];
  const results = [
    await supabase.from('messages').delete().eq('client_id', id),
    await supabase.from('car_updates').delete().in('car_id', carIds),
    await supabase.from('car_stages').delete().in('car_id', carIds),
    await supabase.from('cars').delete().eq('client_id', id),
    await supabase.from('recommended_cars').delete().in('list_id', listIds),
    await supabase.from('recommendation_lists').delete().eq('client_id', id),
    await supabase.from('report_orders').delete().eq('client_id', id),
    await supabase.from('credit_transactions').delete().eq('client_id', id),
    await supabase.from('meetings').delete().eq('client_id', id),
  ];
  if (results.some(r => r.error)) redirect(P + '?err=' + encodeURIComponent('מחיקת הנתונים המשויכים נכשלה — הלקוח לא נמחק'));
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) redirect(P + '?err=' + encodeURIComponent('מחיקת הלקוח נכשלה'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('הלקוח נמחק ✓'));
}

export default async function ClientsPage() {
  const supabase = await requireAdmin();

  const { data: clients } = await supabase.from('profiles').select('id, full_name, phone, role, credits, created_at').order('created_at', { ascending: false }).limit(200);
  const clientOptions = (clients || []).filter((c) => c.role === 'client');

  return (
    <Shell active="clients">
      <div className="page-title">לקוחות</div>
      <div className="page-sub">ניהול לקוחות וקרדיטים</div>

      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>כל הלקוחות</h3>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>שם</th><th>טלפון</th><th>תפקיד</th><th>קרדיטים</th><th>הצטרפות</th><th></th><th></th></tr></thead>
                <tbody>
                  {clients?.map((c) => (
                    <tr key={c.id}>
                      <td>{c.full_name || '—'}</td>
                      <td dir="ltr">{c.phone || '—'}</td>
                      <td>{c.role === 'admin' ? 'מנהל' : 'לקוח'}</td>
                      <td>₪{Number(c.credits).toLocaleString()}</td>
                      <td className="muted">{new Date(c.created_at).toLocaleDateString('he-IL')}</td>
                      <td><Link href="/admin/messages" style={{ color: 'var(--accent)' }}>צ׳אט</Link></td>
                      <td>
                        {c.role !== 'admin' && (
                          <form action={deleteClient}>
                            <input type="hidden" name="id" value={c.id} />
                            <DeleteButton title="מחיקת לקוח" />
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="admin-col-left">
          <div className="card">
            <h3>זיכוי קרדיטים</h3>
            <form action={grantCredits}>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id" required>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id} (₪{Number(c.credits).toLocaleString()})</option>)}
                </select>
              </div>
              <div className="grid cols-2">
                <div className="field"><label>סכום ₪</label><input name="amount" type="number" required /></div>
                <div className="field"><label>סיבה</label><input name="reason" placeholder="זיכוי ידני" /></div>
              </div>
              <SubmitButton className="btn small">זיכוי</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
