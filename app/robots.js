export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/terms', '/privacy', '/disclaimer'],
        disallow: ['/admin', '/api', '/messages', '/reports', '/wallet', '/recommended', '/settings', '/subscriptions', '/cars', '/onboarding', '/verify-phone', '/book-call', '/pricing'],
      },
    ],
    sitemap: 'https://auctions.derso.net/sitemap.xml',
  };
}
