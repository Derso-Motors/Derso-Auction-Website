import './globals.css';

export const metadata = {
  title: 'דרסו — ליווי למכרזים | אזור לקוחות',
  description: 'דרסו ליווי למכרזים — מערכת מעקב רכבים, מכרזים ודוחות ללקוחות',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
