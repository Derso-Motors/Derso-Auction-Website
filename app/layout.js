import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], display: 'swap', weight: '500', variable: '--font-mono' });

export const metadata = {
  title: 'דרסו — בית ליווי מקצועי למכרזים | אזור לקוחות',
  description: 'דרסו ליווי למכרזים — מערכת מעקב רכבים, מכרזים ודוחות ללקוחות',
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
