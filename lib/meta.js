// Meta Graph API publishing — Facebook Page + Instagram Business.
// Env: META_PAGE_ID, META_IG_USER_ID, META_PAGE_ACCESS_TOKEN (long-lived page token).
const GRAPH = 'https://graph.facebook.com/v21.0';

function token() {
  return process.env.META_PAGE_ACCESS_TOKEN;
}

export function metaConfigured() {
  return !!(process.env.META_PAGE_ID && token());
}

async function graph(path, params) {
  const body = new URLSearchParams({ ...params, access_token: token() });
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || `Graph API ${res.status}`);
  return json;
}

export async function postToFacebook(imageUrl, caption) {
  const json = await graph(`${process.env.META_PAGE_ID}/photos`, { url: imageUrl, caption });
  return json.post_id || json.id;
}

export async function postToInstagram(imageUrl, caption) {
  const igId = process.env.META_IG_USER_ID;
  if (!igId) return null;
  const container = await graph(`${igId}/media`, { image_url: imageUrl, caption });
  const pub = await graph(`${igId}/media_publish`, { creation_id: container.id });
  return pub.id;
}

// Post metrics for the learning loop (called ~48h after posting).
export async function fetchPostInsights(fbPostId) {
  const res = await fetch(`${GRAPH}/${fbPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${token()}`);
  const json = await res.json();
  if (json.error) return null;
  return {
    likes: json.likes?.summary?.total_count || 0,
    comments: json.comments?.summary?.total_count || 0,
    shares: json.shares?.count || 0,
  };
}
