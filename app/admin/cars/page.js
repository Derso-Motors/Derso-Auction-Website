import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { timeAgo } from '../../../lib/utils';
import BidspiritLinkFill from '../../../components/BidspiritLinkFill';
import { sendWhatsApp } from '../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

const STAGES = ['זכייה במכרז', 'תשלום למכרז', 'שחרור הרכב', 'העברת בעלות', 'שינוע הרכב', 'מסירה ללקוח'];

const P = '/admin/cars';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

async function addCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const { error } = await supabase.from('cars').insert({
    client_id: clientId === '__walk_in__' ? null : clientId,
    client_name: clientId === '__walk_in__' ? (formData.get('client_name') || 'לקוח חד-פעמי') : null,
    client_phone: clientId === '__walk_in__' ? (formData.get('client_phone') || null) : null,
    title: formData.get('title'),
    year: formData.get('year') ? Number(formData.get('year')) : null,
    km: formData.get('km') ? Number(formData.get('km')) : null,
    license_plate: formData.get('license_plate') || null,
    auction_link: formData.get('auction_link') || null,
    image_url: formData.get('image_url') || null,
    won_price: formData.get('won_price') ? Number(formData.get('won_price')) : null,
  });
  if (error) redirect(P + '?err=' + encodeURIComponent('הוספת הרכב נכשלה'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('הרכב נוסף ✓'));
}

async function advanceStage(formData) {
  'use server';
  const supabase = await requireAdmin();
  const carId = formData.get('car_id');
  const step = Number(formData.get('step_number'));
  const note = formData.get('note');

  const { error: doneErr } = await supabase.from('car_stages').update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('car_id', carId).lte('step_number', step);
  if (doneErr) redirect(P + '?err=' + encodeURIComponent('עדכון השלב נכשל'));
  const { error: progErr } = await supabase.from('car_stages').update({ status: 'in_progress' })
    .eq('car_id', carId).eq('step_number', step + 1);
  if (progErr) redirect(P + '?err=' + encodeURIComponent('עדכון השלב הבא נכשל'));
  const { error: carErr } = await supabase.from('cars').update({ current_stage: step + 1 }).eq('id', carId);
  if (carErr) redirect(P + '?err=' + encodeURIComponent('עדכון הרכב נכשל'));

  const { data: { user } } = await supabase.auth.getUser();
  const { data: stage } = await supabase.from('car_stages').select('title').eq('car_id', carId).eq('step_number', step).single();
  const { error: updErr } = await supabase.from('car_updates').insert({
    car_id: carId,
    author_id: user.id,
    stage_number: step,
    body: note?.trim() ? note.trim() : `השלב "${stage?.title}" הושלם`,
  });
  if (updErr) redirect(P + '?err=' + encodeURIComponent('רישום העדכון נכשל'));

  const { data: car } = await supabase.from('cars').select('title, client_id, client_phone, profiles(full_name, phone)').eq('id', carId).single();
  const phone = car?.profiles?.phone || car?.client_phone;
  const name = car?.profiles?.full_name || '';
  if (phone) {
    const msg = `שלום ${name},\nעדכון לגבי הרכב ${car?.title}:\n✅ השלב "${stage?.title}" הושלם בהצלחה.${note?.trim() ? `\n📝 ${note.trim()}` : ''}\n\nדרסו — בית ליווי מקצועי למכרזים`;
    await sendWhatsApp(phone, msg);
  }

  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent(`השלב "${stage?.title}" הושלם ✓`));
}

async function postUpdate(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('car_updates').insert({
    car_id: formData.get('car_id'),
    author_id: user.id,
    body: formData.get('body'),
  });
  if (error) redirect(P + '?err=' + encodeURIComponent('פרסום העדכון נכשל'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('העדכון פורסם ✓'));
}

async function deleteCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const { error: updDelErr } = await supabase.from('car_updates').delete().eq('car_id', id);
  if (updDelErr) redirect(P + '?err=' + encodeURIComponent('מחיקת הרכב נכשלה'));
  const { error: stgDelErr } = await supabase.from('car_stages').delete().eq('car_id', id);
  if (stgDelErr) redirect(P + '?err=' + encodeURIComponent('מחיקת הרכב נכשלה'));
  const { error } = await supabase.from('cars').delete().eq('id', id);
  if (error) redirect(P + '?err=' + encodeURIComponent('מחיקת הרכב נכשלה'));
  revalidatePath(P);
  redirect(P + '?ok=' + encodeURIComponent('הרכב נמחק ✓'));
}

