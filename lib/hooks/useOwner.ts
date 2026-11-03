'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSupabaseConfig } from './useSupabaseConfig';
import { getSupabaseClient } from '../supabase/factory';
import { signOutOwner, verifyOwner, type OwnerIdentity } from '../auth/owner';

export type OwnerStatus =
  | 'loading' | 'no-config' | 'unauthenticated' | 'unauthorized'
  | 'authenticated' | 'expired' | 'error';

export interface OwnerState {
  status: OwnerStatus;
  identity: OwnerIdentity | null;
  client: SupabaseClient | null;
  message: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useOwner(): OwnerState {
  const config = useSupabaseConfig();
  const [status, setStatus] = useState<OwnerStatus>('loading');
  const [identity, setIdentity] = useState<OwnerIdentity | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const client = config.config ? getSupabaseClient(config.config) : null;
  // A generation token prevents an old (slow) verification from overwriting a
  // newer one when the configuration or auth state changes quickly. Unlike a
  // boolean "busy" guard, no needed re-check is ever silently dropped.
  const generation = useRef(0);

  const check = useCallback(async () => {
    const gen = ++generation.current;
    const apply = (next: OwnerStatus, id: OwnerIdentity | null, msg: string | null) => {
      if (gen !== generation.current) return;
      setStatus(next); setIdentity(id); setMessage(msg);
    };
    if (!config.initialized) { setStatus('loading'); return; }
    if (!client) {
      apply('no-config', null, 'The website is not connected to a Supabase project yet. Configure it in the Owner Studio.');
      return;
    }
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (gen !== generation.current) return;
      if (!sessionData.session) { apply('unauthenticated', null, null); return; }
      const result = await verifyOwner(client);
      if (gen !== generation.current) return;
      if (result.error) {
        const expired = /expired|invalid jwt|jwt|refresh token/i.test(result.error);
        apply(expired ? 'expired' : result.error.includes('not authorised') ? 'unauthorized' : 'error', null, result.error);
        return;
      }
      apply('authenticated', result.data, null);
    } catch (e) {
      if (gen !== generation.current) return;
      apply('error', null, e instanceof Error ? e.message : 'Session verification failed.');
    }
  }, [client, config.initialized]);

  useEffect(() => { void check(); }, [check]);

  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        generation.current++;
        setIdentity(null); setStatus('unauthenticated'); setMessage(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') void check();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => { void check(); }, 5 * 60 * 1000);
    return () => { data.subscription.unsubscribe(); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(interval); };
  }, [client, check]);

  const signOut = useCallback(async () => {
    if (client) await signOutOwner(client);
    generation.current++;
    setIdentity(null); setStatus('unauthenticated'); setMessage(null);
  }, [client]);

  // If the connection disappears after a successful verification, do not leave
  // the UI in a stale "authenticated" state (which would show endless skeletons).
  const effectiveStatus: OwnerStatus = !client && config.initialized ? 'no-config' : status;
  return { status: effectiveStatus, identity, client, message, refresh: check, signOut };
}
