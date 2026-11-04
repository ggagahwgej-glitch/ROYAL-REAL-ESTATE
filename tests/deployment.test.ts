import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Deployment contract tests.
 *
 * These do not exercise the network — they lock the repository into the shape
 * a zero-warning Vercel import needs, so a future edit cannot silently
 * reintroduce the classic failures: an unpinned framework, a runtime-only
 * dependency inflating the serverless bundle, a deprecated image config key,
 * or a canonical URL baked to localhost.
 */

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
/** Comments discuss the rules these tests enforce — scan emitted code only. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const pkg = JSON.parse(read('package.json')) as {
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe('deployment · package manifest', () => {
  it('pins the framework version so Vercel never resolves a different Next', () => {
    expect(pkg.dependencies?.next).toBe('15.5.28');
    expect(pkg.dependencies?.next).not.toContain('^');
  });

  it('declares a Node engine and a matching .nvmrc', () => {
    expect(pkg.engines?.node).toBeTruthy();
    expect(existsSync(path.join(root, '.nvmrc'))).toBe(true);
    const nvmrc = read('.nvmrc').trim();
    expect(nvmrc).toMatch(/^\d+(\.\d+)?(\.\d+)?$/);
    expect(pkg.engines?.node).toContain(nvmrc.split('.')[0]);
  });

  it('keeps build scripts free of network calls and generated prerequisites', () => {
    const build = pkg.scripts?.build ?? '';
    expect(build).toBe('next build');
    expect(pkg.scripts?.dev).toContain('next dev');
    // No postinstall/preinstall step: Vercel runs them before the repo is ready.
    expect(pkg.scripts?.postinstall).toBeUndefined();
    expect(pkg.scripts?.preinstall).toBeUndefined();
    // prebuild is allowed only because it is the local, read-only preflight.
    expect(pkg.scripts?.prebuild).toBe('node scripts/vercel-preflight.mjs');
  });

  it('runs the preflight through the Vercel build command', () => {
    const vercel = JSON.parse(read('vercel.json')) as {
      framework?: string;
      buildCommand?: string;
      outputDirectory?: string;
    };
    // `npm run build` is what triggers the prebuild hook; Vercel's Next preset
    // would otherwise call `next build` directly and skip it.
    expect(vercel.buildCommand).toBe('npm run build');
    // Setting an output directory for a Next.js project makes Vercel serve the
    // build folder as static output — every route, including "/", then 404s.
    expect(vercel.outputDirectory).toBeUndefined();
  });

  it('ships image tooling as a dev dependency, not in the serverless bundle', () => {
    // `sharp` is only used by scripts/*.mjs and the brand tests; Vercel's own
    // image optimizer provides its own copy at runtime.
    expect(pkg.dependencies?.sharp).toBeUndefined();
    expect(pkg.devDependencies?.sharp).toBeTruthy();
    // Nothing from the test/brand toolchain may leak into runtime dependencies.
    for (const name of ['potrace', 'vitest', 'typescript']) {
      expect(pkg.dependencies?.[name]).toBeUndefined();
    }
  });

  it('keeps the SQL verification harness out of the runtime dependency graph', () => {
    expect(pkg.devDependencies?.['@electric-sql/pglite']).toBeTruthy();
    expect(pkg.dependencies?.['@electric-sql/pglite']).toBeUndefined();
    expect(pkg.scripts?.['schema:check']).toContain('schema-check.mjs');
  });

  it('has a Vercel project descriptor that selects the Next.js preset', () => {
    const vercel = JSON.parse(read('vercel.json')) as { framework?: string };
    expect(vercel.framework).toBe('nextjs');
  });
});

describe('deployment · app router entry points', () => {
  it('ships a root layout and a page that resolves to "/"', () => {
    expect(existsSync(path.join(root, 'app/layout.tsx'))).toBe(true);
    // The homepage lives in a route group; route groups do not affect the URL.
    for (const candidate of ['app/page.tsx', 'app/(site)/page.tsx']) {
      if (existsSync(path.join(root, candidate))) {
        expect(read(candidate)).toMatch(/export\s+default/);
        return;
      }
    }
    throw new Error('No page resolves to "/"');
  });

  it('keeps the homepage out of Suspense-only rendering', () => {
    const page = read('app/(site)/page.tsx');
    // A default export that renders something, not an empty shell.
    expect(page.length).toBeGreaterThan(200);
    expect(page).not.toMatch(/^\s*export\s+default\s+function\s*\w*\s*\([^)]*\)\s*\{\s*return\s+null;?\s*\}/m);
  });

  it('serves the site from "/" — no basePath, no root rewrite', () => {
    const config = stripComments(read('next.config.ts'));
    expect(config).not.toMatch(/basePath\s*:/);
    expect(config).not.toMatch(/rewrites\s*\(/);
  });

  it('fails the build when the deployed folder is not the application', () => {
    // The exact failure that produced "404 NOT_FOUND at /" on a two-second
    // deploy: Vercel built a branch whose root held no package.json and no app/.
    const script = read('scripts/vercel-preflight.mjs');
    expect(script).toContain('package.json is missing from the build root');
    expect(script).toContain('No app/ or pages/ directory at the build root');
    expect(script).toContain('No page resolves to "/"');
  });
});

describe('deployment · next.config', () => {
  const config = stripComments(read('next.config.ts'));

  it('uses the current image allowlist API, not the deprecated `domains` key', () => {
    expect(config).toContain('remotePatterns');
    expect(config).not.toMatch(/images:\s*\{[^}]*domains:/);
  });

  it('never switches to a static export that would break API routes', () => {
    expect(config).not.toContain("output: 'export'");
    expect(config).not.toContain('output: "export"');
  });

  it('keeps framing headers absent so the hosted preview can embed the site', () => {
    expect(config).not.toContain('X-Frame-Options');
    expect(config).not.toContain('frame-ancestors');
  });

  it('leaves the framework preset to Vercel (no custom distDir / output dir)', () => {
    expect(config).not.toContain('distDir');
  });
});

describe('deployment · environment & secrets', () => {
  it('committed bootstrap config carries no service-role or secret key', () => {
    const parsed = JSON.parse(read('public/public-config.json')) as Record<string, unknown>;
    const key = String(parsed.anonKey ?? parsed.publishableKey ?? parsed.anon_key ?? '');

    expect(key.length).toBeGreaterThan(20);
    // A publishable/anon credential is the only thing allowed here.
    expect(key.startsWith('sb_secret')).toBe(false);
    for (const value of Object.values(parsed)) {
      expect(String(value)).not.toMatch(/service_role/i);
    }
    // No field may smuggle a privileged credential alongside the public key.
    for (const field of ['serviceRoleKey', 'service_role_key', 'secret', 'secretKey']) {
      expect(parsed[field]).toBeUndefined();
    }
  });

  it('ignores env files, the runtime config and the Vercel output dir', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^\.env\*/m);
    expect(ignore).toMatch(/^data\/public-config\.json$/m);
    expect(ignore).toMatch(/^\.vercel$/m);
  });
});

