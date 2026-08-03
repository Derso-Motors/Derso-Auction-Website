import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Assistant intake endpoint for the office WhatsApp bot: the owner writes one
// free-text sentence to the bot, the bot's AI parses it and POSTs here.
// Body: { type: 'task'|'note'|'meeting', title, details?, due_at?, client_name?, client_phone?, location? }
// Auth: Authorization: Bearer <CRON_SECRET>
export async function POST(req) {
  const auth = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 501 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { type, title } = body || {};
  if (!title || !['task', 'note', 'meeting'].includes(type)) {
    return Response.json({ ok: false, error: 'type must be task|note|meeting and title required' }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth: { persistSession: false } });

  if (type === 'meeting') {
    const { data, error } = await supabase.from('meetings').insert({
      client_id: null,
      client_name: body.client_name || null,
      client_phone: body.client_phone || null,
      title,
      scheduled_at: body.due_at || new Date().toISOString(),
      location: body.location || null,
    }).select('id').single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, id: data.id, kind: 'meeting' });
  }

  const { data, error } = await supabase.from('admin_tasks').insert({
    kind: type,
    title,
    details: body.details || null,
    due_at: body.due_at || null,
    remind: !!body.due_at,
    source: 'whatsapp',
  }).select('id').single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id, kind: type });
}
