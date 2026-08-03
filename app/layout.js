import './globals.css';

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
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
