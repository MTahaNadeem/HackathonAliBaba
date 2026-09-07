'use client';

import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ArrowRight, LoaderCircle, Mail} from 'lucide-react';
import {authRedirectTo, friendlyAuthError} from '@/lib/auth';

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'update';

const copy: Record<AuthMode, {title: string; description: string; action: string}> = {
  signin: {title: 'Your next chapter, saved.', description: 'Sign in to keep your profile and learning plan across devices.', action: 'Sign in'},
  signup: {title: 'Make room for your future.', description: 'Create an account to save your path, then confirm your email.', action: 'Create my account'},
  forgot: {title: 'Forgot your password?', description: 'Enter the email on your account. We’ll send a reset link if it exists.', action: 'Send reset link'},
  update: {title: 'Choose a new password.', description: 'Use at least 8 characters. You’ll stay signed in after this change.', action: 'Save new password'},
};

export default function AuthPanel({
  client,
  mode,
  onModeChange,
  onComplete,
  emailLocked = false,
  defaultEmail = '',
}: {
  client: SupabaseClient | null;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onComplete?: () => void;
  emailLocked?: boolean;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const text = copy[mode];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'forgot') {
        const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo: authRedirectTo()});
        if (error) throw error;
        setMessage('If that email is registered, a reset link is on its way. Check your inbox and spam folder.');
        return;
      }
      if (mode === 'update') {
        if (password !== confirm) throw new Error('The two passwords do not match.');
        const {error} = await client.auth.updateUser({password});
        if (error) throw error;
        setPassword('');
        setConfirm('');
        setMessage('Password updated. You can continue in your workspace.');
        onComplete?.();
        return;
      }
      if (mode === 'signup') {
        if (password !== confirm) throw new Error('The two passwords do not match.');
        const {data, error} = await client.auth.signUp({
          email,
          password,
          options: {emailRedirectTo: authRedirectTo('/')},
        });
        if (error) throw error;
        if (data.session) {
          setPassword('');
          setConfirm('');
          onComplete?.();
        } else {
          setPassword('');
          setConfirm('');
          setMessage('Check your email to confirm your account, then sign in.');
        }
        return;
      }
      const {error} = await client.auth.signInWithPassword({email, password});
      if (error) throw error;
      setPassword('');
      onComplete?.();
    } catch (err) {
      setMessage(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!client || !email) return;
    setBusy(true);
    setMessage('');
    try {
      const {error} = await client.auth.resend({type: 'signup', email});
      if (error) throw error;
      setMessage('Confirmation email sent. Check your inbox and spam folder.');
    } catch (err) {
      setMessage(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!client) {
    return (
      <div className="inline-note">
        Account sync is being connected. Add your Supabase URL and anon key to `.env.local`, then restart. You can still explore as a guest; guest changes are not saved across visits.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="auth-form">
      {mode !== 'update' && (
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={e => setEmail(e.target.value)}
            readOnly={emailLocked}
          />
        </label>
      )}
      {mode !== 'forgot' && (
        <label className="field">
          <span>{mode === 'update' ? 'New password' : 'Password'}</span>
          <input
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
      )}
      {(mode === 'signup' || mode === 'update') && (
        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
        </label>
      )}
      {message && <p role="status" className="inline-note">{message}</p>}
      <button className="button blue full" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={18} /> : <>{text.action}<ArrowRight size={17} /></>}
      </button>
      {mode === 'signin' && (
        <>
          <button type="button" className="text-button" onClick={() => {onModeChange('forgot'); setMessage('');}}>
            Forgot password?
          </button>
          <button type="button" className="text-button" onClick={() => {onModeChange('signup'); setMessage('');}}>
            New here? Create an account
          </button>
        </>
      )}
      {mode === 'signup' && (
        <>
          <button type="button" className="text-button" onClick={resend} disabled={busy || !email}>
            Resend confirmation email
          </button>
          <button type="button" className="text-button" onClick={() => {onModeChange('signin'); setMessage('');}}>
            Already have an account? Sign in
          </button>
        </>
      )}
      {mode === 'forgot' && (
        <button type="button" className="text-button" onClick={() => {onModeChange('signin'); setMessage('');}}>
          Back to sign in
        </button>
      )}
    </form>
  );
}

export {copy as authCopy};
export function AuthSymbol() {
  return <span className="action-symbol blue"><Mail size={24} /></span>;
}
