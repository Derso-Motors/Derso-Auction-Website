import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sendWhatsApp } from '../../../lib/whatsapp';
import { carMessage, processDueItems, ilDate } from '../../../lib/broadcast';
import BidspiritLinkFill from '../../../components/BidspiritLinkFill';

export const dynamic = 'force-dynamic';

const PAGE = '/admin/broadcasts';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

/* ── Server actions ─────────────────────────────────────────────────────────── */

async function togglePause() {
  'use server';
  const supabase = await requireAdmin();
  const { data: s } = await supabase.from('broadcast_settings').select('paused').eq('id', 1).single();
  const { error } = await supabase.from('broadcast_settings').update({ paused: !s?.paused }).eq('id', 1);
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('שינוי מצב השידור נכשל'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent(s?.paused ? 'השידור הופעל מחדש ▶️' : 'השידור הושהה ⏸️'));
}

async function itemAction(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const act = formData.get('act');
  let ok = '';
  if (act === 'hold') {
    const { error } = await supabase.from('broadcast_queue').update({ status: 'held' }).eq('id', id).eq('status', 'pending');
    if (error) redirect(PAGE + '?err=' + encodeURIComponent('עצירת הרכב נכשלה'));
    ok = 'הרכב הוחזק ⏸️';
  }
  if (act === 'resume') {
    const { error } = await supabase.from('broadcast_queue').update({ status: 'pending', scheduled_at: new Date().toISOString() }).eq('id', id).eq('status', 'held');
    if (error) redirect(PAGE + '?err=' + encodeURIComponent('חידוש הרכב נכשל'));
    ok = 'הרכב חזר לתור ▶️';
  }
  if (act === 'cancel') {
    const { error } = await supabase.from('broadcast_queue').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'held']);
    if (error) redirect(PAGE + '?err=' + encodeURIComponent('ביטול השליחה נכשל'));
    ok = 'השליחה בוטלה ✓';
  }
  if (act === 'send_now') {
    const { data: item } = await supabase.from('broadcast_queue').select('*, profiles(phone)').eq('id', id).single();
    if (!item || !['pending', 'held'].includes(item.status)) redirect(PAGE + '?err=' + encodeURIComponent('הרכב כבר לא ממתין לשליחה'));
    if (!item.profiles?.phone) redirect(PAGE + '?err=' + encodeURIComponent('ללקוח אין טלפון בפרופיל — לא נשלח'));
    const res = await sendWhatsApp(item.profiles.phone, carMessage(item));
    const { error } = await supabase.from('broadcast_queue').update({ status: 'sent', sent_at: new Date().toISOString(), wa_message_id: res.messageId || null }).eq('id', id);
    if (error) redirect(PAGE + '?err=' + encodeURIComponent('הרכב נשלח אך עדכון הסטטוס נכשל'));
    ok = 'הרכב נשלח ללקוח 📤';
  }
  revalidatePath(PAGE);
  redirect(PAGE + (ok ? '?ok=' + encodeURIComponent(ok) : ''));
}

async function clientBulkAction(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const act = formData.get('act');
  let ok = '';
  if (act === 'hold') {
    const { error } = await supabase.from('broadcast_queue').update({ status: 'held' }).eq('client_id', clientId).eq('status', 'pending');
    if (error) redirect(PAGE + '?err=' + encodeURIComponent('עצירת הרכבים ללקוח נכשלה'));
    ok = 'כל הרכבים של הלקוח הוחזקו ⏸️';
  }
  if (act === 'cancel') {
    const { error } = await supabase.from('broadcast_queue').update({ status: 'cancelled' }).eq('client_id', clientId).in('status', ['pending', 'held']);
    if (error) redirect(PAGE + '?err=' + encodeURIComponent('ביטול הרכבים ללקוח נכשל'));
    ok = 'כל הרכבים של הלקוח בוטלו ✓';
  }
  revalidatePath(PAGE);
  redirect(PAGE + (ok ? '?ok=' + encodeURIComponent(ok) : ''));
}

async function processNow() {
  'use server';
  const supabase = await requireAdmin();
  await processDueItems(supabase);
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('התור עובד — רכבים שהגיע זמנם נשלחו 🔄'));
}

