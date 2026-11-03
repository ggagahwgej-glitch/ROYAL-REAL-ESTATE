/* Server-only reader for the SHARED public bootstrap configuration.
   Used by generateMetadata(), sitemap.ts and Server Components.
   It never sees, uses or stores a service-role key. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SupabaseConfig } from '../types';
import { validateConfig } from './validation';

export interface ServerConfigInfo {
  config: SupabaseConfig | null;
  storage: 'server' | 'static-file' | 'env' | 'none';
  publishedAt: string | null;
}

function fromPayload(payload: unknown): SupabaseConfig | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const result = validateConfig({
    url: String(obj.url ?? ''),
    anonKey: String(obj.anonKey ?? obj.publishableKey ?? obj.anon_key ?? ''),
  });
  return result.ok ? result.value! : null;
}

async function readJson(file: string): Promise<unknown | null> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as unknown; } catch { return null; }
}

export async function getServerConfig(): Promise<ServerConfigInfo> {
  const root = process.cwd();
  const runtime = await readJson(path.join(root, 'data', 'public-config.json'));
  const runtimeConfig = fromPayload(runtime);
  if (runtimeConfig) {
    return { config: runtimeConfig, storage: 'server',
      publishedAt: (runtime as { publishedAt?: string })?.publishedAt ?? null };
  }
  const staticFile = await readJson(path.join(root, 'public', 'public-config.json'));
  const staticConfig = fromPayload(staticFile);
  if (staticConfig) {
    return { config: staticConfig, storage: 'static-file',
      publishedAt: (staticFile as { publishedAt?: string })?.publishedAt ?? null };
  }
  const envConfig = fromPayload({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  });
  if (envConfig) return { config: envConfig, storage: 'env', publishedAt: null };
  return { config: null, storage: 'none', publishedAt: null };
}
