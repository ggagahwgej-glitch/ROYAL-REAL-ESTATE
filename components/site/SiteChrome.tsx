'use client';
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { useSiteSettings } from '@/lib/hooks/useSiteData';

export function SiteChrome({ children }: { children: ReactNode }) {
  const { settings, error, warning, warningDetail } = useSiteSettings();
  return <>
    <Header />
    <main id="main-content">
      {error && <div className="container" style={{ paddingTop: 'calc(var(--header-h) + 12px)' }}>
        <div className="notice notice-warning"><span>{error} <a className="gold" href="/admin/configuration">Review the backend setup →</a></span></div>
      </div>}
      {!error && warning && <div className="container" style={{ paddingTop: 'calc(var(--header-h) + 12px)' }}>
        <div className="notice notice-info"><span>{warning} <a className="gold" href="/admin/configuration">Owner setup →</a>
          {warningDetail && <details className="technical-detail"><summary>Technical detail</summary><code>{warningDetail}</code></details>}
        </span></div>
      </div>}
      {children}
    </main>
    <Footer settings={settings} />
  </>;
}
