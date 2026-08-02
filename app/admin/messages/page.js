import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import Messenger from './messenger';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const { supabase, user } = await requireUser();
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') redirect('/');

  const { data: clients } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'client')
    .order('created_at', { ascending: false });

  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });

  const conversations = (clients || []).map((c) => {
    const msgs = (allMessages || []).filter((m) => m.client_id === c.id);
    const last = msgs[0];
    const unreadCount = msgs.filter((m) => m.sender_role === 'client' && !m.read).length;
    return {
      ...c,
      lastMessage: last?.body || null,
      lastAt: last?.created_at || null,
      unreadCount,
      messages: msgs.reverse(),
    };
  }).sort((a, b) => {
    if (!a.lastAt && !b.lastAt) return 0;
    if (!a.lastAt) return 1;
    if (!b.lastAt) return -1;
    return new Date(b.lastAt) - new Date(a.lastAt);
  });

  return (
    <Shell active="admin">
      <div className="page-title">הודעות</div>
      <div className="page-sub">צ׳אט עם לקוחות — סגנון מסנג׳ר</div>
      <Messenger conversations={conversations} />
    </Shell>
  );
}
