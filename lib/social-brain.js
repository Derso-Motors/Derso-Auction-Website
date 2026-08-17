// "המוח" — web research + trending-topic monitoring + self-learning from post performance.
import { TOPIC_AREAS, MISSION } from './social-guidelines';

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function aiChat(messages, { model, online } = {}) {
  const key = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');
  let m = model || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5';
  if (online && !m.endsWith(':online')) m += ':online'; // OpenRouter web-search plugin
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: m, messages }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `OpenRouter ${res.status}`);
  return json.choices?.[0]?.message?.content || '';
}

// Fresh market context from the web, injected into caption prompts.
export async function webMarketContext() {
  try {
    return await aiChat([{
      role: 'user',
      content: 'סכם ב-5 נקודות קצרות את החדשות והטרנדים העדכניים בשוק הרכב הישראלי ובמכרזי רכב (מחירים, דגמים מבוקשים, רגולציה). עברית בלבד, עובדות בלבד.',
    }], { online: true });
  } catch { return ''; }
}

// ── Trending-topic monitoring across all topic areas ──
// Scans the web for hot, recent Israeli topics in each area and returns
// candidate post subjects. Results are stored in social_trends for the dashboard.
export async function scanTrendingTopics(supabase) {
  const areas = TOPIC_AREAS.filter((a) => a.key !== 'auctions');
  const raw = await aiChat([
    {
      role: 'system',
      content: `${MISSION}\nאתה מנטר חדשות עבור עמודי הסושיאל של דרסו רכבים. החזר JSON בלבד, בלי הסברים.`,
    },
    {
      role: 'user',
      content: 'מצא את הנושאים החמים והעדכניים ביותר בישראל מהשבוע האחרון בתחומים הבאים:\n' +
        areas.map((a) => `- ${a.label} (${a.key}): ${a.desc}`).join('\n') +
        '\n\nהחזר מערך JSON של עד 6 פריטים, כל אחד: {"area": "<key>", "topic": "<כותרת קצרה>", "facts": "<2-3 עובדות מרכזיות עם מספרים>", "pain_point": "<נקודת הכאב לצופה>", "service_angle": "<מה הצופה מרוויח מלדעת את זה>"}',
    },
  ], { online: true });

  let items = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    items = JSON.parse(match ? match[0] : raw);
  } catch { return []; }
  items = (Array.isArray(items) ? items : []).filter((t) => t.topic && t.area);

  // Store for the dashboard (best-effort)
  if (supabase && items.length) {
    try {
      await supabase.from('social_trends').insert(items.map((t) => ({
        area: t.area, topic: t.topic, facts: t.facts || '', pain_point: t.pain_point || '', service_angle: t.service_angle || '',
      })));
    } catch { /* table may not exist yet */ }
  }
  return items;
}

// Top performing past captions as style examples (self-learning loop).
export async function topPerformerExamples(supabase) {
  const { data } = await supabase
    .from('social_insights')
    .select('likes, comments, shares, post_id, social_posts(caption)')
    .order('likes', { ascending: false })
    .limit(5);
  return (data || [])
    .map((r) => r.social_posts?.caption)
    .filter(Boolean)
    .map((c, i) => `דוגמה מצליחה ${i + 1}:\n${c}`)
    .join('\n\n');
}
