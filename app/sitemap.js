export default function sitemap() {
  const base = 'https://auctions.derso.net';
  return ['/', '/login', '/terms', '/privacy', '/disclaimer'].map((path) => ({
    url: base + (path === '/' ? '' : path),
    lastModified: new Date(),
  }));
}
