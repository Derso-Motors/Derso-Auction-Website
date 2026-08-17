// Unique AI image per post, via OpenRouter image-capable model.
// The generated art is a background/concept image; exact prices and Hebrew text
// are always rendered by the satori template layer, never by the image model.
import { createClient } from '@supabase/supabase-js';

const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateAiImage(prompt) {
  const key = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');
  const model = process.env.AI_IMAGE_MODEL || 'google/gemini-2.5-flash-image';
  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      modalities: ['image', 'text'],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `OpenRouter ${res.status}`);
  const img = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!img) throw new Error('no image returned');
  return img; // data URL (base64)
}

export async function uploadToStorage(dataUrl, name) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const base64 = dataUrl.split(',')[1];
  const buf = Buffer.from(base64, 'base64');
  const path = `${name}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabase.storage.from('social').upload(path, buf, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('social').getPublicUrl(path);
  return data.publicUrl;
}

export function imagePromptForPost(post) {
  const p = post.payload || {};
  const subject = p.car_title || p.topic || 'רכב יוקרתי';
  return `Cinematic dark luxury studio photo for an Israeli car-auction brand: ${subject}. ` +
    'Deep black background with warm gold rim lighting, premium editorial look, dramatic shadows, ' +
    'square 1:1 composition with empty space at the bottom third for text overlay. ' +
    'NO text, NO letters, NO numbers, NO logos in the image.';
}
