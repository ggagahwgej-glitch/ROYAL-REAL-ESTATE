import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Display Preferences & Connection Status',
  description: 'Personalise the Imperial Royal browsing experience in this browser and review the public connection status.',
  alternates: { canonical: '/settings' },
};
export default function SettingsLayout({ children }: { children: React.ReactNode }) { return children; }
