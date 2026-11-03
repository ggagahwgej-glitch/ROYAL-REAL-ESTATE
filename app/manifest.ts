import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Imperial Royal Real Estate',
    short_name: 'Imperial Royal',
    description: 'Extraordinary residences and prestigious addresses.',
    start_url: '/', display: 'standalone', background_color: '#090B10', theme_color: '#C6A45A',
    icons: [
      { src: '/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand-mark-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
