import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Database, ShieldCheck, Sparkles } from 'lucide-react';
import { Emblem } from '@/components/brand/Emblem';
import { ShowcaseSetupPanel } from '@/components/admin/ShowcaseSetupPanel';
import { LiveSchemaCheck } from '@/components/admin/LiveSchemaCheck';

/**
 * A public, no-index setup guide. It exists because /admin/configuration is
 * correctly locked behind a verified owner session once a shared config is
 * published — and the owner flag itself is provisioned by the SQL below.
 * Without this page the first-run instructions would be unreachable.
 */
export const metadata: Metadata = {
  title: 'Project Setup Guide',
  description: 'One-paste Supabase setup instructions for the Imperial Royal client demonstration.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/setup' },
};

export default function SetupGuidePage() {
  return (
    <main className="section" style={{ paddingTop: 96 }}>
      <div className="container" style={{ maxWidth: 1120 }}>
        <div className="text-center mb-32">
          <Emblem tone="gold" style={{ width: 44, height: 52, margin: '0 auto 20px', display: 'block' }} />
          <p className="eyebrow">Imperial Royal · Owner onboarding</p>
          <h1 className="display gold-gradient-text mt-24">Connect the live collection.</h1>
          <div className="divider" style={{ maxWidth: 260, margin: '24px auto' }} />
          <p className="lead" style={{ maxWidth: 700, margin: '20px auto 0' }}>
            The website is already complete as a labelled demonstration. This guide makes its
            properties, galleries and sample references editable inside the Owner Studio.
          </p>
        </div>

        <div className="grid grid-3 gap-16 mb-32">
          <div className="panel text-center" style={{ padding: 24 }}>
            <Sparkles size={22} className="gold" style={{ margin: '0 auto 12px' }} />
            <h2 className="h4">Visible immediately</h2>
            <p className="tiny muted mt-8">20 residences, 60 gallery images and 8 star-rated references render on the public site and in the Studio without any database changes.</p>
          </div>
          <div className="panel text-center" style={{ padding: 24 }}>
            <Database size={22} className="gold" style={{ margin: '0 auto 12px' }} />
            <h2 className="h4">One SQL paste</h2>
            <p className="tiny muted mt-8">The connected project has an older schema. One script aligns it, installs security policies and seeds the same content as real rows.</p>
          </div>
          <div className="panel text-center" style={{ padding: 24 }}>
            <ShieldCheck size={22} className="gold" style={{ margin: '0 auto 12px' }} />
            <h2 className="h4">Owner stays private</h2>
            <p className="tiny muted mt-8">No password, secret key or service-role credential is stored in this repository. Run the SQL yourself in your Supabase dashboard.</p>
          </div>
        </div>

        <LiveSchemaCheck />

        <div className="notice notice-warning mb-24" style={{ marginTop: 24 }}>
          <div>
            <strong className="notice-title">Run exactly one file — supabase/showcase-setup.sql</strong>
            <p className="tiny" style={{ lineHeight: 1.8 }}>
              Use the <em>Copy setup SQL</em> button below, or download the same file from
              <code> /sql/showcase-setup.sql</code>. Do not paste SQL from another project, tutorial
              or chat into this Supabase instance: a different seed creates tables with different
              column names (for example <code>status = 'Available'</code> and a key/value
              <code> site_settings</code>), and this website then cannot read them. The live check
              above turns red when that has happened. Your existing rows are backed up to
              <code> imperial_legacy_*</code> tables before the rebuild.
            </p>
          </div>
        </div>

        <ShowcaseSetupPanel />

        <div className="flex between center gap-16 wrap mt-32">
          <Link href="/" className="link-gold"><ArrowLeft size={14} /> Return to the collection</Link>
          <Link href="/admin/login" className="btn btn-outline btn-sm">Owner sign in <ArrowRight size={14} /></Link>
        </div>

        <p className="tiny muted text-center mt-32" style={{ opacity: 0.7 }}>
          Demonstration project only. All residences, imagery and references are fictional and clearly labelled as sample content.
        </p>
      </div>
    </main>
  );
}
