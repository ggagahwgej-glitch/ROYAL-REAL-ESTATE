import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allows the Arena / hosted dev preview origin to talk to the dev server.
  allowedDevOrigins: ['*.e2b.app', '*.vercel.app'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: '*.storage.supabase.co' },
    ],
  },
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/admin', destination: '/admin/dashboard', permanent: false }];
  },
};

export default nextConfig;
