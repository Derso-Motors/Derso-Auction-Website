// Social marketing engine: real auction results + client wins + content sheet → branded posts.
import { aiChat, webMarketContext, topPerformerExamples } from './social-brain';
import { postToAll, metaConfigured } from './meta';

const RESULTS_SHEET_URL = process.env.RESULTS_SHEET_URL ||
  'https://docs.google.com/spreadsheets/d/1WZt3eJwsng4OqfW0106ZLE91p_pyPOSCcfcNMIZCi3c/export?format=csv';
const SITE = 'https://auctions.derso.net';
export const CTA = `📡 רוצים לקבל רכבים כאלה ישירות לוואטסאפ? הצטרפו לשידור של דרסו:\n${SITE}/subscriptions`;

// ── CSV ──
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

const num = (s) => Number(String(s || '').replace(/[^\d.]/g, '')) || 0;

// ── Sources ──
export async function loadAuctionDeals() {
  const res = await fetch(RESULTS_SHEET_URL, { cache: 'no-store' });
  if (!res.ok) return [];
  const rows = parseCsv(await res.text());
  return rows
    .map((r) => {
      const list = num(r['מחיר מחירון']);
      const sold = num(r['מחיר מכירה בפועל']);
      return {
        title: r['שם הרכב (מפורט)'] || '',
        year: r['שנה'] || '',
        km: r['ק"מ'] || '',
        list, sold,
        discount: list > 0 && sold > 0 ? Math.round((1 - sold / list) * 100) : 0,
      };
    })
    .filter((d) => d.title && d.list > 20000 && d.sold > 0 && d.discount >= 10 && d.discount <= 60);
}

export async function loadContentSheet() {
  const url = process.env.CONTENT_SHEET_URL;
  if (!url) return [];
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  return parseCsv(await res.text()).filter((r) => (r['סטטוס'] || '').includes('מוכן'));
}

export async function loadClientWins(supabase) {
  const { data } = await supabase
    .from('auctions')
    .select('id, car_title, final_price, list_price, closing_date, status')
    .in('status', ['won', 'released', 'transfer10', 'redemption', 'transfer90', 'ownership_order', 'licensing'])
    .not('list_price', 'is', null)
    .order('closing_date', { ascending: false })
    .limit(10);
  return (data || []).filter((a) => a.list_price > a.final_price);
}

// ── Caption ──
export async function generateCaption(kind, payload, supabase) {
  const [market, examples] = await Promise.all([webMarketContext(), topPerformerExamples(supabase)]);
  const brief = {
    deal: `רכב שנמכר במכרז מתחת למחירון: ${JSON.stringify(payload)}. כתוב פוסט על ההזדמנות שהייתה כאן.`,
    client_win: `לקוח שלנו זכה ברכב: ${JSON.stringify(payload)}. כתוב פוסט על הזכייה והחיסכון (בלי שם הלקוח).`,
    weekly_summary: `סיכום שבועי של תוצאות מכרזים: ${JSON.stringify(payload)}. כתוב פוסט מסכם.`,
    sheet: `תוכן מגיליון הרעיונות שלנו: ${JSON.stringify(payload)}. הפוך את זה לפוסט מלא.`,
    news: `כתוב פוסט חדשותי/חינוכי על נושא חם בשוק הרכב הישראלי או מכרזי רכב, מבוסס על ההקשר מהאינטרנט למטה.`,
  }[kind] || JSON.stringify(payload);
  return aiChat([
    {
      role: 'system',
      content: 'אתה כותב תוכן שיווקי לעמודי הסושיאל של "דרסו" — בית ליווי מקצועי למכרזי רכב בישראל. ' +
        'סגנון: עברית, חד, מקצועי, מבוסס מספרים אמיתיים, קצת FOMO, אימוג\'ים במידה. 4-8 שורות + האשטגים רלוונטיים בעברית. ' +
        `חובה לסיים ב-CTA הזה בדיוק:\n${CTA}` +
        (examples ? `\n\nחקה את הסגנון של הפוסטים המצליחים שלנו:\n${examples}` : ''),
    },
    { role: 'user', content: brief + (market ? `\n\nהקשר עדכני מהאינטרנט:\n${market}` : '') },
  ]);
}

// ── Draft creation (deduped) ──
export async function createDraft(supabase, kind, payload, dedupKey, imageMode = 'template') {
  const { data: exists } = await supabase.from('social_posts').select('id').eq('dedup_key', dedupKey).maybeSingle();
  if (exists) return null;
  const caption = await generateCaption(kind, payload, supabase);
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || SITE;
  const imageUrl = `${site}/api/social/image?${new URLSearchParams({ kind, ...flatten(payload) })}`;
  const { data, error } = await supabase
    .from('social_posts')
    .insert({ kind, payload, caption, dedup_key: dedupKey, image_url: imageUrl, image_mode: imageMode, status: 'draft' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function flatten(p) {
  const out = {};
  for (const [k, v] of Object.entries(p || {})) if (v != null && typeof v !== 'object') out[k] = String(v);
  return out;
}

// ── Publish ──
export async function publishPost(supabase, post) {
  if (!metaConfigured()) throw new Error('Socialync API key not configured (SOCIALYNC_API_KEY)');
  try {
    const result = await postToAll(post.image_url, post.caption);
    const perPlatform = result.results || [];
    const fbId = perPlatform.find(r => r.platform === 'facebook')?.postId || null;
    const igId = perPlatform.find(r => r.platform === 'instagram')?.postId || null;
    const failed = perPlatform.filter(r => !r.success);
    if (failed.length && failed.length === perPlatform.length) {
      throw new Error(failed.map(f => `${f.platform}: ${f.error}`).join('; '));
    }
    await supabase.from('social_posts').update({
      status: 'posted',
      fb_post_id: fbId,
      ig_post_id: igId,
      posted_at: new Date().toISOString(),
      error: failed.length ? failed.map(f => `${f.platform}: ${f.error}`).join('; ') : null,
    }).eq('id', post.id);
    return { ok: true, fbId, igId, results: perPlatform };
  } catch (e) {
    await supabase.from('social_posts').update({ status: 'failed', error: e.message }).eq('id', post.id);
    return { ok: false, error: e.message };
  }
}
