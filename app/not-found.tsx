import Link from 'next/link';
import { Brand } from '@/components/brand/Brand';
import { ArrowUpRight } from 'lucide-react';
export default function NotFound() {
  return (
    <div className="setup-shell">
      <div className="text-center" style={{ maxWidth: 560 }}>
        <Brand variant="emblem" href={null} />
        <p className="eyebrow no-line mt-32">Error 404</p>
        <h1 className="display-sm mt-16">This address does not exist.</h1>
        <p className="muted mt-16">The page you requested may have moved, or never formed part of our collection.</p>
        <div className="flex gap-12 center mt-32 wrap" style={{ justifyContent: 'center' }}>
          <Link href="/" className="btn btn-gold">Return home <ArrowUpRight size={15} /></Link>
          <Link href="/properties" className="btn btn-outline">Explore properties</Link>
        </div>
      </div>
    </div>
  );
}
