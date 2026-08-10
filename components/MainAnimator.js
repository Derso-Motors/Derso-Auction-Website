'use client';

import { usePathname } from 'next/navigation';

// Re-mounts the page content on every route change so CSS entrance
// animations replay on client-side navigation.
export default function MainAnimator({ children }) {
  const pathname = usePathname();
  return <div key={pathname} className="main-anim">{children}</div>;
}
