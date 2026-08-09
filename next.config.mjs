/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async rewrites() {
    // nadav.derso.net שורש → עמוד נדב. משפיע רק על ה-host הזה; auctions.derso.net לא נוגע.
    return {
      beforeFiles: [
        { source: '/', has: [{ type: 'host', value: 'nadav.derso.net' }], destination: '/nadav.html' },
      ],
    };
  },
};
export default nextConfig;
