'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Mail, ArrowRight, ShieldCheck, KeyRound, ArrowLeft, Database, AlertCircle } from 'lucide-react';
import { Brand } from '@/components/brand/Brand';
import { Notice } from '@/components/ui/UI';
import { SetupState } from '@/components/site/SetupState';
import { useSupabaseConfig } from '@/lib/hooks/useSupabaseConfig';
import { getSupabaseClient } from '@/lib/supabase/factory';
import { clearLoginFailures, friendlyAuthError, getLoginThrottle, recordLoginFailure, requestPasswordReset, signInOwner, updatePassword, validateEmail, validatePassword, verifyOwner } from '@/lib/auth/owner';

type Mode = 'signin' | 'forgot' | 'recovery';

export function LoginForm() {
  const router = useRouter();
  const config = useSupabaseConfig();
  const [query, setQuery] = useState({ next: '/admin/dashboard', reason: null as string | null, reset: false });
  const next = query.next;
  const reason = query.reason;
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [throttle, setThrottle] = useState(getLoginThrottle());
  const client = config.config ? getSupabaseClient(config.config) : null;

  // Read URL state after hydration so the sign-in form is server-rendered
  // (useSearchParams would force a client-side-only bailout).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuery({ next: p.get('next') || '/admin/dashboard', reason: p.get('reason'), reset: p.get('reset') === '1' });
    if (p.get('reset') === '1') setMode('recovery');
  }, []);

  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { setMode('recovery'); setSuccess('Your reset link is verified. Choose a new password.'); }
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!client || config.loading) return;
    // Session persistence: an already-verified owner skips the login form.
    void verifyOwner(client).then(res => { if (res.data && !res.error && mode === 'signin') router.replace(next); });
  }, [client, config.loading, next, router, mode]);

  useEffect(() => {
    const t = window.setInterval(() => setThrottle(getLoginThrottle()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const submitSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    const emailError = validateEmail(email);
    if (emailError || !password) { setError(emailError ?? 'Enter your password.'); return; }
    const gate = getLoginThrottle();
    if (gate.blocked) { setError(`Too many attempts. Please wait ${gate.secondsRemaining} seconds before trying again.`); return; }
    if (!client) { setError('No Supabase connection is configured. Open Backend Configuration first.'); return; }
    setBusy(true);
    const result = await signInOwner(client, email, password);
    setBusy(false);
    if (result.error || !result.data) {
      recordLoginFailure();
      setThrottle(getLoginThrottle());
      setError(friendlyAuthError(result.error ?? 'Sign-in failed.'));
      return;
    }
    clearLoginFailures();
    setSuccess('Session established and owner privileges verified. Opening the Owner Studio…');
    router.replace(next);
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null);
    const emailError = validateEmail(email);
    if (emailError) { setError(emailError); return; }
    if (!client) { setError('A Supabase connection is required to send a reset email.'); return; }
    setBusy(true);
    const result = await requestPasswordReset(client, email);
    setBusy(false);
    if (result.error) setError(result.error);
    else setSuccess(`If an account exists for ${email.trim()}, a password reset link has been sent. Check your inbox and spam folder.`);
  };

  const submitRecovery = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(null);
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    if (!client) { setError('A Supabase connection is required.'); return; }
    setBusy(true);
    const result = await updatePassword(client, password);
    setBusy(false);
    if (result.error) setError(result.error);
    else { setSuccess('Your password has been updated. You can now sign in.'); setPassword(''); setConfirm(''); setMode('signin'); }
  };

  return (
    <div className="setup-shell">
      <div style={{ width: 'min(100%, 460px)' }}>
        <div className="login-brand"><Brand variant="horizontal" href="/" /></div>
        <div className="login-card">
          {config.initialized && !config.config && <div className="mb-24"><SetupState config={config} compact context="admin" /></div>}
          {!config.initialized && <Notice tone="info" className="mb-16"><span className="spinner" /> Checking the secure connection…</Notice>}
          <>

              <div className="text-center mb-24">
                <div style={{ width: 56, height: 56, margin: '0 auto 18px', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                  {mode === 'signin' ? <LockKeyhole size={24} className="gold" /> : <KeyRound size={24} className="gold" />}
                </div>
                <p className="eyebrow no-line">Private Owner Studio</p>
                <h1 className="h3 mt-8">{mode === 'signin' ? 'Sign in to your studio' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}</h1>
                <p className="tiny muted mt-8">
                  {mode === 'signin' ? 'Authorised owners only · Supabase Auth' : mode === 'forgot' ? 'We will send a secure reset link to your registered email.' : 'Your recovery link has been verified by Supabase Auth.'}
                </p>
              </div>

              {reason === 'expired' && <Notice tone="warning" className="mb-16"><AlertCircle size={14} /> Your session expired. Please sign in again.</Notice>}
              {reason === 'signin' && <Notice tone="info" className="mb-16">Sign in to continue to the Owner Studio.</Notice>}
              {error && <Notice tone="error" title="Unable to continue" className="mb-16">{error}</Notice>}
              {success && <Notice tone="success" className="mb-16">{success}</Notice>}
              {throttle.blocked && mode === 'signin' && <Notice tone="warning" className="mb-16">Sign in is temporarily paused after repeated failures. Try again in {throttle.secondsRemaining}s. Supabase Auth also enforces server-side rate limits.</Notice>}

              {mode === 'signin' && (
                <form onSubmit={submitSignIn} className="grid gap-16" noValidate>
                  <div className="field"><label className="label" htmlFor="login-email">Owner email</label>
                    <div className="input-wrap"><Mail size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
                      <input id="login-email" className="input" style={{ paddingLeft: 38 }} type="email" autoComplete="email" placeholder="owner@your-domain.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div></div>
                  <div className="field"><label className="label" htmlFor="login-password">Password</label>
                    <div className="input-wrap">
                      <input id="login-password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: 46 }} />
                      <button type="button" className="input-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    </div></div>
                  <div className="flex between center"><span className="tiny muted">Session persists securely in this browser</span>
                    <button type="button" className="link-gold" onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }} style={{ fontSize: 11 }}>Forgot password?</button></div>
                  <button className="btn btn-gold btn-block btn-lg" disabled={busy || throttle.blocked || !config.initialized} type="submit">
                    {busy ? <><span className="spinner" /> Verifying…</> : <>Sign in securely <ArrowRight size={16} /></>}
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <form onSubmit={submitForgot} className="grid gap-16" noValidate>
                  <div className="field"><label className="label" htmlFor="reset-email">Registered owner email</label>
                    <div className="input-wrap"><Mail size={15} style={{ position: 'absolute', left: 14, color: 'var(--gold)' }} />
                      <input id="reset-email" className="input" style={{ paddingLeft: 38 }} type="email" autoComplete="email" placeholder="owner@your-domain.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div></div>
                  <button className="btn btn-gold btn-block" disabled={busy} type="submit">{busy ? <><span className="spinner" /> Sending…</> : <>Send reset link <ArrowRight size={16} /></>}</button>
                  <button type="button" className="link-gold" style={{ justifyContent: 'center' }} onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}><ArrowLeft size={14} /> Back to sign in</button>
                </form>
              )}

              {mode === 'recovery' && (
                <form onSubmit={submitRecovery} className="grid gap-16" noValidate>
                  <div className="field"><label className="label" htmlFor="new-password">New password</label>
                    <div className="input-wrap"><input id="new-password" className="input" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={{ paddingRight: 46 }} />
                      <button type="button" className="input-toggle" onClick={() => setShow(s => !s)} aria-label="Toggle password visibility">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
                  <div className="field"><label className="label" htmlFor="confirm-password">Confirm new password</label>
                    <input id="confirm-password" className="input" type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your new password" /></div>
                  <button className="btn btn-gold btn-block" disabled={busy} type="submit">{busy ? <><span className="spinner" /> Updating…</> : <>Update password <ArrowRight size={16} /></>}</button>
                  <button type="button" className="link-gold" style={{ justifyContent: 'center' }} onClick={() => setMode('signin')}><ArrowLeft size={14} /> Back to sign in</button>
                </form>
              )}

              <div className="divider mt-24 mb-16" />
            <p className="tiny muted flex center gap-8" style={{ justifyContent: 'center' }}><ShieldCheck size={13} className="gold" /> Owner privileges are verified against <code>profiles.is_owner</code> and enforced by RLS.</p>
          </>
        </div>
        <div className="flex between center gap-12 mt-24 wrap tiny muted">
          <Link href="/" className="link-gold" style={{ fontSize: 10 }}><ArrowLeft size={13} /> Back to website</Link>
          <Link href="/admin/configuration" className="link-gold" style={{ fontSize: 10 }}><Database size={13} /> Backend Configuration</Link>
        </div>
      </div>
    </div>
  );
}
