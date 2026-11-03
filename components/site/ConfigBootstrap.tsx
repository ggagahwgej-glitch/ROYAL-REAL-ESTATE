'use client';
import { useEffect } from 'react';
import { initialize } from '@/lib/config/manager';

/** Starts the ONE centralized configuration manager before any page reads data. */
export function ConfigBootstrap() {
  useEffect(() => { void initialize(); }, []);
  return null;
}
