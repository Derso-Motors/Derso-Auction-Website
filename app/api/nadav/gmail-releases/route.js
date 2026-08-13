export const dynamic = 'force-dynamic';

// Bot-facing Gmail proxy: the office bot is a plain Node process and cannot use
// the Gmail MCP, so it polls this route (portalGetJson) which reads recent mail
// via the Gmail REST API using an OAuth refresh token. The bot then classifies
// each message with its own AI. Same Bearer-CRON_SECRET auth as the other bot routes.

function authorized(req) {
  const auth = req.headers.get('authorization') || '';
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

// Exchange the long-lived refresh token for a short-lived access token.
async function getAccessToken() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;
  const body = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    client_secret: GMAIL_CLIENT_SECRET,
    refresh_token: GMAIL_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j && j.access_token ? j.access_token : null;
}

function b64urlDecode(data) {
  try {
    return Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch { return ''; }
}

// Walk the MIME tree and pull the first text/plain body (fallback: text/html stripped).
function extractBody(payload) {
  if (!payload) return '';
  const walk = (p, mime) => {
    if (!p) return '';
    if (p.mimeType === mime && p.body && p.body.data) return b64urlDecode(p.body.data);
    for (const part of p.parts || []) {
      const got = walk(part, mime);
      if (got) return got;
    }
    return '';
  };
  const plain = walk(payload, 'text/plain');
  if (plain) return plain;
  const html = walk(payload, 'text/html');
  return html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const token = await getAccessToken();
  if (!token) return Response.json({ ok: false, error: 'gmail not configured' }, { status: 501 });

  // Configurable Gmail search. Default: last 2 days mentioning release/impound terms.
  // Set GMAIL_LAWYER_QUERY to e.g. `from:lawyer@firm.co.il newer_than:2d` to scope tighter.
  const q = process.env.GMAIL_LAWYER_QUERY || 'newer_than:2d (שחרור OR מגרש OR רכב)';
  const auth = { Authorization: `Bearer ${token}` };

  const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=' + encodeURIComponent(q);
  const lr = await fetch(listUrl, { headers: auth });
  if (!lr.ok) return Response.json({ ok: false, error: `gmail list ${lr.status}` }, { status: 502 });
  const lj = await lr.json().catch(() => ({}));
  const ids = (lj.messages || []).map((m) => m.id);

  const messages = [];
  for (const id of ids) {
    try {
      const gr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: auth });
      if (!gr.ok) continue;
      const gj = await gr.json();
      const headers = (gj.payload && gj.payload.headers) || [];
      const h = (name) => (headers.find((x) => x.name.toLowerCase() === name) || {}).value || '';
      messages.push({
        id,
        from: h('from'),
        subject: h('subject'),
        snippet: gj.snippet || '',
        body: extractBody(gj.payload).slice(0, 4000),
      });
    } catch {}
  }

  return Response.json({ ok: true, messages });
}
