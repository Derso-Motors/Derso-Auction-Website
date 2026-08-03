import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import RecommendedClient from './RecommendedClient';

export const dynamic = 'force-dynamic';

export default async function RecommendedPage() {
  const { supabase, user } = await requireUser();

  const { data: lists } = await supabase
    .from('recommendation_lists')
    .select('id, title, created_at, recommended_cars(*)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false });

  const cars = (lists || [])
    .flatMap((l) => l.recommended_cars || [])
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <Shell active="recommended">
      <h1 className="page-title">רכבים בהמלצה 🚗</h1>
      <p className="page-sub">רכבים שבחרנו במיוחד עבורך — סמן מה מעניין אותך ונתקדם</p>
      <RecommendedClient initialCars={cars} />
    </Shell>
  );
}
