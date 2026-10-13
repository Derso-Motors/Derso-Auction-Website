// Read-only snapshot of the Socialync workspace for the accounts hub.
// Socialync doesn't document its response shapes, so everything here is parsed defensively
// and the raw responses are kept for the diagnostics panel.
import { MCP_URL, mcpSession } from './meta';

let rpcId = 1000;

async function rpc(session, method, params) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: ++rpcId }),
    cache: 'no-store',
  });
  const text = await res.text();
  // Streamable HTTP may answer as SSE; the JSON-RPC message is then on the last `data:` line.
  const body = text.trimStart().startsWith('{')
    ? text
    : (text.split('\n').filter((l) => l.startsWith('data:')).pop() || '').slice(5);
  if (!body.trim()) throw new Error(`HTTP ${res.status}`);
  const json = JSON.parse(body);
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result;
}

async function callTool(session, name, args) {
  const result = await rpc(session, 'tools/call', { name, arguments: args });
  const text = result?.content?.find((c) => c.type === 'text')?.text;
  if (result?.isError) throw new Error(text || 'tool error');
  if (text == null) return result;
  try { return JSON.parse(text); } catch { return { text }; }
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Responses wrap their lists differently ({ connections: [...] }, { data: { items: [...] } }, a bare array).
export function arrayIn(v, depth = 0) {
  if (Array.isArray(v)) return v;
  if (!isObj(v) || depth > 2) return [];
  for (const val of Object.values(v)) if (Array.isArray(val) && val.some(isObj)) return val;
  for (const val of Object.values(v)) {
    const inner = arrayIn(val, depth + 1);
    if (inner.length) return inner;
  }
  return [];
}

function pick(o, keys) {
  for (const src of [o, o?.account, o?.profile, o?.connection]) {
    if (!isObj(src)) continue;
    for (const k of keys) {
      const v = src[k];
      if (v != null && v !== '' && typeof v !== 'object') return v;
    }
  }
  return null;
}

const PLATFORM_ALIASES = {
  instagram: ['instagram', 'ig', 'instagram_business'],
  tiktok: ['tiktok', 'tt'],
  facebook: ['facebook', 'fb', 'facebook_page'],
  youtube: ['youtube', 'yt'],
  linkedin: ['linkedin', 'linkedin_page'],
  x: ['x', 'twitter'],
  threads: ['threads'],
  bluesky: ['bluesky', 'bsky'],
  pinterest: ['pinterest'],
};

export function normPlatform(p) {
  const s = String(p || '').toLowerCase().trim();
  for (const [key, aliases] of Object.entries(PLATFORM_ALIASES)) if (aliases.includes(s)) return key;
  return s || 'unknown';
}

function health(c) {
  const raw = pick(c, ['healthy', 'isHealthy', 'is_healthy', 'status', 'health', 'connectionStatus', 'state', 'connected', 'isConnected']);
  if (raw === true) return 'ok';
  if (raw === false) return 'bad';
  const s = String(raw ?? '').toLowerCase();
  if (/expired|error|disconnect|invalid|revoked|reauth|broken|unhealthy|fail/.test(s)) return 'bad';
  if (/ok|healthy|active|connected|valid|good|live/.test(s)) return 'ok';
  return 'unknown';
}

const SECRET_KEY = /token|secret|password|apikey|api_key|authorization|cookie/i;
export function redact(v) {
  if (Array.isArray(v)) return v.map(redact);
  if (!isObj(v)) return v;
  return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, SECRET_KEY.test(k) ? '[hidden]' : redact(val)]));
}

function toAccount(c, profile, index) {
  const platform = normPlatform(pick(c, ['platform', 'provider', 'network', 'service', 'type', 'channel']));
  const handle = pick(c, ['username', 'handle', 'screenName', 'screen_name', 'accountHandle', 'account_username']);
  const name = pick(c, ['displayName', 'display_name', 'accountName', 'account_name', 'name', 'title', 'pageName']);
  return {
    key: `${profile?.id ?? 'p'}:${pick(c, ['id', 'connectionId', 'accountId', 'account_id']) ?? index}`,
    platform,
    name: name || handle || platform,
    handle: handle ? (String(handle).startsWith('@') ? handle : `@${handle}`) : null,
    avatar: pick(c, ['avatarUrl', 'avatar_url', 'avatar', 'profilePicture', 'profile_picture_url', 'picture', 'imageUrl', 'image']),
    followers: Number(pick(c, ['followers', 'followerCount', 'followers_count', 'follower_count'])) || null,
    status: health(c),
    statusText: pick(c, ['statusMessage', 'status_message', 'error', 'reason', 'status', 'health']),
    profileId: profile?.id ?? null,
    profileName: profile?.name ?? null,
    raw: redact(c),
  };
}

