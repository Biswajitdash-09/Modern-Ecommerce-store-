import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maison Verrel — The Rail',
  description:
    'Maison Verrel luxury fashion storefront hero featuring an interactive curved gold clothing rail.',
  openGraph: {
    title: 'Maison Verrel — The Rail',
    description:
      'Maison Verrel luxury fashion storefront hero featuring an interactive curved gold clothing rail.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maison Verrel — The Rail',
    description:
      'Maison Verrel luxury fashion storefront hero featuring an interactive curved gold clothing rail.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="is-loading" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://images.higgs.ai" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
