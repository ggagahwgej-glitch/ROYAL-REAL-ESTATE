import type { NextConfig } from 'next';

/* Security headers.
   NOTE: no X-Frame-Options / no `frame-ancestors` directive — the owner needs
   to open this site inside the hosted preview frame, and those two would blank
   it. Every other hardening header is safe. The Content-Security-Policy is
   shipped REPORT-ONLY on purpose: it documents the intended origin allowlist
   and surfaces violations in the console without ever breaking a page. */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co",
  "frame-src 'self' https://maps.google.com https://www.google.com https://*.google.com https://www.openstreetmap.org https://*.supabase.co",
  "worker-src 'self' blob:",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Content-Security-Policy-Report-Only', value: CSP },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allows the Arena / hosted dev preview origin to talk to the dev server.
  allowedDevOrigins: ['*.e2b.app', '*.vercel.app'],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: '*.storage.supabase.co' },
    ],
  },
  async redirects() {
    return [{ source: '/admin', destination: '/admin/dashboard', permanent: false }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Uploaded/owner assets are inert content: never let a browser sniff them.
      { source: '/brand/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
    ];
  },
};

export default nextConfig;
