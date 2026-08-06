import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Admin-only: extract structured car fields from pasted BidSpirit ad text
// using the configured AI model. Robust to any make/model (no hardcoded lists).
export async function POST(req) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return Response.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad_request' }, { status: 400 }); }
  const text = (body?.text || '').trim();
  if (!text) return Response.json({ error: 'empty' }, { status: 400 });

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
        temperature: 0.1,
        max_tokens: 500,
        messages: [{ role: 'user', content:
          `חלץ נתוני רכב מטקסט של מודעת מכרז (BidSpirit). החזר JSON תקין בלבד, ללא טקסט נוסף, בדיוק בשדות האלה: ` +
          `{"title":"","year":"","make":"","model":"","km":"","price":""}\n` +
          `הסבר: make=יצרן, model=דגם, year=שנת יצור (4 ספרות), km=קילומטראז' כמספר בלבד (בלי פסיקים ויחידות), price=מחיר בש"ח כמספר בלבד (אם אין מחיר השאר ריק), title=כותרת קצרה (יצרן דגם שנה). אם שדה לא ידוע השאר מחרוזת ריקה.\n\nהטקסט:\n"""${text.slice(0, 6000)}"""` }],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[marketplace/parse] AI upstream HTTP ${res.status} model=${model} body=${errText.slice(0, 200)}`);
      return Response.json({ error: 'ai_failed' }, { status: 502 });
    }
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content || '';
    const a = out.indexOf('{'), z = out.lastIndexOf('}');
    if (a === -1) return Response.json({ error: 'no_json' }, { status: 502 });
    let parsed;
    try { parsed = JSON.parse(out.slice(a, z + 1)); } catch { return Response.json({ error: 'bad_json' }, { status: 502 }); }
    const clean = (v) => (v == null ? '' : String(v)).trim();
    const num = (v) => clean(v).replace(/[^\d]/g, '');
    return Response.json({
      title: clean(parsed.title),
      year: num(parsed.year),
      make: clean(parsed.make),
      model: clean(parsed.model),
      km: num(parsed.km),
      price: num(parsed.price),
    });
  } catch (e) {
    console.error('[marketplace/parse] failed:', e?.name || '', e?.message || '');
    return Response.json({ error: 'exception' }, { status: 502 });
  }
}
