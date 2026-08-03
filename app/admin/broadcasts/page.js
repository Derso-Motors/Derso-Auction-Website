import { SubmitButton, DeleteButton } from '../../../components/SubmitButton';
import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sendWhatsApp } from '../../../lib/whatsapp';

export const dynamic = 'force-dynamic';

const PAGE = '/admin/broadcasts';

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') redirect('/');
  return supabase;
}

function ilHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false }).format(new Date()));
}

function carMessage(item) {
  const d = item.details || {};
  const lines = [
    `🚗 ${item.title}`,
    d.year && `שנתון: ${d.year}`,
    d.km && `ק"מ: ${Number(d.km).toLocaleString('he-IL')}`,
    d.list_price && `מחיר מחירון: ₪${Number(d.list_price).toLocaleString('he-IL')}`,
    d.est_price && `מחיר משוער: ₪${Number(d.est_price).toLocaleString('he-IL')}`,
    d.auction_link && `לצפייה במכרז: ${d.auction_link}`,
    d.notes && `📝 ${d.notes}`,
  ].filter(Boolean);
  return `${lines.join('\n')}\n\nדרסו מוטורס — ליווי למכרזים`;
}

// Send every due pending item (called on page load and by the "process now" button).
async function processDueItems(supabase) {
  const { data: settings } = await supabase.from('broadcast_settings').select('*').eq('id', 1).single();
  if (settings?.paused) return 0;
  const h = ilHour();
  const { quiet_start: qs = 21, quiet_end: qe = 9 } = settings || {};
  const quiet = qs > qe ? (h >= qs || h < qe) : (h >= qs && h < qe);
  if (quiet) return 0;

  const { data: due } = await supabase
    .from('broadcast_queue')
    .select('*, profiles(full_name, phone)')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(30);

  let sent = 0;
  for (const item of due || []) {
    if (item.profiles?.phone) {
      try { await sendWhatsApp(item.profiles.phone, carMessage(item)); } catch { continue; }
    }
    await supabase.from('broadcast_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', item.id);
    sent++;
  }
  return sent;
}

/* ── Server actions ─────────────────────────────────────────────────────────── */

async function togglePause() {
  'use server';
  const supabase = await requireAdmin();
  const { data: s } = await supabase.from('broadcast_settings').select('paused').eq('id', 1).single();
  await supabase.from('broadcast_settings').update({ paused: !s?.paused }).eq('id', 1);
  revalidatePath(PAGE);
}

async function itemAction(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const act = formData.get('act');
  if (act === 'hold')   await supabase.from('broadcast_queue').update({ status: 'held' }).eq('id', id).eq('status', 'pending');
  if (act === 'resume') await supabase.from('broadcast_queue').update({ status: 'pending', scheduled_at: new Date().toISOString() }).eq('id', id).eq('status', 'held');
  if (act === 'cancel') await supabase.from('broadcast_queue').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'held']);
  if (act === 'send_now') {
    const { data: item } = await supabase.from('broadcast_queue').select('*, profiles(phone)').eq('id', id).single();
    if (item && ['pending', 'held'].includes(item.status) && item.profiles?.phone) {
      await sendWhatsApp(item.profiles.phone, carMessage(item));
      await supabase.from('broadcast_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    }
  }
  revalidatePath(PAGE);
}

async function clientBulkAction(formData) {
  'use server';
  const supabase = await requireAdmin();
  const clientId = formData.get('client_id');
  const act = formData.get('act');
  if (act === 'hold')   await supabase.from('broadcast_queue').update({ status: 'held' }).eq('client_id', clientId).eq('status', 'pending');
  if (act === 'cancel') await supabase.from('broadcast_queue').update({ status: 'cancelled' }).eq('client_id', clientId).in('status', ['pending', 'held']);
  revalidatePath(PAGE);
}

async function processNow() {
  'use server';
  const supabase = await requireAdmin();
  await processDueItems(supabase);
  revalidatePath(PAGE);
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
  if (profile?.phone && item.title) {
    await sendWhatsApp(profile.phone, `⚡ התאמה מדויקת בשבילך!\n\n${carMessage(item)}`);
    await supabase.from('broadcast_queue').insert({
      client_id: clientId, title: item.title, details: item.details,
      kind: 'instant', source: 'manual', status: 'sent', sent_at: new Date().toISOString(),
    });
  }
  revalidatePath(PAGE);
}

async function addSubscriber(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('broadcast_subscribers').upsert({
    client_id: formData.get('client_id'),
    monthly_fee: formData.get('fee') ? Number(formData.get('fee')) : 20,
    active: true,
  }, { onConflict: 'client_id' });
  revalidatePath(PAGE);
}

async function toggleSubscriber(formData) {
  'use server';
  const supabase = await requireAdmin();
  const id = formData.get('id');
  const { data: s } = await supabase.from('broadcast_subscribers').select('active').eq('id', id).single();
  await supabase.from('broadcast_subscribers').update({ active: !s?.active }).eq('id', id);
  revalidatePath(PAGE);
}

async function removeSubscriber(formData) {
  'use server';
  const supabase = await requireAdmin();
  await supabase.from('broadcast_subscribers').delete().eq('id', formData.get('id'));
  revalidatePath(PAGE);
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

function minutesLeft(iso) {
  return Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000));
}

export default async function BroadcastsPage() {
  const supabase = await requireAdmin();

  // Opportunistic processing: any due car goes out when the page is opened.
  await processDueItems(supabase);

  const [{ data: settings }, { data: queue }, { data: subs }, { data: clients }, { data: recentSent }] = await Promise.all([
    supabase.from('broadcast_settings').select('*').eq('id', 1).single(),
    supabase.from('broadcast_queue').select('*, profiles(full_name)').in('status', ['pending', 'held']).order('scheduled_at'),
    supabase.from('broadcast_subscribers').select('*, profiles(full_name, phone)').order('created_at'),
    supabase.from('profiles').select('id, full_name').eq('role', 'client').order('full_name'),
    supabase.from('broadcast_queue').select('*, profiles(full_name)').eq('status', 'sent').order('sent_at', { ascending: false }).limit(15),
  ]);

  const activeSubs = (subs || []).filter((s) => s.active);
  const revenue = activeSubs.reduce((sum, s) => sum + Number(s.monthly_fee || 0), 0);
  const subscribedIds = new Set((subs || []).map((s) => s.client_id));

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
        <div className="row" style={{ gap: 8 }}>
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
                <form action={clientBulkAction}>
                  <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="act" value="cancel" />
                  <SubmitButton className="btn danger-outline small">🗑️ בטל הכל ללקוח</SubmitButton>
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

      {/* Recently sent */}
      <div className="card">
        <h3>נשלחו לאחרונה</h3>
        {!recentSent?.length && <div className="empty">עוד לא נשלחו רכבים</div>}
        {recentSent?.map((item) => (
          <div key={item.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(68,71,77,0.3)', fontSize: 13.5 }}>
            {item.kind === 'instant' ? '⚡' : '📡'} <b>{item.profiles?.full_name}</b> — {item.title}
            <span className="muted"> · {item.sent_at && new Date(item.sent_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
