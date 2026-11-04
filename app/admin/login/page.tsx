import type { Metadata } from 'next';
import { LoginForm } from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Owner Sign In',
  description: 'Secure Supabase Auth sign in for the Imperial Royal Owner Studio.',
  robots: { index: false, follow: false, nocache: true },
};
export default function LoginPage() {
  return <LoginForm />;
}
