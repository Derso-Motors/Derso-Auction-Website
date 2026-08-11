import Shell from '../../../components/Shell';
import { requireAdmin } from '../../../lib/supabase-server';
import NadavLive from './NadavLive';

export const dynamic = 'force-dynamic';

export default async function NadavPage() {
  const { supabase } = await requireAdmin();

  const { data: row } = await supabase.from('nadav_state').select('state').eq('id', 'current').single();

  return (
    <Shell active="nadav">
      <div className="page-title">נדב — מרכז תפעול</div>
      <div className="page-sub">איסוף, שליחים ומשלוחים — בזמן אמת</div>
      <NadavLive initial={row?.state || {}} />
    </Shell>
  );
}
