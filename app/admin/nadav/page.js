import Shell from '../../../components/Shell';
import { requireUser } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import NadavLive from './NadavLive';

export const dynamic = 'force-dynamic';

export default async function NadavPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');

  const { data: row } = await supabase.from('nadav_state').select('state').eq('id', 'current').single();

  return (
    <Shell active="nadav">
      <div className="page-title">נדב — מרכז תפעול</div>
      <div className="page-sub">איסוף, שליחים ומשלוחים — בזמן אמת</div>
      <NadavLive initial={row?.state || {}} />
    </Shell>
  );
}
