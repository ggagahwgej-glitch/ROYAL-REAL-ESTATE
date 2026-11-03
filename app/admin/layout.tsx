import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: { default: 'Owner Studio', template: '%s | Owner Studio' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  alternates: { canonical: undefined },
};
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-page">{children}</div>;
}
