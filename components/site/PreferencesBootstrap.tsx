'use client';
import { useEffect } from 'react';
import { PREFERENCES_EVENT, PREFERENCES_KEY, applyPreferences, readPreferences } from '@/lib/preferences';

/**
 * Applies the visitor's saved display preferences on EVERY page, not only on
 * /settings. Preferences live in this browser only and never reach the server.
 */
export function PreferencesBootstrap() {
  useEffect(() => {
    applyPreferences(readPreferences());

    // Another tab (or the preferences page) changed the choice — follow it.
    const sync = () => applyPreferences(readPreferences());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === PREFERENCES_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PREFERENCES_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PREFERENCES_EVENT, sync);
    };
  }, []);
  return null;
}
