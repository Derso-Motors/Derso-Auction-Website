import Shell from '../../../../components/Shell';
import { requireUser } from '../../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import Chat from '../../../messages/chat';

export const dynamic = 'force-dynamic';

export default async function AdminChatPage({ params }) {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');

  const [{ data: client }, { data: messages }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.clientId).single(),
    supabase.from('messages').select('*').eq('client_id', params.clientId).order('created_at'),
  ]);

  await supabase.from('messages').update({ read: true })
    .eq('client_id', params.clientId).eq('sender_role', 'client').eq('read', false);

  return (
    <Shell active="admin">
      <div className="page-title">צ'אט עם {client?.full_name || 'לקוח'}</div>
      <div className="page-sub">{client?.phone || ''}</div>
      <div className="card">
        <Chat clientId={params.clientId} initialMessages={messages || []} senderRole="admin" />
      </div>
    </Shell>
  );
}
