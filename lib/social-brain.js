// "המוח" — web research + self-learning from past post performance.
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
