'use client';

import { usePathname } from 'next/navigation';

// Re-mounts its subtree on every route change so the CSS entrance
// animations replay on client-side navigation, not just full loads.
export default function MainAnimator({ children }) {
  const pathname = usePathname();
  return <div key={pathname} className="main-anim">{children}</div>;
}
