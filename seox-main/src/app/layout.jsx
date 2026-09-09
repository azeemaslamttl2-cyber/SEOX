import './globals.css';

export const metadata = {
  title: 'PGC',
  description: 'SEO intelligence platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
