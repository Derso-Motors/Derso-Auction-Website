import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sendWhatsApp } from '../../../lib/whatsapp';
import BidspiritLinkFill from '../../../components/BidspiritLinkFill';

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
  const clientId = formData.get('client_id');
  const title = formData.get('title') || 'רכבים מומלצים';
  const { data: inserted, error } = await supabase.from('recommendation_lists').insert({
    client_id: clientId,
    title,
  }).select('share_token').single();
  if (error) redirect('/admin/recommendations?err=' + encodeURIComponent('יצירת הרשימה נכשלה'));

  if (clientId && inserted?.share_token) {
    const { data: profile } = await supabase.from('profiles').select('phone, full_name').eq('id', clientId).single();
    if (profile?.phone) {
      const msg = `שלום ${profile.full_name || ''},\nהוכנה עבורך רשימת ${title} 🚗\nלצפייה: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://derso.co.il'}/r/${inserted.share_token}\n\nדרסו — בית ליווי מקצועי למכרזים`;
      await sendWhatsApp(profile.phone, msg);
    }
  }

  revalidatePath('/admin/recommendations');
  redirect('/admin/recommendations?ok=' + encodeURIComponent('הרשימה נוצרה ✓'));
}

async function addRecommendedCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('recommended_cars').insert({
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
  if (error) redirect('/admin/recommendations?err=' + encodeURIComponent('הוספת הרכב נכשלה'));
  revalidatePath('/admin/recommendations');
  redirect('/admin/recommendations?ok=' + encodeURIComponent('הרכב נוסף ✓'));
}

async function deleteRecommendationList(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const { error: carsError } = await supabase.from('recommended_cars').delete().eq('list_id', id);
  if (carsError) redirect('/admin/recommendations?err=' + encodeURIComponent('מחיקת הרשימה נכשלה'));
  const { error } = await supabase.from('recommendation_lists').delete().eq('id', id);
  if (error) redirect('/admin/recommendations?err=' + encodeURIComponent('מחיקת הרשימה נכשלה'));
  revalidatePath('/admin/recommendations');
  redirect('/admin/recommendations?ok=' + encodeURIComponent('הרשימה נמחקה ✓'));
}

async function deleteRecommendedCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('recommended_cars').delete().eq('id', formData.get('id'));
  if (error) redirect('/admin/recommendations?err=' + encodeURIComponent('מחיקת הרכב נכשלה'));
  revalidatePath('/admin/recommendations');
  redirect('/admin/recommendations?ok=' + encodeURIComponent('הרכב נמחק ✓'));
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
              <div key={l.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{l.title}</b> <span className="muted">— {l.profiles?.full_name}</span>
                    <div className="muted">
                      {(l.recommended_cars || []).length} רכבים ·
                      {' '}{(l.recommended_cars || []).filter((rc) => rc.client_interest === 'interested').length} מסומנים כמעניינים
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <span className="muted" dir="ltr" style={{ fontSize: 12.5 }}>/r/{l.share_token}</span>
                    <form action={deleteRecommendationList}>
                      <input type="hidden" name="id" value={l.id} />
                      <DeleteButton title="מחיקת רשימה" />
                    </form>
                  </div>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary className="muted" style={{ cursor: 'pointer' }}>הוספת רכב לרשימה</summary>
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
                      <BidspiritLinkFill map={{ title: 'title', year: 'year', km: 'km', list_price: 'list_price', image_url: 'image_url' }} />
                      <div className="field"><label>הערות</label><input name="notes" /></div>
                    </div>
                    <SubmitButton className="btn small">הוספה</SubmitButton>
                  </form>
                </details>
              </div>
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
