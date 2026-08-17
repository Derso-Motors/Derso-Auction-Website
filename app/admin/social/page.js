import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireAdmin } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { publishPost, generateCaption } from '../../../lib/social';
import { generateAiImage, uploadToStorage, imagePromptForPost } from '../../../lib/ai-image';
import { checkQuota } from '../../../lib/meta';
import { TOPIC_AREAS } from '../../../lib/social-guidelines';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PAGE = '/admin/social';
const go = (msg, err) => redirect(PAGE + (err ? '?err=' : '?ok=') + encodeURIComponent(msg));

/* ── Server actions ── */

async function publishNow(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const { data: post } = await supabase.from('social_posts').select('*').eq('id', formData.get('id')).single();
  if (!post) go('הפוסט לא נמצא', true);
  const r = await publishPost(supabase, post);
  revalidatePath(PAGE);
  r.ok ? go('פורסם לפייסבוק' + (r.igId ? ' ולאינסטגרם' : '') + ' ✓') : go('הפרסום נכשל: ' + r.error, true);
}

async function setStatus(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  await supabase.from('social_posts').update({ status: formData.get('status') }).eq('id', formData.get('id'));
  revalidatePath(PAGE);
  go('עודכן ✓');
}

async function saveCaption(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  await supabase.from('social_posts').update({ caption: String(formData.get('caption') || '') }).eq('id', formData.get('id'));
  revalidatePath(PAGE);
  go('הקפשן נשמר ✓');
}

async function regenerateCaption(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const { data: post } = await supabase.from('social_posts').select('*').eq('id', formData.get('id')).single();
  const caption = await generateCaption(post.kind, post.payload, supabase);
  await supabase.from('social_posts').update({ caption }).eq('id', post.id);
  revalidatePath(PAGE);
  go('קפשן חדש נוצר ✨');
}

async function aiImage(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const { data: post } = await supabase.from('social_posts').select('*').eq('id', formData.get('id')).single();
  try {
    const dataUrl = await generateAiImage(imagePromptForPost(post));
    const bgUrl = await uploadToStorage(dataUrl, `post-${post.id}`);
    // AI art as background, exact data rendered by the template layer on top
    const base = new URL(post.image_url, 'https://auctions.derso.net');
    base.searchParams.set('bg', bgUrl);
    await supabase.from('social_posts').update({ image_url: base.toString(), image_mode: 'ai' }).eq('id', post.id);
    revalidatePath(PAGE);
    go('תמונת AI ייחודית נוצרה 🎨');
  } catch (e) {
    go('יצירת התמונה נכשלה: ' + e.message, true);
  }
}

async function chromeImage(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  const { data: post } = await supabase.from('social_posts').select('*').eq('id', formData.get('id')).single();
  try {
    const { renderPostImage } = await import('../../../lib/renderer');
    const { carPhotoDataUrl } = await import('../../../lib/photos');
    const { uploadToStorage } = await import('../../../lib/ai-image');
    let photo = null;
    if (['deal', 'client_win'].includes(post.kind)) {
      photo = await carPhotoDataUrl(post.payload?.title || post.payload?.car_title);
    }
    const pngBuf = await renderPostImage(post.kind, post.payload || {}, photo);
    const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;
    const url = await uploadToStorage(dataUrl, `post-${post.id}`);
    await supabase.from('social_posts').update({ image_url: url, image_mode: 'chrome' }).eq('id', post.id);
    revalidatePath(PAGE);
    go('תמונת Chrome איכותית נוצרה 🎨');
  } catch (e) {
    go('יצירת התמונה נכשלה: ' + e.message, true);
  }
}

async function toggleAuto() {
  'use server';
  const { supabase } = await requireAdmin();
  const { data: s } = await supabase.from('broadcast_settings').select('social_auto_publish').eq('id', 1).single();
  await supabase.from('broadcast_settings').update({ social_auto_publish: !s?.social_auto_publish }).eq('id', 1);
  revalidatePath(PAGE);
  go(s?.social_auto_publish ? 'פרסום אוטומטי כובה — הכל יחכה לאישור שלך' : 'פרסום אוטומטי הופעל 🚀');
}

async function generateNow() {
  'use server';
  await requireAdmin();
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';
  await fetch(`${site}/api/social/tick`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }, cache: 'no-store' });
  revalidatePath(PAGE);
  go('נוצרו טיוטות חדשות מהדאטה ✨');
}

async function deletePost(formData) {
  'use server';
  const { supabase } = await requireAdmin();
  await supabase.from('social_posts').delete().eq('id', formData.get('id'));
  revalidatePath(PAGE);
  go('נמחק ✓');
}

/* ── Page ── */

const KIND_LABEL = { deal: '🔥 עסקה מהמכרזים', client_win: '🏆 זכייה של לקוח', weekly_summary: '📊 סיכום שבועי', sheet: '📄 מגיליון התכנים', news: '📰 חדשות', knowledge: '💡 ידע', topic: '🔎 נושא חם מהניטור' };
const STATUS_BADGE = { draft: ['טיוטה', ''], approved: ['מאושר לפרסום', 'paid'], posted: ['פורסם ✓', 'paid'], failed: ['נכשל', 'err'], rejected: ['נדחה', ''] };