async function instantSend(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const item = {
    title: formData.get('title'),
    details: {
      year: formData.get('year') || null,
      km: formData.get('km') || null,
      list_price: formData.get('list_price') || null,
      est_price: formData.get('est_price') || null,
      auction_link: formData.get('auction_link') || null,
      notes: formData.get('notes') || null,
    },
  };
  const { data: profile } = await supabase.from('profiles').select('phone').eq('id', clientId).single();
  if (!item.title) redirect(PAGE + '?err=' + encodeURIComponent('חסר שם רכב — לא נשלח'));
  if (!profile?.phone) redirect(PAGE + '?err=' + encodeURIComponent('ללקוח אין טלפון בפרופיל — לא נשלח'));
  const res = await sendWhatsApp(profile.phone, `⚡ התאמה מדויקת בשבילך!\n\n${carMessage(item)}`);
  const { error } = await supabase.from('broadcast_queue').insert({
    client_id: clientId, title: item.title, details: item.details,
    kind: 'instant', source: 'manual', status: 'sent', sent_at: new Date().toISOString(),
    wa_message_id: res.messageId || null,
  });
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('ההודעה נשלחה אך הרישום בארכיון נכשל'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('הרכב נשלח ללקוח מיידית ⚡'));
}

async function addSubscriber(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('broadcast_subscribers').upsert({
    client_id: formData.get('client_id'),
    monthly_fee: formData.get('fee') ? Number(formData.get('fee')) : 20,
    active: true,
  }, { onConflict: 'client_id' });
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('הוספת המנוי נכשלה'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('הלקוח נוסף לשידור ✓'));
}

async function toggleSubscriber(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const { data: s } = await supabase.from('broadcast_subscribers').select('active').eq('id', id).single();
  const { error } = await supabase.from('broadcast_subscribers').update({ active: !s?.active }).eq('id', id);
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('שינוי מצב המנוי נכשל'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent(s?.active ? 'המנוי הושבת ⏸️' : 'המנוי הופעל ▶️'));
}

async function removeSubscriber(formData) {
  'use server';
  const supabase = await requireAdmin();
  const { error } = await supabase.from('broadcast_subscribers').delete().eq('id', formData.get('id'));
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('הסרת המנוי נכשלה'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('המנוי הוסר מהשידור ✓'));
}

async function setDailyHour(formData) {
  'use server';
  const supabase = await requireAdmin();
  const h = Number(formData.get('hour'));
  if (!(h >= 0 && h <= 23)) redirect(PAGE + '?err=' + encodeURIComponent('שעה לא תקינה'));
  const { error } = await supabase.from('broadcast_settings').update({ daily_hour: h }).eq('id', 1);
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('קביעת שעת השידור נכשלה'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent(`שעת השידור היומי נקבעה ל-${String(h).padStart(2, '0')}:00 ✓`));
}

// Send a follow-up about a car that was already sent, as a WhatsApp *reply*
// quoting the original car message in the client's chat.
async function sendCarUpdate(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const text = (formData.get('text') || '').trim();
  if (!text) redirect(PAGE + '?err=' + encodeURIComponent('כתוב מה השתנה — העדכון לא נשלח'));
  const { data: item } = await supabase.from('broadcast_queue').select('*, profiles(phone)').eq('id', id).single();
  if (!(item?.status === 'sent' && item.profiles?.phone)) redirect(PAGE + '?err=' + encodeURIComponent('אי אפשר לשלוח עדכון — הרכב לא נשלח או שאין טלפון ללקוח'));
  await sendWhatsApp(item.profiles.phone, `📢 עדכון לגבי הרכב:\n${text}`, { replyTo: item.wa_message_id || undefined });
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('העדכון נשלח ללקוח 📤'));
}

// "Delete": WhatsApp's API can't delete a delivered message, so we reply to the
// original car message marking it no longer relevant, and flag it in the log.
async function retractCar(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const { data: item } = await supabase.from('broadcast_queue').select('*, profiles(phone)').eq('id', id).single();
  if (!(item?.status === 'sent' && !item.retracted && item.profiles?.phone)) redirect(PAGE + '?err=' + encodeURIComponent('אי אפשר לבטל — הרכב כבר בוטל, לא נשלח או שאין טלפון ללקוח'));
  await sendWhatsApp(item.profiles.phone, '🚫 הרכב הזה כבר לא רלוונטי — מתנצלים! ממשיכים לחפש בשבילך רכבים מתאימים 🚗', { replyTo: item.wa_message_id || undefined });
  const { error } = await supabase.from('broadcast_queue').update({ retracted: true }).eq('id', id);
  if (error) redirect(PAGE + '?err=' + encodeURIComponent('ההודעה נשלחה אך סימון הביטול נכשל'));
  revalidatePath(PAGE);
  redirect(PAGE + '?ok=' + encodeURIComponent('הלקוח עודכן שהרכב לא רלוונטי 🚫'));
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

function minutesLeft(iso) {
  return Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000));
}

