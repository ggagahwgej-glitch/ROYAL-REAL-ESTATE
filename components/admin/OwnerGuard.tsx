'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldX, LogOut, Database, ArrowRight, LockKeyhole } from 'lucide-react';
import { BrandLoader } from '@/components/brand/Brand';
import { SetupState } from '@/components/site/SetupState';
import { Notice } from '@/components/ui/UI';
import { useOwner } from '@/lib/hooks/useOwner';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';

/**
 * Frontend guard for usability. REAL security is enforced by:
 *  - Supabase Auth session validation (auth.getUser)
 *  - profiles.is_owner + Row Level Security on every table
 *  - server-side owner verification on /api/public-config
 * Hiding UI alone is never treated as security.
 *
 * Bootstrap exception: /admin/configuration stays reachable while NO shared
 * public configuration has been published. Without this window a brand-new
 * deployment could not be configured at all (the owner account cannot be
 * provisioned before the project is connected). Publishing a shared config
 * still requires a server-verified owner session, so this window grants no
 * privileged database access. Once shared config exists, the guard is strict.
 */
export function OwnerGuard({ children, allowSetup = false }: { children: React.ReactNode; allowSetup?: boolean }) {
  const owner = useOwner();
  const config = useSupabaseConfig();
  const router = useRouter();
  const pathname = usePathname();
  const bootstrap = allowSetup && !config.shared;

  useEffect(() => {
    if (bootstrap) return;
    if (owner.status === 'unauthenticated' || owner.status === 'expired') {
      const reason = owner.status === 'expired' ? 'expired' : 'signin';
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}&reason=${reason}`);
    }
  }, [owner.status, pathname, router, bootstrap]);

  if (owner.status === 'unauthorized') return <AccessDenied owner={owner} />;

  if (bootstrap) {
    if (owner.status === 'loading' || !config.initialized) {
      return <div className="setup-shell"><BrandLoader label="Verifying your secure session" /></div>;
    }
    return <>
      {owner.status !== 'authenticated' && <Notice tone="warning" className="mb-24">
        <div className="flex between center gap-16 wrap" style={{ width: '100%' }}>
          <span><LockKeyhole size={14} style={{ verticalAlign: 'middle' }} /> <strong>First-run setup window.</strong> No shared configuration is published yet, so this page is available to connect the project. Publishing it — and every administrative database operation — still requires a verified owner session.</span>
          <Link href="/admin/login?next=/admin/configuration" className="link-gold">Owner sign in <ArrowRight size={14} /></Link>
        </div>
      </Notice>}
      {children}
    </>;
  }

  if (owner.status === 'loading' || !config.initialized) {
    return <div className="setup-shell"><BrandLoader label="Verifying your secure session" /></div>;
  }

  if (owner.status === 'no-config') {
    return <div className="admin-content"><SetupState config={config} compact context="admin" /></div>;
  }

  if (owner.status === 'unauthenticated' || owner.status === 'expired') {
    return <div className="setup-shell"><BrandLoader label="Redirecting to secure sign in" /></div>;
  }

  if (owner.status === 'error' && /does not exist|42P01|schema|Could not verify|relation /i.test(owner.message ?? '')) {
    return (
      <div className="setup-shell">
        <div className="login-card">
          <Database size={32} className="gold" style={{ margin: '0 auto 18px' }} />
          <p className="eyebrow no-line">Database setup required</p>
          <h1 className="h2 mt-16">Install the application schema.</h1>
          <p className="small muted mt-16">{owner.message}</p>
          <Notice tone="warning" className="mt-24">Owner authorization is checked against <code>profiles.is_owner</code>. Until <code>supabase/schema.sql</code> and <code>supabase/owner-provisioning.sql</code> are installed, no account can be verified — including the real owner.</Notice>
          <div className="flex gap-12 center mt-24 wrap" style={{ justifyContent: 'center' }}>
            <Link href="/setup" className="btn btn-gold"><Database size={15} /> Open setup guide</Link>
            <button className="btn btn-outline" onClick={async () => { await owner.signOut(); window.location.href = '/admin/login'; }}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  if (owner.status === 'error') return <AccessDenied owner={owner} />;
  return <>{children}</>;
}

function AccessDenied({ owner }: { owner: ReturnType<typeof useOwner> }) {
  return (
    <div className="setup-shell">
      <div className="login-card text-center">
        <ShieldX size={34} className="gold" style={{ margin: '0 auto 20px' }} />
        <p className="eyebrow no-line">Access denied</p>
        <h1 className="h2 mt-16">Owner privileges required.</h1>
        <p className="small muted mt-16">{owner.message ?? 'Your account is not authorised to use the Owner Studio.'}</p>
        <Notice tone="error" className="mt-24 text-center">Authorization is verified against <code>profiles.is_owner</code> and enforced by Row Level Security. A standard Supabase account cannot access administrative data.</Notice>
        <div className="flex gap-12 center mt-24 wrap" style={{ justifyContent: 'center' }}>
          <button className="btn btn-gold" onClick={async () => { await owner.signOut(); window.location.href = '/admin/login'; }}><LogOut size={15} /> Sign out</button>
          <Link href="/setup" className="btn btn-outline"><Database size={15} /> Setup guide</Link>
        </div>
      </div>
    </div>
  );
}

export function SetupBanner() {
  const config = useSupabaseConfig();
  if (config.source !== 'local' || !config.shared) return null;
  return (
    <Notice tone="info" className="mb-24">
      <div className="flex between center gap-16 wrap" style={{ width: '100%' }}>
        <span><Database size={14} style={{ verticalAlign: 'middle' }} /> This browser uses a <strong>local</strong> configuration. Other visitors use the shared public configuration.</span>
        <Link href="/admin/configuration" className="link-gold">Review configuration <ArrowRight size={14} /></Link>
      </div>
    </Notice>
  );
}
