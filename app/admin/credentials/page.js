import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireAdmin } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import CopyButton from './CopyButton';

export const dynamic = 'force-dynamic';

const P = '/admin/credentials';

async function upsertCred(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const clientId = formData.get('client_id');
  const platform = formData.get('platform') || 'bidspirit';
  const username = formData.get('username')?.trim();
  const password = formData.get('password')?.trim();
  const notes = formData.get('notes')?.trim() || null;

  if (!clientId || !username || !password) {
    redirect(P + '?err=' + encodeURIComponent('חסרים שדות חובה'));
  }

  const { error } = await supabase.from('client_credentials').upsert(
    { client_id: clientId, platform, username, password, notes, updated_at: new Date().toISOString() },
    { onConflict: 'client_id,platform' }
  );
  if (error) redirect(P + '?err=' + encodeURIComponent('השמירה נכשלה: ' + error.message));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('פרטי ההתחברות נשמרו ✓'));
}

async function deleteCred(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const id = formData.get('id');
  const { error } = await supabase.from('client_credentials').delete().eq('id', id);
  if (error) redirect(P + '?err=' + encodeURIComponent('המחיקה נכשלה'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('נמחק ✓'));
}

export default async function CredentialsPage() {
  const { supabase } = await requireAdmin();

  const { data: clients } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role')
    .eq('role', 'client')
    .order('full_name');

  const { data: creds } = await supabase
    .from('client_credentials')
    .select('id, client_id, platform, username, password, notes, updated_at, profiles(full_name, phone)')
    .order('updated_at', { ascending: false });

  return (
    <Shell active="credentials">
      <div className="page-title">משתמשים ללקוחות</div>
      <div className="page-sub">ניהול פרטי התחברות ל-BidSpirit ופלטפורמות מכרזים — הלקוח רואה את הפרטים שלו באפליקציה</div>

      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>כל המשתמשים</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>לקוח</th>
                    <th>פלטפורמה</th>
                    <th>שם משתמש</th>
                    <th>סיסמה</th>
                    <th>הערות</th>
                    <th>עדכון</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(!creds || creds.length === 0) && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--fg3)' }}>עוד לא הוזנו פרטי התחברות</td></tr>
                  )}
                  {creds?.map((c) => (
                    <tr key={c.id}>
                      <td>{c.profiles?.full_name || '—'}</td>
                      <td><span className="badge">{c.platform}</span></td>
                      <td>
                        <span dir="ltr" style={{ fontFamily: 'monospace', userSelect: 'all' }}>{c.username}</span>
                        <CopyButton value={c.username} label="שם משתמש" />
                      </td>
                      <td>
                        <span dir="ltr" style={{ fontFamily: 'monospace', userSelect: 'all' }}>{c.password}</span>
                        <CopyButton value={c.password} label="סיסמה" />
                      </td>
                      <td className="muted">{c.notes || '—'}</td>
                      <td className="muted">{new Date(c.updated_at).toLocaleDateString('he-IL')}</td>
                      <td>
                        <form action={deleteCred}>
                          <input type="hidden" name="id" value={c.id} />
                          <DeleteButton title="מחיקת פרטי התחברות" />
                        </form>
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
            <h3>הוספה / עדכון פרטי התחברות</h3>
            <form action={upsertCred}>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id" required>
                  <option value="">בחר לקוח...</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name || c.phone || c.id}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>פלטפורמה</label>
                <select name="platform">
                  <option value="bidspirit">BidSpirit</option>
                  <option value="copart">Copart</option>
                  <option value="other">אחר</option>
                </select>
              </div>
              <div className="grid cols-2">
                <div className="field">
                  <label>שם משתמש / אימייל</label>
                  <input name="username" required placeholder="user@example.com" dir="ltr" />
                </div>
                <div className="field">
                  <label>סיסמה</label>
                  <input name="password" required placeholder="••••••" dir="ltr" />
                </div>
              </div>
              <div className="field">
                <label>הערות (אופציונלי)</label>
                <input name="notes" placeholder="למשל: נפתח ב-10/08" />
              </div>
              <SubmitButton className="btn small">שמור</SubmitButton>
            </form>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--fg3)' }}>
              💡 אם הלקוח כבר קיים, העדכון ידרוס את הפרטים הקודמים באותה פלטפורמה.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
