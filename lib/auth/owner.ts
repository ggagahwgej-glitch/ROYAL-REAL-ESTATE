/* ==================================================================
   Supabase Auth + owner authorization.
   Legacy PIN/code authentication is entirely removed. No second
   password and no hardcoded credentials exist.
   Owner privilege is enforced by the `profiles.is_owner` column and
   by Row Level Security policies in supabase/schema.sql.
================================================================== */
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { Profile, QueryResult } from '../types';
import { errorMessage } from '../utils';

export interface OwnerIdentity { user: User; profile: Profile; session: Session }

const FAIL_KEY = 'imperial-royal.auth.failures.v2';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000;

interface ThrottleState { count: number; until: number }

function readThrottle(): ThrottleState {
  if (typeof window === 'undefined') return { count: 0, until: 0 };
  try {
    const raw = window.localStorage.getItem(FAIL_KEY);
    if (!raw) return { count: 0, until: 0 };
    const parsed = JSON.parse(raw) as ThrottleState;
    return { count: Number(parsed.count) || 0, until: Number(parsed.until) || 0 };
  } catch { return { count: 0, until: 0 }; }
}
function writeThrottle(value: ThrottleState) {
  try { window.localStorage.setItem(FAIL_KEY, JSON.stringify(value)); } catch { /* ignore */ }
}

/** Client-side throttle complementing Supabase Auth's built-in server rate limits. */
export function getLoginThrottle(): { blocked: boolean; secondsRemaining: number; attempts: number } {
  const state = readThrottle();
  const remaining = Math.max(0, state.until - Date.now());
  if (remaining <= 0 && state.count > 0) writeThrottle({ count: 0, until: 0 });
  return { blocked: remaining > 0, secondsRemaining: Math.ceil(remaining / 1000), attempts: state.count };
}
export function recordLoginFailure(): void {
  const state = readThrottle();
  const count = state.count >= MAX_ATTEMPTS - 1 ? MAX_ATTEMPTS : state.count + 1;
  writeThrottle({ count, until: count >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : 0 });
}
export function clearLoginFailures(): void { writeThrottle({ count: 0, until: 0 }); }

/**
 * Verify a *validated* session AND owner privilege.
 * `auth.getUser()` revalidates the token with the Supabase Auth server,
 * so an expired / revoked session is detected rather than trusted blindly.
 */
export async function verifyOwner(client: SupabaseClient): Promise<QueryResult<OwnerIdentity | null>> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      return { data: null, error: userError?.message ?? 'No authenticated session. Please sign in.' };
    }
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) return { data: null, error: 'Your session has expired. Please sign in again.' };

    const { data: profile, error: profileError } = await client.from('profiles')
      .select('*').eq('id', userData.user.id).maybeSingle();
    if (profileError) return { data: null, error: `Could not verify owner privileges: ${profileError.message}` };
    if (!profile || !(profile as Profile).is_owner) {
      return { data: null, error: 'This account is authenticated but is not authorised for the Owner Studio.' };
    }
    return { data: { user: userData.user, profile: profile as Profile, session: sessionData.session }, error: null };
  } catch (e) { return { data: null, error: errorMessage(e) }; }
}

export async function signInOwner(client: SupabaseClient, email: string, password: string): Promise<QueryResult<OwnerIdentity>> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session || !data.user) {
      return { data: null, error: friendlyAuthError(error?.message ?? 'Sign-in failed.') };
    }
    const verified = await verifyOwner(client);
    if (verified.error || !verified.data) {
      // A valid Supabase account without owner privileges must not keep a session.
      await client.auth.signOut();
      return { data: null, error: verified.error ?? 'Owner verification failed.' };
    }
    clearLoginFailures();
    return { data: verified.data, error: null };
  } catch (e) { return { data: null, error: errorMessage(e) }; }
}

export async function signOutOwner(client: SupabaseClient): Promise<QueryResult<null>> {
  try {
    const { error } = await client.auth.signOut();
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (e) { return { data: null, error: errorMessage(e) }; }
}

export async function requestPasswordReset(client: SupabaseClient, email: string): Promise<QueryResult<null>> {
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/admin/login?reset=1` : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { data: null, error: friendlyAuthError(error.message) };
    return { data: null, error: null };
  } catch (e) { return { data: null, error: errorMessage(e) }; }
}

export async function updatePassword(client: SupabaseClient, password: string): Promise<QueryResult<null>> {
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) return { data: null, error: friendlyAuthError(error.message) };
    return { data: null, error: null };
  } catch (e) { return { data: null, error: errorMessage(e) }; }
}

/**
 * Only allow a same-site /admin URL as a post-login destination. Without this,
 * `?next=https://evil.example` would turn the login page into an open redirect.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/admin/dashboard'): string {
  const raw = (value ?? '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.length > 300) return fallback;
  try {
    const u = new URL(raw, 'https://internal.invalid');
    if (u.origin !== 'https://internal.invalid') return fallback;
    if (!/^\/admin(?:\/|$)/.test(u.pathname)) return fallback;
    if (u.pathname === '/admin' || u.pathname === '/admin/login') return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch { return fallback; }
}

/** Always obtain a CURRENT, server-validated access token for privileged writes. */
export async function getOwnerAccessToken(client: SupabaseClient | null): Promise<string | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.access_token) return null;
    const { error: userError } = await client.auth.getUser(data.session.access_token);
    if (userError) return null;
    return data.session.access_token;
  } catch { return null; }
}

export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email address before signing in.';
  if (lower.includes('too many requests') || lower.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (lower.includes('user not found')) return 'No account was found for that email address.';
  if (lower.includes('weak password') || lower.includes('should be at least')) return 'Choose a stronger password (at least 8 characters).';
  return message;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least one letter and one number.';
  return null;
}

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? null : 'Enter a valid email address.';
}
