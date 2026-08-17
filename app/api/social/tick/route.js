import { createClient } from '@supabase/supabase-js';
import { loadAuctionDeals, loadContentSheet, loadClientWins, createDraft, publishPost } from '../../../../lib/social';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Social marketing cron: builds draft posts from real data (results sheet,
// client wins, content sheet). If auto-publish is enabled in broadcast_settings,
// also publishes approved/auto drafts to Facebook + Instagram.
export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const fromCron = !!req.headers.get('x-vercel-cron') || auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!fromCron && process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const created = [];
  // 1. Best recent auction deal
  try {
    const deals = await loadAuctionDeals();
    const best = deals.sort((a, b) => b.discount - a.discount).slice(0, 3);
    for (const d of best) {
      const post = await createDraft(supabase, 'deal', d, `deal:${d.title}:${d.sold}`);
      if (post) { created.push(post.id); break; } // one new deal post per tick
    }
  } catch (e) { console.error('deal drafts:', e.message); }

  // 2. Client win
  try {
    for (const w of await loadClientWins(supabase)) {
      const payload = {
        car_title: w.car_title, title: w.car_title,
        list: w.list_price, sold: w.final_price,
        discount: Math.round((1 - w.final_price / w.list_price) * 100),
        savings: w.list_price - w.final_price,
      };
      const post = await createDraft(supabase, 'client_win', payload, `win:${w.id}`);
      if (post) { created.push(post.id); break; }
    }
  } catch (e) { console.error('win drafts:', e.message); }

  // 3. Content sheet rows ("מוכן")
  try {
    for (const row of await loadContentSheet()) {
      const payload = { topic: row['נושא'], text: row['טקסט/נקודות'] || row['טקסט'], source: row['קישור מקור'], type: row['סוג פוסט'] };
      const post = await createDraft(supabase, 'sheet', payload, `sheet:${payload.topic}`);
      if (post) created.push(post.id);
    }
  } catch (e) { console.error('sheet drafts:', e.message); }

  // Auto-publish if enabled
  let published = [];
  const { data: settings } = await supabase.from('broadcast_settings').select('social_auto_publish').eq('id', 1).single();
  const auto = !!settings?.social_auto_publish;
  const { data: toPost } = await supabase
    .from('social_posts')
    .select('*')
    .in('status', auto ? ['approved', 'draft'] : ['approved'])
    .order('created_at')
    .limit(auto ? 1 : 5);
  for (const post of toPost || []) {
    const r = await publishPost(supabase, post);
    published.push({ id: post.id, ...r });
  }

  return Response.json({ ok: true, created, published, auto });
}
