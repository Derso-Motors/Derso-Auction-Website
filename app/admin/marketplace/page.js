import Shell from '../../../components/Shell';
import MarketplaceClient from './MarketplaceClient';

export const dynamic = 'force-dynamic';

export default function MarketplacePage() {
  return (
    <Shell active="marketplace">
      <MarketplaceClient />
    </Shell>
  );
}