export default async function CarsPage() {
  const supabase = await requireAdmin();

  const [{ data: cars }, { data: clients }] = await Promise.all([
    supabase.from('cars').select('*, car_stages(*), profiles(full_name), client_name, client_phone').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role').eq('role', 'client').order('full_name'),
  ]);

  const clientOptions = clients || [];

  return (
    <Shell active="cars">
      <div className="page-title">רכבים</div>
      <div className="page-sub">ניהול רכבים, שלבים ועדכונים</div>

      <div className="admin-desktop-layout">
        <div className="admin-col-right">
          <div className="card">
            <h3>רכבים בתהליך</h3>
            {!cars?.length && <div className="empty">אין רכבים</div>}
            {cars?.map((car) => {
              const stages = (car.car_stages || []).sort((a, b) => a.step_number - b.step_number);
              const done = stages.filter((s) => s.status === 'done').length;
              const nextStep = done < 6 ? done : null;
              return (
                <div key={car.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{car.title}</b> <span className="muted">— {car.profiles?.full_name || car.client_name || 'ללא לקוח'}{car.client_phone ? ` (${car.client_phone})` : ''}</span>
                      <div className="muted">{done}/6 שלבים הושלמו {done < 6 ? `· הבא: ${stages[done]?.title}` : '· הושלם'}</div>
                      {car.won_price && <div className="muted" style={{ fontSize: 12 }}>₪{Number(car.won_price).toLocaleString()}</div>}
                    </div>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
                      {nextStep !== null && (
                        <form action={advanceStage} className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <input type="hidden" name="car_id" value={car.id} />
                          <input type="hidden" name="step_number" value={done} />
                          <input name="note" placeholder="הערה (אופציונלי)" style={{ width: 160 }} />
                          <SubmitButton className="btn small">סיום שלב: {stages[done]?.title}</SubmitButton>
                        </form>
                      )}
                      <form action={deleteCar}>
                        <input type="hidden" name="id" value={car.id} />
                        <DeleteButton title="מחיקת רכב" />
                      </form>
                    </div>
                  </div>
                  <form action={postUpdate} className="row" style={{ marginTop: 8, gap: 6 }}>
                    <input type="hidden" name="car_id" value={car.id} />
                    <input name="body" placeholder="פרסום עדכון חופשי ללקוח..." required style={{ flex: 1 }} />
                    <SubmitButton className="btn small secondary">פרסום עדכון</SubmitButton>
                  </form>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-col-left">
          <div className="card">
            <h3>הוספת רכב שנזכה</h3>
            <form action={addCar}>
              <div className="field">
                <label>לקוח</label>
                <select name="client_id" required>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
                  <option value="__walk_in__">+ לקוח חד-פעמי (לא רשום)</option>
                </select>
              </div>
              <div className="field"><label>שם לקוח (ללא רשום)</label><input name="client_name" placeholder="שם הלקוח" /></div>
              <div className="field"><label>טלפון</label><input name="client_phone" placeholder="050-1234567" dir="ltr" /></div>
              <div className="field"><label>שם הרכב</label><input name="title" required placeholder="סקודה אוקטביה 2021" /></div>
              <div className="grid cols-2">
                <div className="field"><label>שנתון</label><input name="year" type="number" /></div>
                <div className="field"><label>ק"מ</label><input name="km" type="number" /></div>
              </div>
              <div className="grid cols-2">
                <div className="field"><label>מספר רישוי</label><input name="license_plate" dir="ltr" /></div>
                <div className="field"><label>מחיר זכייה</label><input name="won_price" type="number" /></div>
              </div>
              <div className="field"><label>קישור מכרז</label><input name="auction_link" dir="ltr" /></div>
              <div className="field"><label>קישור תמונה</label><input name="image_url" dir="ltr" /></div>
              <BidspiritLinkFill map={{ title: 'title', year: 'year', km: 'km', license_plate: 'license_plate', image_url: 'image_url' }} />
              <SubmitButton className="btn">הוספת רכב</SubmitButton>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