describe('deployment · canonical origin', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const key of ['NEXT_PUBLIC_SITE_URL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.resetModules();
  });

  const load = async () => (await import('../lib/config/site-url')).getSiteUrl;

  it('honours an explicit NEXT_PUBLIC_SITE_URL, with or without a scheme', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://imperial.example/';
    expect(await (await load())()).toBe('https://imperial.example');

    vi.resetModules();
    process.env.NEXT_PUBLIC_SITE_URL = 'imperial.example';
    expect(await (await load())()).toBe('https://imperial.example');
  });

  it('falls back to the Vercel production domain when prerendering without a request', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'imperial-royal.vercel.app';
    process.env.VERCEL_URL = 'imperial-royal-abc123.vercel.app';
    expect(await (await load())()).toBe('https://imperial-royal.vercel.app');
  });

  it('uses the per-deployment URL on preview builds, and localhost only locally', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_URL = 'imperial-royal-abc123.vercel.app';
    expect(await (await load())()).toBe('https://imperial-royal-abc123.vercel.app');

    vi.resetModules();
    delete process.env.VERCEL_URL;
    expect(await (await load())()).toBe('http://localhost:3000');
  });

  it('does not bake a canonical URL into the root layout', () => {
    // A root-level canonical applied "/" to every page, including the 404.
    const layout = read('app/layout.tsx');
    expect(layout).not.toMatch(/canonical:\s*['"]\/['"]/);
  });
});