// Analytics come per platform; match the entry for this account's platform.
function platformStats(analytics, platform) {
  if (!analytics) return null;
  const rows = arrayIn(analytics).filter((r) => isObj(r) && pick(r, ['platform', 'provider', 'network']));
  const hit = rows.find((r) => normPlatform(pick(r, ['platform', 'provider', 'network'])) === platform);
  if (hit) return hit;
  for (const container of [analytics, analytics.platforms, analytics.byPlatform, analytics.breakdown, analytics.data]) {
    if (!isObj(container)) continue;
    const k = Object.keys(container).find((key) => normPlatform(key) === platform);
    if (k && isObj(container[k])) return container[k];
  }
  return null;
}

function postsFor(top, platform) {
  return arrayIn(top)
    .filter((p) => {
      const plats = [pick(p, ['platform', 'provider', 'network']), ...(Array.isArray(p.platforms) ? p.platforms : [])];
      return plats.some((x) => normPlatform(typeof x === 'object' ? x?.platform : x) === platform);
    })
    .slice(0, 6)
    .map((p) => ({
      text: pick(p, ['caption', 'text', 'content', 'title', 'body']) || '',
      url: pick(p, ['url', 'permalink', 'postUrl', 'link']),
      date: pick(p, ['publishedAt', 'published_at', 'postedAt', 'createdAt', 'created_at', 'date']),
      views: pick(p, ['views', 'viewCount', 'impressions', 'plays']),
      likes: pick(p, ['likes', 'likeCount']),
      comments: pick(p, ['comments', 'commentCount']),
      shares: pick(p, ['shares', 'shareCount']),
      engagement: pick(p, ['engagementRate', 'engagement_rate', 'engagement']),
      verdict: pick(p, ['status', 'performance', 'label']),
    }));
}

// Fill the arguments a read tool accepts, using its declared input schema.
function argsFor(tool, profileId, extra = {}) {
  const props = tool?.inputSchema?.properties || {};
  const args = {};
  for (const [k, def] of Object.entries(props)) {
    if (/profile/i.test(k) && profileId != null) args[k] = profileId;
    else if (Array.isArray(def?.enum) && def.enum.includes('month')) args[k] = 'month';
    else if (def?.type === 'boolean' && /platform|breakdown/i.test(k)) args[k] = true;
    else if (k in extra) args[k] = extra[k];
  }
  return args;
}

export async function loadSocialHub() {
  if (!process.env.SOCIALYNC_API_KEY) return { error: 'missing_key', accounts: [], raw: {} };

  let session;
  try {
    session = await mcpSession();
  } catch (e) {
    return { error: e.message, accounts: [], raw: {} };
  }

  const raw = {};
  const call = async (label, name, args) => {
    try {
      const r = await callTool(session, name, args);
      raw[label] = { args, response: redact(r) };
      return r;
    } catch (e) {
      raw[label] = { args, error: e.message };
      return null;
    }
  };

  let tools = [];
  try {
    tools = (await rpc(session, 'tools/list', {}))?.tools || [];
  } catch (e) {
    raw['tools/list'] = { error: e.message };
  }
  const tool = (n) => tools.find((t) => t.name === n);

  const profileRows = arrayIn(await call('list_profiles', 'list_profiles', {}));
  const profiles = profileRows.length
    ? profileRows.map((p) => ({ id: pick(p, ['id', 'profileId', 'profile_id']), name: pick(p, ['name', 'title', 'brandName']) }))
    : [{ id: null, name: null }];

  const accounts = [];
  await Promise.all(profiles.map(async (profile) => {
    const tag = profile.name || profile.id || 'default';
    const [connections, analytics, top] = await Promise.all([
      call(`list_connections · ${tag}`, 'list_connections', argsFor(tool('list_connections'), profile.id)),
      tool('get_analytics') ? call(`get_analytics · ${tag}`, 'get_analytics', argsFor(tool('get_analytics'), profile.id)) : null,
      tool('get_top_posts') ? call(`get_top_posts · ${tag}`, 'get_top_posts', argsFor(tool('get_top_posts'), profile.id, { limit: 30, sort: 'engagement' })) : null,
    ]);
    arrayIn(connections).forEach((c, i) => {
      const acc = toAccount(c, profile, i);
      acc.stats = redact(platformStats(analytics, acc.platform));
      acc.topPosts = postsFor(top, acc.platform);
      accounts.push(acc);
    });
  }));

  accounts.sort((a, b) => (a.profileName || '').localeCompare(b.profileName || '', 'he') || a.platform.localeCompare(b.platform));

  return {
    error: null,
    accounts,
    profileCount: profileRows.length,
    tools: tools.map((t) => ({ name: t.name, description: t.description || '', params: Object.keys(t.inputSchema?.properties || {}) })),
    raw,
  };
}
