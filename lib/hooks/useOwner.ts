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
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (!config.initialized) { setStatus('loading'); return; }
      if (!client) {
        setIdentity(null);
        setStatus('no-config');
        setMessage('The website is not connected to a Supabase project yet. Configure it in the Owner Studio.');
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        setIdentity(null); setStatus('unauthenticated'); setMessage(null); return;
      }
      const result = await verifyOwner(client);
      if (result.error) {
        setIdentity(null);
        const expired = /expired|invalid jwt|jwt|refresh token/i.test(result.error);
        setStatus(expired ? 'expired' : result.error.includes('not authorised') ? 'unauthorized' : 'error');
        setMessage(result.error);
        return;
      }
      setIdentity(result.data);
      setStatus('authenticated');
      setMessage(null);
    } finally { busy.current = false; }
  }, [client, config.initialized]);

  useEffect(() => { void check(); }, [check]);

  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setIdentity(null); setStatus('unauthenticated'); setMessage(null); }
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') void check();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => { void check(); }, 5 * 60 * 1000);
    return () => { data.subscription.unsubscribe(); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(interval); };
  }, [client, check]);

  const signOut = useCallback(async () => {
    if (client) await signOutOwner(client);
    setIdentity(null); setStatus('unauthenticated'); setMessage(null);
  }, [client]);

  return { status, identity, client, message, refresh: check, signOut };
}
