import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const DAYS = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };

function ilNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
}
function fmtWhen(iso) {
  return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
}

// Heuristic Hebrew parser — fallback when no AI key is configured.
function heuristicParse(text) {
  const t = text.trim();
  let type = 'task';
  if (/פגישה|קבע|להיפגש/.test(t)) type = 'meeting';
  else if (/הערה|לזכור|רשום ש|תרשום ש/.test(t)) type = 'note';
  else if (/תזכיר|תזכורת|משימה/.test(t)) type = 'task';

  const now = ilNow();
  let day = null;
  if (/מחרתיים/.test(t)) { day = new Date(now); day.setDate(day.getDate() + 2); }
  else if (/מחר/.test(t)) { day = new Date(now); day.setDate(day.getDate() + 1); }
  else if (/היום/.test(t)) { day = new Date(now); }
  else {
    const wd = t.match(/ביום ([א-ת]+)/);
    if (wd && DAYS[wd[1]] !== undefined) {
      day = new Date(now);
      let diff = (DAYS[wd[1]] - day.getDay() + 7) % 7; if (diff === 0) diff = 7;
      day.setDate(day.getDate() + diff);
    }
    const dm = t.match(/\b(\d{1,2})[./](\d{1,2})\b/);
    if (!day && dm) {
      day = new Date(now.getFullYear(), Number(dm[2]) - 1, Number(dm[1]));
      if (day < now) day.setFullYear(day.getFullYear() + 1);
    }
  }
  const tm = t.match(/ב-?(\d{1,2})(?::(\d{2}))?\b/) || t.match(/בשעה (\d{1,2})(?::(\d{2}))?/);
  let due_at = null;
  if (day || tm) {
    const d = day || new Date(now);
    const h = tm ? Number(tm[1]) : 9;
    const m = tm && tm[2] ? Number(tm[2]) : 0;
    if (h >= 0 && h <= 23) {
      const pad = (n) => String(n).padStart(2, '0');
      due_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00+03:00`;
    }
  }
  const title = t
    .replace(/^(תזכיר לי|תזכורת|משימה|הערה|רשום|תרשום|קבע|פגישה עם|פגישה)[:\s]*/,'')
    .replace(/מחרתיים|מחר|היום|ביום [א-ת]+/g, '')
    .replace(/ב-?\d{1,2}(:\d{2})?\b/g, '')
    .replace(/בשעה \d{1,2}(:\d{2})?/g, '')
    .replace(/\s+/g, ' ').trim() || t;
  const who = t.match(/עם ([א-ת]+)/);
  return { type, title: type === 'meeting' && who ? `פגישה עם ${who[1]} — ${title}` : title, due_at, client_name: who ? who[1] : null, location: (t.match(/במשרד|בטלפון|בזום/) || [null])[0] };
}

async function aiParse(text) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const nowIL = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'full', timeStyle: 'short' });
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content:
          `אתה עוזר אישי של בעל עסק לליווי מכרזי רכב. עכשיו בישראל: ${nowIL}.\nהמשפט שלו: "${text}"\n` +
          `החזר JSON בלבד: {"type":"meeting|task|note","title":"<כותרת קצרה>","details":"<פרטים או null>","due_at":"<ISO עם +03:00 או null; חשב 'מחר'/ימים מהיום>","client_name":"<שם או null>","location":"<מיקום או null>"}` }],
        temperature: 0.2, max_tokens: 250,
      }),
    });
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content || '';
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    if (a === -1) return null;
    const parsed = JSON.parse(out.slice(a, b + 1));
    return parsed?.title ? parsed : null;
  } catch { return null; }
}

async function postAppsScript(payload) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), redirect: 'follow' });
    return await res.json().catch(() => null);
  } catch { return null; }
}

export async function POST(req) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ reply: 'צריך להתחבר קודם 🙂' }, { status: 401 });
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return Response.json({ reply: 'העוזר זמין למנהל בלבד' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ reply: 'לא הבנתי 🤔' }, { status: 400 }); }
  const text = (body?.message || '').trim();
  if (!text) return Response.json({ reply: 'כתוב לי משהו 🙂' });

  // "What's on today?"
  if (/^(מה יש( לי)?( היום)?|היום\??|הלו"ז|מה הלו"ז)/.test(text)) {
    const now = new Date();
    const start = new Date(now); start.setHours(start.getHours() - 24);
    const [{ data: meetings }, { data: tasks }] = await Promise.all([
      supabase.from('meetings').select('title, scheduled_at, client_name, profiles(full_name)').gte('scheduled_at', now.toISOString().slice(0, 10)).order('scheduled_at').limit(8),
      supabase.from('admin_tasks').select('title, due_at').eq('done', false).order('due_at', { ascending: true, nullsFirst: false }).limit(8),
    ]);
    const mLines = (meetings || []).map((m) => `📅 ${fmtWhen(m.scheduled_at)} — ${m.title} (${m.profiles?.full_name || m.client_name || ''})`);
    const tLines = (tasks || []).map((t) => `☑️ ${t.title}${t.due_at ? ` — ${fmtWhen(t.due_at)}` : ''}`);
    const reply = [...mLines, ...tLines].join('\n') || 'הכל פנוי — אין פגישות ואין משימות פתוחות 🎉';
    return Response.json({ reply });
  }

  const parsed = (await aiParse(text)) || heuristicParse(text);

  if (parsed.type === 'meeting' && parsed.due_at) {
    const { error } = await supabase.from('meetings').insert({
      client_id: null,
      client_name: parsed.client_name || null,
      title: parsed.title,
      scheduled_at: new Date(parsed.due_at).toISOString(),
      location: parsed.location || null,
    });
    if (error) return Response.json({ reply: `לא הצלחתי לרשום את הפגישה 😕 (${error.message})` });
    const cal = await postAppsScript({ action: 'createMeeting', title: parsed.title, startISO: parsed.due_at, durationMin: 60, notes: parsed.details || '' });
    return Response.json({
      reply: `📅 קבעתי: *${parsed.title}*\n🕓 ${fmtWhen(parsed.due_at)}${parsed.location ? `\n📍 ${parsed.location}` : ''}\n✅ נוסף ליומן באתר${cal ? ' וגם ליומן גוגל' : ''}`,
    });
  }

  const kind = parsed.type === 'note' ? 'note' : 'task';
  const { error } = await supabase.from('admin_tasks').insert({
    kind,
    title: parsed.title,
    details: parsed.details || null,
    due_at: parsed.due_at || null,
    remind: !!parsed.due_at,
    source: 'assistant',
  });
  if (error) return Response.json({ reply: `לא הצלחתי לרשום 😕 (${error.message})` });
  return Response.json({
    reply: `${kind === 'note' ? '📝 רשמתי את ההערה' : '☑️ רשמתי משימה'}: *${parsed.title}*` +
      (parsed.due_at ? `\n⏰ אזכיר לך בוואטסאפ ב-${fmtWhen(parsed.due_at)}` : '') +
      `\nרואים הכל בעמוד "משימות והיום"`,
  });
}
