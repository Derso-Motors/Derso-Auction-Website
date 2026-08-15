import Shell from '../../components/Shell';
import { SubmitButton } from '../../components/SubmitButton';
import { requireUser } from '../../lib/supabase-server';
import { GROW_BROADCAST_SUB_LINK, GROW_AI_SUB_LINK, growLinkWithParams } from '../../lib/grow';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PayPopup from '../../components/PayPopup';

export const dynamic = 'force-dynamic';

async function saveCriteria(formData) {
  'use server';
  const { supabase, user } = await requireUser();
  const crit = {
    car_type: String(formData.get('car_type') || '').trim(),
    year: String(formData.get('year') || '').trim(),
    budget: String(formData.get('budget') || '').trim(),
    max_km: String(formData.get('max_km') || '').trim(),
  };
  const fullName = String(formData.get('full_name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const updates = { search_criteria: crit };
  if (fullName) updates.full_name = fullName;
  if (phone) updates.phone = phone;
  await supabase.from('profiles').update(updates).eq('id', user.id);
  revalidatePath('/subscriptions');
  redirect('/subscriptions?ok=' + encodeURIComponent('הקריטריונים עודכנו — מהיום נחפש לפי זה ✓'));
}

export default async function MyBroadcastPage({ searchParams }) {
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: bsub }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('broadcast_subscribers').select('active, paid_until').eq('client_id', user.id).eq('active', true).maybeSingle(),
  ]);

  const subscribed = !!bsub;
  const crit = profile?.search_criteria || {};

  const broadcastPayUrl = GROW_BROADCAST_SUB_LINK
    ? growLinkWithParams(GROW_BROADCAST_SUB_LINK, { userId: user.id, custom2: 'sub_broadcast' })
    : null;
  const aiPayUrl = GROW_AI_SUB_LINK
    ? growLinkWithParams(GROW_AI_SUB_LINK, { userId: user.id, custom2: 'sub_ai' })
    : null;

  return (
    <Shell active="subscriptions">
      <div className="page-title">📡 השידור שלי</div>
      <div className="page-sub">הבוט של דרסו סורק כל יום את כל המכרזים בארץ — ושולח לך לוואטסאפ רק רכבים שעונים בדיוק על מה שאתה מחפש</div>

      {searchParams?.err && <div className="error-msg">{searchParams.err}</div>}
      {searchParams?.ok && !searchParams?.err && <div className="info-msg">{searchParams.ok}</div>}

      {subscribed ? (
        <>
          <div className="card" style={{ borderColor: 'var(--success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="badge paid">✓ מנוי שידור פעיל</span>
              {bsub?.paid_until && (
                <span className="muted" style={{ fontSize: 13 }}>בתוקף עד {new Date(bsub.paid_until).toLocaleDateString('he-IL')}</span>
              )}
            </div>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
              הבוט שלנו עובד בשבילך מסביב לשעון: סורק את כל המכרזים, מסנן לפי הקריטריונים שלך למטה, ושולח לך התאמות ישירות לוואטסאפ — בנוחות, בלי שתצטרך לחפש בעצמך.
            </p>
          </div>

          <div className="card">
            <h3>🔎 מה אני מחפש</h3>
            <p className="muted" style={{ fontSize: 13 }}>עדכן מתי שתרצה — החיפוש היומי מתעדכן מיידית.</p>
            <form action={saveCriteria}>
              <div className="grid cols-2">
                <div className="field"><label>שם מלא</label><input name="full_name" defaultValue={profile?.full_name || ''} placeholder="ישראל ישראלי" /></div>
                <div className="field"><label>מספר טלפון (לוואטסאפ)</label><input name="phone" dir="ltr" defaultValue={profile?.phone || ''} placeholder="050-1234567" /></div>
                <div className="field"><label>סוג רכב</label><input name="car_type" defaultValue={crit.car_type || ''} placeholder="למשל: טויוטה קורולה, יונדאי i20" /></div>
                <div className="field"><label>שנתון (מ־)</label><input name="year" defaultValue={crit.year || ''} placeholder="למשל: 2019" /></div>
                <div className="field"><label>תקציב (₪)</label><input name="budget" defaultValue={crit.budget || ''} placeholder="למשל: 90,000" /></div>
                <div className="field"><label>מקסימום ק"מ</label><input name="max_km" defaultValue={crit.max_km || ''} placeholder="למשל: 120,000" /></div>
              </div>
              <SubmitButton className="btn" style={{ width: '100%' }}>שמירת הקריטריונים</SubmitButton>
            </form>
          </div>

          <div className="card">
            <h3>🤖 שדרוג: עוזר אישי AI — ₪15 לחודש</h3>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              עוזר חכם שזמין לך 24/7 באתר: עונה על שאלות, משווה בין הרכבים שקיבלת בשידור, ומלווה אותך עד לזכייה. תוספת קטנה — יתרון גדול ביום המכרז.
            </p>
            {profile?.ai_assistant_active ? (
              <span className="badge paid">✓ פעיל</span>
            ) : aiPayUrl ? (
              <PayPopup url={aiPayUrl} className="btn" style={{ display: 'block', textAlign: 'center' }}>הפעלת העוזר — ₪15/חודש</PayPopup>
            ) : (
              <Link href="/messages" className="btn secondary" style={{ display: 'block', textAlign: 'center' }}>לשדרוג — דברו איתנו בצ'אט</Link>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>📡</div>
            <h3 style={{ fontSize: 22, marginBottom: 10 }}>שירות השידור של דרסו — למנויים בלבד</h3>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 560, margin: '0 auto 18px' }}>
              במקום לבזבז שעות בחיפושים — הבוט החכם שלנו סורק <b>כל יום</b> את כל מכרזי הרכב בארץ,
              מצליב מול הקריטריונים המדויקים שלך (סוג רכב, שנתון, תקציב, ק"מ), ושולח לך
              ישירות לוואטסאפ רק רכבים שבאמת רלוונטיים. אתה מקבל את ההזדמנויות לפני כולם — בנוחות מלאה.
            </p>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 16, color: 'var(--muted-dim)', textDecoration: 'line-through' }}>₪50</span>
              <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent)', marginRight: 8 }}>₪30</span>
              <span style={{ fontSize: 15, color: 'var(--muted-dim)' }}> / לחודש</span>
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 18 }}>מבצע השקה · 30 ימי ניסיון חינם · ביטול בכל עת</div>
            <a href="https://mrng.to/3Y2t6W584l" target="_blank" rel="noopener noreferrer" className="btn" style={{ display: 'inline-block', padding: '13px 42px', fontSize: 15 }}>
              התחלת 30 ימי ניסיון חינם — ₪30/חודש
            </a>
          </div>

          <div className="grid cols-3">
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🔍</div>
              <h3 style={{ fontSize: 15 }}>סריקה יומית מלאה</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>כל המכרזים בארץ, כל יום — שום הזדמנות לא מתפספסת.</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🎯</div>
              <h3 style={{ fontSize: 15 }}>התאמה מדויקת</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>רק רכבים שעונים על הקריטריונים שהגדרת — בלי רעש.</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>💬</div>
              <h3 style={{ fontSize: 15 }}>ישר לוואטסאפ</h3>
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>ההתאמות מגיעות אליך לנייד — נוח, מהיר, בזמן אמת.</p>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
