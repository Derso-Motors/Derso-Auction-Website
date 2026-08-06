import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Admin-only: turn the car fields + seller notes into a polished, professional
// Hebrew Facebook Marketplace description using the configured AI model.
export async function POST(req) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad_request' }, { status: 400 }); }
  const f = body || {};
  const facts = [
    f.title && `כותרת: ${f.title}`,
    f.make && `יצרן: ${f.make}`,
    f.model && `דגם: ${f.model}`,
    f.year && `שנה: ${f.year}`,
    f.km && `ק"מ: ${f.km}`,
    f.price && `מחיר: ${f.price} ₪`,
  ].filter(Boolean).join('\n');
  const notes = (f.notes || '').toString().trim();
  if (!facts && !notes) return Response.json({ error: 'empty' }, { status: 400 });

  const key = process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: 'no_ai' }, { status: 503 });
  const model = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 20000);
    const res = await fetch(`${(process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: ac.signal,
      body: JSON.stringify({
        stream: false,
        model,
        temperature: 0.6,
        max_tokens: 400,
        messages: [{ role: 'user', content:
          `כתוב תיאור מודעה מקצועי, אמין וזורם ל-Facebook Marketplace בעברית, עבור רכב ממכרז כינוס נכסים, מטעם "דרסו — בית ליווי מקצועי למכרזים".\n\n` +
          `נתוני הרכב:\n${facts || '(אין)'}\n` +
          (notes ? `\nהערות המוכר לשילוב:\n${notes}\n` : '') +
          `\nכללים: השתמש רק בנתונים ובהערות שסופקו. אל תמציא עובדות (מחיר, תאונות, אבזור) שלא נאמרו, ואל תבטיח הבטחות. טון מקצועי, חם ומזמין, 2–4 שורות תוכן, אפשר אמוג'ים במידה. סיים בדיוק בשלוש שורות יצירת הקשר האלה:\n📞 דרסו ליווי למכרזים\n📱 וואטסאפ: 055-950-6913\n🔗 www.derso-motors.co.il\nהחזר טקסט בלבד, בלי כותרות מיותרות.` }],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[marketplace/describe] AI upstream HTTP ${res.status} model=${model} body=${errText.slice(0, 200)}`);
      return Response.json({ error: 'ai_failed' }, { status: 502 });
    }
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content?.trim();
    if (!out) return Response.json({ error: 'empty' }, { status: 502 });
    return Response.json({ description: out });
  } catch (e) {
    console.error('[marketplace/describe] failed:', e?.name || '', e?.message || '');
    return Response.json({ error: 'exception' }, { status: 502 });
  }
}
