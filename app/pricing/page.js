import Shell from '../../components/Shell';
import { requireUser } from '../../lib/supabase-server';
import { REPORT_PACKAGES, growLinkWithParams } from '../../lib/grow';
import PricingClient from './PricingClient';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const { user } = await requireUser();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://auctions.derso.net';

  const packages = REPORT_PACKAGES.map((pkg) => ({
    ...pkg,
    payUrl: growLinkWithParams(pkg.link, {
      userId: user.id,
      custom2: pkg.key,
      successUrl: `${baseUrl}/reports?ok=${encodeURIComponent('התשלום התקבל! החבילה תופעל בקרוב ✓')}`,
      cancelUrl: `${baseUrl}/pricing?err=${encodeURIComponent('התשלום בוטל')}`,
    }),
  }));

  return (
    <Shell active="pricing">
      <PricingClient packages={packages} />
    </Shell>
  );
}
