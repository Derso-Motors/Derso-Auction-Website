import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import Chat from './chat';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const { supabase, user } = await requireUser();
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at');

  return (
    <Shell active="messages">
      <div className="page-title">שאלות ופניות</div>
      <div className="page-sub">כאן אפשר לשאול כל שאלה — נחזור אליך בהקדם</div>
      <div className="card">
        <Chat clientId={user.id} initialMessages={messages || []} />
      </div>
    </Shell>
  );
}