export default async function BroadcastsPage({ searchParams }) {
  const archivePage = Math.max(1, Number(searchParams?.page) || 1);
  const supabase = await requireAdmin();

  // Opportunistic processing: any due car goes out when the page is opened.
  await processDueItems(supabase);

  const [{ data: settings }, { data: queue }, { data: subs }, { data: clients }, { data: recentSent }] = await Promise.all([
    supabase.from('broadcast_settings').select('*').eq('id', 1).single(),
    supabase.from('broadcast_queue').select('*, profiles(full_name)').in('status', ['pending', 'held']).order('scheduled_at'),
    supabase.from('broadcast_subscribers').select('*, profiles(full_name, phone)').order('created_at'),
    supabase.from('profiles').select('id, full_name').eq('role', 'client').order('full_name'),
    supabase.from('broadcast_queue').select('*, profiles(full_name)').eq('status', 'sent').order('sent_at', { ascending: false }).limit(100),
  ]);

  const activeSubs = (subs || []).filter((s) => s.active);
  const revenue = activeSubs.reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0);
  const subscribedIds = new Set((subs || []).map((s) => s.client_id));

  // Archive: sent items grouped into per-date folders, 10 dates per page.
  const DATES_PER_PAGE = 10;
  const folders = [];
  const folderIdx = {};
  for (const item of recentSent || []) {
    const d = ilDate(item.sent_at || item.created_at);
    if (!(d in folderIdx)) { folderIdx[d] = folders.length; folders.push({ date: d, items: [] }); }
    folders[folderIdx[d]].items.push(item);
  }
  const totalPages = Math.max(1, Math.ceil(folders.length / DATES_PER_PAGE));
  const pageFolders = folders.slice((archivePage - 1) * DATES_PER_PAGE, archivePage * DATES_PER_PAGE);

  // Group pending/held items by client so the screen stays tidy.
  const byClient = {};
  for (const item of queue || []) {
    const key = item.client_id;
    (byClient[key] = byClient[key] || { name: item.profiles?.full_name || 'לקוח', items: [] }).items.push(item);
  }

  return (
    <Shell active="broadcasts">
      <div className="page-title">שידורים 📡</div>
      <div className="page-sub">כל רכב מחכה אצלך רבע שעה לפני שהוא יוצא ללקוח — אפשר לעצור, לבטל או לשלוח מיד</div>

      {/* Status bar */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <div><b style={{ fontSize: 20 }}>{(queue || []).length}</b> <span className="muted">בתור</span></div>
          <div><b style={{ fontSize: 20 }}>{activeSubs.length}</b> <span className="muted">מנויים פעילים</span></div>
          <div><b style={{ fontSize: 20, color: 'var(--success)' }}>₪{revenue.toLocaleString('he-IL')}</b> <span className="muted">הכנסה חודשית משידור</span></div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <form action={setDailyHour} className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>שידור יומי בשעה</span>
            <select name="hour" defaultValue={settings?.daily_hour ?? 9} style={{ width: 74 }}>
              {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
            <SubmitButton className="btn secondary small">קבע</SubmitButton>
          </form>
          <form action={processNow}><SubmitButton className="btn secondary">🔄 עיבוד תור עכשיו</SubmitButton></form>
          <form action={togglePause}>
            <SubmitButton className={settings?.paused ? 'btn' : 'btn danger-outline'} label={settings?.paused ? '▶️ הפעלת השידור' : '⏸️ השהיית כל השידור'} />
          </form>
        </div>
      </div>
      {settings?.paused && (
        <div className="card" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
          ⏸️ השידור מושהה — אף רכב לא יישלח עד שתפעיל מחדש. שקט לילי קבוע: {settings.quiet_start}:00–{settings.quiet_end}:00.
        </div>
      )}

      {/* The daily broadcast queue, grouped by client */}
      <div className="card">
        <h3>זה השידור היומי — ממתינים לשליחה ({(queue || []).length})</h3>
        {!Object.keys(byClient).length && <div className="empty">התור ריק — אין רכבים שממתינים לשליחה</div>}
        {Object.entries(byClient).map(([clientId, group]) => (
          <details key={clientId} open style={{ marginBottom: 10 }}>
            <summary style={{ cursor: 'pointer', padding: '8px 0', fontWeight: 700 }}>
              👤 {group.name} <span className="muted">({group.items.length} רכבים)</span>
            </summary>
            <div style={{ paddingRight: 16 }}>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <form action={clientBulkAction}>
                  <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="act" value="hold" />
                  <SubmitButton className="btn secondary small">⏸️ עצור הכל ללקוח</SubmitButton>
                </form>
                <form action={clientBulkAction} className="row" style={{ gap: 4, alignItems: 'center' }}>
                  <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="act" value="cancel" />
                  <DeleteButton title="ביטול כל הרכבים הממתינים ללקוח" />
                  <span className="muted" style={{ fontSize: 12 }}>בטל הכל ללקוח</span>
                </form>
              </div>
              {group.items.map((item) => (
                <div key={item.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid rgba(68,71,77,0.3)', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div>
                      {item.kind === 'instant' ? '⚡' : '📡'} <b>{item.title}</b>
                      {item.status === 'held' && <span className="muted"> · ⏸️ מוחזק</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {item.status === 'pending' ? `יוצא בעוד ~${minutesLeft(item.scheduled_at)} דק'` : 'לא יישלח עד שתחדש'}
                      {item.details?.auction_link && <> · <a href={item.details.auction_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>קישור למכרז ↗</a></>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <form action={itemAction}>
                      <input type="hidden" name="id" value={item.id} /><input type="hidden" name="act" value="send_now" />
                      <SubmitButton className="btn small">📤 שלח עכשיו</SubmitButton>
                    </form>
                    {item.status === 'pending' ? (
                      <form action={itemAction}>
                        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="act" value="hold" />
                        <SubmitButton className="btn secondary small">⏸️</SubmitButton>
                      </form>
                    ) : (
                      <form action={itemAction}>
                        <input type="hidden" name="id" value={item.id} /><input type="hidden" name="act" value="resume" />
                        <SubmitButton className="btn secondary small">▶️</SubmitButton>
                      </form>
                    )}
                    <form action={itemAction}>
                      <input type="hidden" name="id" value={item.id} /><input type="hidden" name="act" value="cancel" />
                      <DeleteButton title="ביטול שליחה" />
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {/* Instant send — exact match outside the daily broadcast */}
      <div className="card inv-bidspirit">
        <h3>שליחה פתאומית ⚡ — התאמה מדויקת עכשיו</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>נשלח ללקוח מיד בוואטסאפ, בלי לחכות לשידור ובלי דיליי.</p>
        <form action={instantSend}>
          <div className="grid cols-2">
            <div className="field">
              <label>לקוח *</label>
              <select name="client_id" required>
                <option value="">בחר לקוח...</option>
                {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id}</option>)}
              </select>
            </div>
            <div className="field"><label>שם הרכב *</label><input name="title" required placeholder="מרצדס EQE 350 · 2023" /></div>
            <div className="field"><label>שנתון</label><input name="year" type="number" dir="ltr" /></div>
            <div className="field"><label>ק"מ</label><input name="km" type="number" dir="ltr" /></div>
            <div className="field"><label>מחיר מחירון (₪)</label><input name="list_price" type="number" dir="ltr" /></div>
            <div className="field"><label>מחיר משוער (₪)</label><input name="est_price" type="number" dir="ltr" /></div>
            <div className="field"><label>קישור למכרז</label><input name="auction_link" dir="ltr" placeholder="https://il.bidspirit.com/..." /></div>
            <BidspiritLinkFill map={{ title: 'title', year: 'year', km: 'km', list_price: 'list_price' }} />
            <div className="field"><label>הערה ללקוח</label><input name="notes" placeholder="בדיוק מה שחיפשת — המכרז נסגר היום!" /></div>
          </div>
          <SubmitButton className="btn">⚡ שליחה מיידית ללקוח</SubmitButton>
        </form>
      </div>

      {/* Subscribers */}
      <div className="card">
        <h3>מנויי שידור — ₪20 לחודש ({activeSubs.length} פעילים · ₪{revenue.toLocaleString('he-IL')} בחודש)</h3>
        {(subs || []).map((s) => (
          <div key={s.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid rgba(68,71,77,0.3)', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <b>{s.profiles?.full_name || s.client_id}</b>
              <span className="muted"> · ₪{Number(s.monthly_fee).toLocaleString('he-IL')}/חודש</span>
              {!s.active && <span style={{ color: 'var(--warning)' }}> · מושבת</span>}
              {s.active && !s.profiles?.phone && <span style={{ color: 'var(--danger)' }}> · ⚠️ אין טלפון בפרופיל</span>}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <form action={toggleSubscriber}>
                <input type="hidden" name="id" value={s.id} />
                <SubmitButton className="btn secondary small" label={s.active ? '⏸️ השבתה' : '▶️ הפעלה'} />
              </form>
              <form action={removeSubscriber}>
                <input type="hidden" name="id" value={s.id} />
                <DeleteButton title="הסרה מהשידור" />
              </form>
            </div>
          </div>
        ))}
        <form action={addSubscriber} style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <label>הוספת לקוח לשידור</label>
              <select name="client_id" required>
                <option value="">בחר לקוח...</option>
                {(clients || []).filter((c) => !subscribedIds.has(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name || c.id}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 120, marginBottom: 0 }}>
              <label>מחיר חודשי (₪)</label>
              <input name="fee" type="number" defaultValue="20" dir="ltr" />
            </div>
            <SubmitButton className="btn">+ הוספה לשידור</SubmitButton>
          </div>
        </form>
      </div>

      {/* Archive — one folder per broadcast day, 10 days per page */}
      <div className="card">
        <h3>ארכיון שידורים — לפי ימים</h3>
        {!pageFolders.length && <div className="empty">עוד לא נשלחו רכבים</div>}
        {pageFolders.map((folder, fi) => {
          const daily = folder.items.filter((i) => i.kind !== 'instant');
          const instant = folder.items.filter((i) => i.kind === 'instant');
          const byName = {};
          for (const it of folder.items) (byName[it.profiles?.full_name || 'לקוח'] = byName[it.profiles?.full_name || 'לקוח'] || []).push(it);
          return (
            <details key={folder.date} open={archivePage === 1 && fi === 0} style={{ marginBottom: 10 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 0', fontWeight: 700 }}>
                📅 {folder.date} <span className="muted">— שידור יומי ({daily.length}) · פתאומיות ({instant.length})</span>
              </summary>
              <div style={{ paddingRight: 16 }}>
                {Object.entries(byName).map(([name, items]) => (
                  <div key={name} style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, padding: '4px 0' }}>👤 {name} <span className="muted">({items.length})</span></div>
                    {items.map((item) => (
                      <div key={item.id} style={{ padding: '6px 0 6px 0', borderBottom: '1px solid rgba(68,71,77,0.3)', fontSize: 13.5 }}>
                        <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            {item.kind === 'instant' ? '⚡' : '📡'}{' '}
                            <span style={item.retracted ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>{item.title}</span>
                            {item.retracted && <span style={{ color: 'var(--danger)', fontSize: 12 }}> · בוטל</span>}
                            <span className="muted" style={{ fontSize: 11.5 }}> · {item.sent_at && new Date(item.sent_at).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {!item.retracted && (
                            <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                              <details>
                                <summary className="btn secondary small" style={{ listStyle: 'none', cursor: 'pointer' }}>✏️ עדכן</summary>
                                <form action={sendCarUpdate} className="row" style={{ gap: 6, marginTop: 6 }}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <input name="text" required placeholder="מה השתנה? נשלח כתגובה להודעת הרכב" style={{ minWidth: 220 }} />
                                  <SubmitButton className="btn small">📤 שלח עדכון</SubmitButton>
                                </form>
                              </details>
                              <form action={retractCar} className="row" style={{ gap: 4, alignItems: 'center' }}>
                                <input type="hidden" name="id" value={item.id} />
                                <DeleteButton title="שולח ללקוח תגובה על הודעת הרכב שהוא כבר לא רלוונטי" />
                                <span className="muted" style={{ fontSize: 12 }}>לא רלוונטי</span>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
        {totalPages > 1 && (
          <div className="row" style={{ gap: 6, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <a key={n} href={`${PAGE}?page=${n}`} className={`inv-filter ${n === archivePage ? 'active' : ''}`}>עמוד {n}</a>
            ))}
          </div>
        )}
      </div>

    </Shell>
  );
}
