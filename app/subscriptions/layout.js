import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsLayout({ children }) {
  await requireUser();
  return <Shell active="subscriptions">{children}</Shell>;
}
