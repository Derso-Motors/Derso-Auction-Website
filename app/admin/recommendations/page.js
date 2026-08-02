import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

async function addRecommendationList(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('recommendation_lists').insert({
    client_id: formData.get('client_id'),
    title: formData.get('title') || 'רכבים מומלצים',
  });
  revalidatePath('/admin/recommendations');
}

async function addRecommendedCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('recommended_cars').insert({
    list_id: formData.get('list_id'),
    title: formData.get('title'),
    year: formData.get('year') ? Number(formData.get('year')) : null,
    km: formData.get('km') ? Number(formData.get('km')) : null,
    est_price: formData.get('est_price') ? Number(formData.get('est_price')) : null,
    list_price: formData.get('list_price') ? Number(formData.get('list_price')) : null,
    auction_link: formData.get('auction_link') || null,
    image_url: formData.get('image_url') || null,
    notes: formData.get('notes') || null,
  });
  revalidatePath('/admin/recommendations');
}

async function deleteRecommendationList(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  await supabase.from('recommended_cars').delete().eq('list_id', id);
  await supabase.from('recommendation_lists').delete().eq('id', id);
  revalidatePath('/admin/recommendations');
}

export default async function RecommendationsPage() {
  const supabase = await requireAdmin();

  const [{ data: lists }, { data: clients }] = await Promise.all([
    supabase.from('recommendation_lists').select('*, profiles(full_name), recommended_cars(id, title, client_interest)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role').eq('role', 'client').order('full_name'),
  ]);

  const clientOptions = clients || [];

  return (
    <Shell active="recommendations">
      <div className="page-title">רשימות המלצות</div>
      <div className="page-sub">ניהול רשימות המלצות לשיחות איפיון</div>

      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>כל הרשימות</h3>
            {!lists?.length && <div className="empty">אין רשימות</div>}
            {lists?.map((l) => (
              <div key={l.id} className="side-item">
                <div className="side-item-content">
                  <b>{l.title}</b> <span className="muted">— {l.profiles?.full_name}</span>
                  <div className="muted">{(l.recommended_cars || []).length} רכבים · {(l.recommended_cars || []).filter((rc) => rc.client_interest === 'interested').length} מעניינים</div>
                </div>
                <div className="side-item-actions">
                  <span className="muted" dir="ltr" style={{ fontSize: 12 }}>/r/{l.share_token}</span>
                  <form action={deleteRecommendationList}>
                    <input type="hidden" name="id" value={l.id} />
                    <DeleteButton title="מחיקה" />
                  </form>
                </div>
              </div>
            ))}
            {lists?.map((l) => (
              <details key={`detail-${l.id}`} style={{ marginTop: 8 }}>
                <summary className="muted" style={{ cursor: 'pointer' }}>הוספת רכב לרשימה "{l.title}"</summary>
                <form action={addRecommendedCar} style={{ marginTop: 10 }}>
                  <input type="hidden" name="list_id" value={l.id} />
                  <div className="grid cols-2">
                    <div className="field"><label>שם הרכב</label><input name="title" required /></div>
                    <div className="field"><label>שנתון</label><input name="year" type="number" /></div>
                    <div className="field"><label>ק"מ</label><input name="km" type="number" /></div>
                    <div className="field"><label>מחיר מחירון</label><input name="list_price" type="number" /></div>
                    <div className="field"><label>מחיר משוער</label><input name="est_price" type="number" /></div>
                    <div className="field"><label>קישור מכרז</label><input name="auction_link" dir="ltr" /></div>
                    <div className="field"><label>קישור תמונה</label><input name="image_url" dir="ltr" /></div>
                    <div className="field"><label>הערות</label><input name="notes" /></div>
                  </div>
                  <SubmitButton className="btn small">הוספה</SubmitButton>
                </form>
              </details>
            ))}
          </div>
        </div>

        <div className="admin-col-left">
          <div className="card">
            <h3>יצירת רשימה חדשה</h3>
            <form action={addRecommendationList}>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id" required>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
                </select>
              </div>
              <div className="field"><label>שם הרשימה</label><input name="title" placeholder="רכבים מומלצים" /></div>
              <SubmitButton className="btn">יצירת רשימה</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
