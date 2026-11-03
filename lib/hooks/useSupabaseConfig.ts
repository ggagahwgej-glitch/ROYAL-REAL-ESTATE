'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { getServerSnapshot, getSnapshot, initialize, subscribe, type ConfigState } from '../config/manager';

/** The single configuration hook used by public pages AND the Owner Studio. */
export function useSupabaseConfig(): ConfigState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { void initialize(); }, []);
  return state;
}
