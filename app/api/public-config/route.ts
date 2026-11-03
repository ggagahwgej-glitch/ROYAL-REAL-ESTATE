/* ==================================================================
   PUBLIC BOOTSTRAP CONFIGURATION ENDPOINT
   ------------------------------------------------------------------
   GET    → anyone may read the SHARED public config (URL + anon key).
   POST   → owner may publish it. Authorization is verified SERVER-SIDE:
            the Supabase access token is validated with Supabase Auth,
            then `profiles.is_owner` is checked through RLS. Merely
            hiding a button provides no protection.
   DELETE → owner may clear it.

   Writes land in data/public-config.json (a persistent runtime file on
   a Node/VPS deployment). On read-only serverless filesystems the
   endpoint returns mode:"download" with the exact artifact to place at
   public/public-config.json — it never falsely claims global saving.

   Only publishable/anon keys are accepted. No service-role key exists
   anywhere in this application.
================================================================== */
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getServerSupabaseClient } from '@/lib/supabase/factory';
import { getServerConfig } from '@/lib/config/server';
import { serializeConfig, validateConfig } from '@/lib/config/validation';
import type { SupabaseConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', 'Pragma': 'no-cache' };
const RUNTIME_FILE = path.join(process.cwd(), 'data', 'public-config.json');

function publicPayload(config: SupabaseConfig | null, storage: string, publishedAt: string | null, persistent: boolean, note?: string) {
  return NextResponse.json({
    configured: Boolean(config),
    url: config?.url ?? '',
    anonKey: config?.anonKey ?? '',
    publishedAt,
    storage,
    persistent,
    note: note ?? (config
      ? 'Shared public bootstrap configuration. Contains a publishable/anon key only. RLS protects all data.'
      : 'No shared configuration published yet.'),
  }, { headers: NO_STORE });
}

export async function GET() {
  const info = await getServerConfig();
  return publicPayload(info.config, info.storage, info.publishedAt, info.storage === 'static-file');
}

/**
 * Independently verify the caller is the owner of THIS Supabase project.
 * 1) Validate the submitted configuration (rejects secret keys).
 * 2) Validate the bearer JWT against the project's Auth server.
 * 3) Read is_owner through a request scoped to that JWT (RLS applies).
 */
async function authorizeOwner(config: SupabaseConfig, accessToken: string): Promise<{ ok: boolean; error?: string; userId?: string }> {
  if (!accessToken || accessToken.split('.').length !== 3) {
    return { ok: false, error: 'A valid Supabase Auth access token is required.' };
  }
  const verifier = getServerSupabaseClient(config);
  const { data, error } = await verifier.auth.getUser(accessToken);
  if (error || !data?.user) return { ok: false, error: `Session verification failed: ${error?.message ?? 'invalid or expired token'}` };

  const scoped = getServerSupabaseClient(config, accessToken);
  const { data: profile, error: profileError } = await scoped
    .from('profiles').select('is_owner').eq('id', data.user.id).maybeSingle();
  if (profileError) return { ok: false, error: `Owner verification failed: ${profileError.message}. Install supabase/schema.sql and provision the owner account.` };
  if (!profile?.is_owner) return { ok: false, error: 'Authenticated, but this account does not have owner privileges.' };
  return { ok: true, userId: data.user.id };
}

function readBodyConfig(body: unknown): { config?: SupabaseConfig; accessToken?: string; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid request body.' };
  const obj = body as Record<string, unknown>;
  const raw = (obj.config ?? {}) as Record<string, unknown>;
  const validation = validateConfig({ url: String(raw.url ?? ''), anonKey: String(raw.anonKey ?? '') });
  if (!validation.ok) return { error: validation.error };
  return { config: validation.value, accessToken: typeof obj.accessToken === 'string' ? obj.accessToken : '' };
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: NO_STORE }); }
  const parsed = readBodyConfig(body);
  if (!parsed.config) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const config = parsed.config;
  const artifact = serializeConfig(config);

  // Once a shared project has been published, its URL is immutable from a
  // browser session. Otherwise anyone with their own (owner-verified) project
  // could repoint this website to a database they control. Key rotation on the
  // SAME project is allowed; clearing first requires owner auth against the
  // currently configured project.
  const current = await getServerConfig();
  if (current.config && current.config.url !== config.url) {
    return NextResponse.json({
      error: `This website is already bound to ${current.config.url}. The shared project URL cannot be repointed from a browser session. Clear the runtime configuration with the existing owner account, or update public/public-config.json in the deployment, before connecting a different project.`,
    }, { status: 403, headers: NO_STORE });
  }

  const auth = await authorizeOwner(config, parsed.accessToken ?? '');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403, headers: NO_STORE });

  try {
    await fs.mkdir(path.dirname(RUNTIME_FILE), { recursive: true });
    const temp = `${RUNTIME_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temp, artifact, 'utf8');
    await fs.rename(temp, RUNTIME_FILE);
    return NextResponse.json({
      ok: true,
      mode: 'persisted',
      message: 'Shared public configuration published. Every visitor now connects to this Supabase project.',
      storage: 'server',
      publishedAt: JSON.parse(artifact).publishedAt,
    }, { headers: NO_STORE });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    const reason = code === 'EROFS' || code === 'EACCES'
      ? 'This deployment has a read-only filesystem (typical of serverless hosting).'
      : `The runtime file could not be written (${code ?? 'unknown error'}).`;
    return NextResponse.json({
      ok: false,
      mode: 'download',
      message: `${reason} Nothing was saved globally. Download the configuration artifact below and place it at public/public-config.json in the repository (or commit it to your host), then redeploy. This makes the configuration available to all visitors without any service-role key.`,
      artifact,
    }, { status: 501, headers: NO_STORE });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: NO_STORE }); }
  const obj = body as Record<string, unknown>;
  const current = await getServerConfig();
  if (!current.config) return NextResponse.json({ ok: true, message: 'There is no runtime shared configuration to clear.' }, { headers: NO_STORE });
  const auth = await authorizeOwner(current.config, typeof obj.accessToken === 'string' ? obj.accessToken : '');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403, headers: NO_STORE });
  try {
    await fs.unlink(RUNTIME_FILE);
    return NextResponse.json({ ok: true, message: 'Runtime shared configuration cleared. A committed static /public-config.json file, if present, must be removed from the repository and the site redeployed.' }, { headers: NO_STORE });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // The active config came from the committed static file or env — there is
      // no runtime file to remove. Do not report a false 500.
      return NextResponse.json({ ok: true, message: 'No runtime shared configuration was stored. A committed static /public-config.json file (or build-time fallback), if present, must be removed from the repository and the site redeployed.' }, { headers: NO_STORE });
    }
    return NextResponse.json({ error: `Could not remove the runtime file: ${(e as Error).message}` }, { status: 500, headers: NO_STORE });
  }
}
