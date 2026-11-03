import { SiteChrome } from '@/components/site/SiteChrome';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
