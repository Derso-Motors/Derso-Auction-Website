// Socialync MCP client — publishes to connected social platforms.
// Env: SOCIALYNC_API_KEY (sk_live_...).
// Replaces the old direct Meta Graph API integration.

const MCP_URL = 'https://mcp.socialync.io/mcp';

// Default platforms to post to (conserve free-tier quota).
// Override with SOCIALYNC_PLATFORMS env var, e.g. "instagram,facebook,tiktok".
const DEFAULT_PLATFORMS = (process.env.SOCIALYNC_PLATFORMS || 'instagram').split(',').map(s => s.trim()).filter(Boolean);

function apiKey() {
  return process.env.SOCIALYNC_API_KEY;
}

export function socialyncConfigured() {
  return !!apiKey();
}

// ── MCP transport ──

async function mcpSession() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${apiKey()}`,
  };
  const res = await fetch(MCP_URL, {
    method: 'POST', headers,
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'initialize', id: 1,
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'derso-portal', version: '1.0' } },
    }),
  });
  if (!res.ok) throw new Error(`Socialync init failed: ${res.status}`);
  const sessionId = res.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('No Socialync session ID');
  return { sessionId, headers: { ...headers, 'Mcp-Session-Id': sessionId } };
}

let _idCounter = 10;

async function mcpCall(session, toolName, args) {
  const id = ++_idCounter;
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: toolName, arguments: args }, id }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Socialync ${toolName}: ${json.error.message}`);
  const text = json.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : json.result;
}

// ── Public API ──

// images: a single URL or an array of URLs (array = carousel post)
export async function postToSocialync(images, caption, platforms) {
  const session = await mcpSession();
  const plats = platforms || DEFAULT_PLATFORMS;
  const imageUrls = Array.isArray(images) ? images : [images];

  // Validate first
  const validation = await mcpCall(session, 'validate_post', {
    platforms: plats,
    caption,
    imageUrls,
  });

  if (validation.errors?.length) {
    throw new Error(`Validation failed: ${validation.errors.map(e => e.message || e).join(', ')}`);
  }

  // Publish immediately (the cron/admin is the "consent" layer)
  const result = await mcpCall(session, 'publish_now', {
    platforms: plats,
    caption,
    imageUrls,
  });

  return result;
}

// Schedule a post for a future date
export async function scheduleToSocialync(images, caption, scheduledFor, platforms) {
  const session = await mcpSession();
  const plats = platforms || DEFAULT_PLATFORMS;
  const imageUrls = Array.isArray(images) ? images : [images];

  await mcpCall(session, 'validate_post', { platforms: plats, caption, imageUrls, scheduledFor });

  return mcpCall(session, 'publish_scheduled', { platforms: plats, caption, imageUrls, scheduledFor });
}

// Backwards-compatible wrappers used by social.js
export async function postToFacebook(imageUrl, caption) {
  const result = await postToSocialync(imageUrl, caption, ['facebook']);
  return result.results?.find(r => r.platform === 'facebook')?.postId || result.groupId;
}

export async function postToInstagram(imageUrl, caption) {
  const result = await postToSocialync(imageUrl, caption, ['instagram']);
  return result.results?.find(r => r.platform === 'instagram')?.postId || result.groupId;
}

// Publish to all configured platforms at once
export async function postToAll(images, caption) {
  return postToSocialync(images, caption);
}

// Post analytics for the learning loop
export async function fetchPostInsights() {
  try {
    const session = await mcpSession();
    const data = await mcpCall(session, 'get_top_posts', { sort: 'engagement', limit: 10 });
    return data;
  } catch {
    return null;
  }
}

// Check remaining quota
export async function checkQuota() {
  const session = await mcpSession();
  return mcpCall(session, 'check_quota', {});
}

// List connected platforms
export async function listConnections() {
  const session = await mcpSession();
  return mcpCall(session, 'list_connections', {});
}
