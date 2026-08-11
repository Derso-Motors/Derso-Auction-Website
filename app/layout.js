import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], display: 'swap', weight: '500', variable: '--font-mono' });

export const metadata = {
  metadataBase: new URL('https://auctions.derso.net'),
  title: 'דרסו — בית ליווי מקצועי למכרזים | אזור לקוחות',
  description: 'דרסו ליווי למכרזים — מערכת מעקב רכבים, מכרזים ודוחות ללקוחות',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'דרסו', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'דרסו — ליווי מקצועי למכרזי רכב',
    description: 'קנייה חכמה של רכבים ממכרזים — סינון הזדמנויות, ליווי בהצעות ודוחות בדיקה',
    locale: 'he_IL',
    type: 'website',
    siteName: 'דרסו',
    images: ['/icon-512.png'],
  },
  twitter: { card: 'summary' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#131315',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
