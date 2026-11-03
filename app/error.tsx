'use client';
import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="setup-shell">
      <div className="login-card text-center">
        <Brand variant="emblem" href={null} />
        <AlertCircle className="gold mt-24" style={{ margin: '24px auto 0' }} size={30} />
        <h1 className="h2 mt-16">Something interrupted your viewing.</h1>
        <p className="small muted mt-16">We could not complete this request. The issue has been recorded; please try again.</p>
        {error?.message && <p className="tiny muted mt-8">{error.message}</p>}
        <div className="flex gap-12 center mt-32 wrap" style={{ justifyContent: 'center' }}>
          <button className="btn btn-gold" onClick={reset}><RotateCcw size={15} /> Try again</button>
          <Link href="/" className="btn btn-outline">Return home</Link>
        </div>
      </div>
    </div>
  );
}
