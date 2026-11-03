import type { Metadata, Viewport } from 'next';
import { ConfigBootstrap } from '@/components/site/ConfigBootstrap';
import { getSiteUrl } from '@/lib/config/site-url';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl();
  return {
  metadataBase: new URL(siteUrl),
  title: { default: 'Imperial Royal | Extraordinary Residences & Prestigious Addresses', template: '%s | Imperial Royal' },
  description: 'Discover an exceptional collection of luxury residences, estates and penthouses. A private, discreet real estate experience.',
  keywords: ['luxury real estate', 'imperial royal', 'prestigious residences', 'estates', 'penthouses', 'private property'],
  openGraph: {
    type: 'website', siteName: 'Imperial Royal',
    title: 'Imperial Royal | Where Exceptional Living Meets Timeless Elegance',
    description: 'Discover extraordinary residences, prestigious addresses and exceptional real estate opportunities.',
    images: [{ url: '/images/hero-estate.jpg', width: 1200, height: 675, alt: 'Imperial Royal residence at blue hour' }],
  },
  twitter: { card: 'summary_large_image', title: 'Imperial Royal', description: 'Extraordinary residences. Enduring legacy.' },
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  };
}

export const viewport: Viewport = {
  themeColor: '#090B10', colorScheme: 'dark', width: 'device-width', initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded at runtime in the browser — no build-time font fetch, no Vercel env dependency. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <ConfigBootstrap />
        {children}
      </body>
    </html>
  );
}