export default async function SocialAdminPage({ searchParams }) {
  const { supabase } = await requireAdmin();
  const [{ data: posts }, { data: settings }, { data: trends }, { data: insights }] = await Promise.all([
    supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(40),
    supabase.from('broadcast_settings').select('social_auto_publish').eq('id', 1).single(),
    supabase.from('social_trends').select('*').order('created_at', { ascending: false }).limit(8),
    supabase.from('social_insights').select('likes, comments, shares, social_posts(caption, kind)').order('likes', { ascending: false }).limit(3),
  ]);
  const socialyncReady = !!process.env.SOCIALYNC_API_KEY;
  let quota = null;
  if (socialyncReady) { try { quota = await checkQuota(); } catch { /* offline */ } }

  const stat = (label, val, sub) => (
    <div className="card" style={{ flex: 1, minWidth: 150, textAlign: 'center', margin: 0 }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--gold, #d4af37)' }}>{val}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
  const byStatus = (s) => (posts || []).filter((p) => p.status === s).length;

  return (
    <Shell active="social">
      <div className="page-title">📣 שיווק אוטומטי — DERSO רכבים</div>
      <div className="page-sub">פוסטים שנוצרים אוטומטית מתוצאות אמת + ניטור נושאים חמים (יוקר מחיה, בטיחות, כלכלת רכב, עולם הנהיגה) — ומתפרסמים דרך Socialync</div>

      {searchParams?.err && <div className="error-msg">{searchParams.err}</div>}
      {searchParams?.ok && !searchParams?.err && <div className="info-msg">{searchParams.ok}</div>}
      {!socialyncReady && <div className="error-msg">⚠️ חסר SOCIALYNC_API_KEY ב-Vercel — אפשר ליצור ולערוך טיוטות, אבל פרסום לא יעבוד עד שנגדיר אותו.</div>}

      {/* ── דשבורד ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        {stat('פורסמו', byStatus('posted'))}
        {stat('טיוטות', byStatus('draft'))}
        {stat('מאושרים', byStatus('approved'))}
        {stat('נכשלו', byStatus('failed'))}
        {quota?.remainingPosts != null && stat('נותרו החודש', quota.remainingPosts, quota.plan ? `תוכנית ${quota.plan}` : 'Socialync')}
      </div>

      {(trends || []).length > 0 && (
        <div className="card">
          <b>🔎 נושאים חמים מהניטור</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {trends.map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 13 }}>
                <span className="badge">{TOPIC_AREAS.find((a) => a.key === t.area)?.label || t.area}</span>
                <b>{t.topic}</b>
                <span className="muted">{t.pain_point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(insights || []).length > 0 && (
        <div className="card">
          <b>🏆 הפוסטים המצליחים (מזינים את הלמידה)</b>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {insights.map((r, i) => (
              <div key={i} style={{ fontSize: 13 }}>
                <span className="badge paid">❤️ {r.likes} · 💬 {r.comments} · 🔁 {r.shares}</span>{' '}
                <span className="muted">{(r.social_posts?.caption || '').slice(0, 90)}…</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <form action={generateNow}><SubmitButton className="btn">✨ צור פוסטים עכשיו מהדאטה</SubmitButton></form>
        <form action={toggleAuto}>
          <SubmitButton className={settings?.social_auto_publish ? 'btn' : 'btn secondary'}>
            {settings?.social_auto_publish ? '🟢 פרסום אוטומטי פעיל — לחץ לכיבוי' : '⚪ פרסום אוטומטי כבוי — לחץ להפעלה'}
          </SubmitButton>
        </form>
      </div>

      {(posts || []).map((p) => {
        const [label, badgeCls] = STATUS_BADGE[p.status] || [p.status, ''];
        return (
          <div key={p.id} className="card" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt="" style={{ width: 260, height: 260, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <b>{KIND_LABEL[p.kind] || p.kind}</b>
                <span className={`badge ${badgeCls}`}>{label}</span>
                {p.image_mode === 'ai' && <span className="badge">🎨 תמונת AI</span>}
                <span className="muted" style={{ fontSize: 12 }}>{new Date(p.created_at).toLocaleString('he-IL')}</span>
              </div>
              {p.error && <div className="error-msg" style={{ fontSize: 12 }}>{p.error}</div>}
              <form action={saveCaption}>
                <input type="hidden" name="id" value={p.id} />
                <textarea name="caption" defaultValue={p.caption || ''} rows={7} style={{ width: '100%', fontSize: 13 }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <SubmitButton className="btn secondary" style={{ padding: '7px 14px', fontSize: 13 }}>💾 שמור קפשן</SubmitButton>
                </div>
              </form>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {p.status !== 'posted' && (
                  <form action={publishNow}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn" style={{ padding: '7px 14px', fontSize: 13 }}>🚀 פרסם עכשיו</SubmitButton></form>
                )}
                {p.status === 'draft' && (
                  <form action={setStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="approved" /><SubmitButton className="btn secondary" style={{ padding: '7px 14px', fontSize: 13 }}>✓ אשר לפרסום הבא</SubmitButton></form>
                )}
                <form action={regenerateCaption}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn secondary" style={{ padding: '7px 14px', fontSize: 13 }}>✨ קפשן חדש</SubmitButton></form>
                <form action={aiImage}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn secondary" style={{ padding: '7px 14px', fontSize: 13 }}>🎨 תמונת AI</SubmitButton></form>
                <form action={chromeImage}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn secondary" style={{ padding: '7px 14px', fontSize: 13 }}>🖼️ תמונת Chrome HD</SubmitButton></form>
                {p.status !== 'posted' && (
                  <form action={deletePost}><input type="hidden" name="id" value={p.id} /><DeleteButton title="מחיקת הפוסט" confirmText="למחוק את הפוסט הזה?" /></form>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {!posts?.length && <div className="card muted">אין עדיין פוסטים — לחץ "צור פוסטים עכשיו מהדאטה" 👆</div>}
    </Shell>
  );
}
