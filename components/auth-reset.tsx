'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {type SupabaseClient} from '@supabase/supabase-js';
import {getSupabaseBrowserClient} from '@/lib/supabase/client';
import {Route} from 'lucide-react';
import AuthPanel, {AuthSymbol, authCopy} from './auth-panel';
import {friendlyAuthError} from '@/lib/auth';

export default function AuthReset() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    let subscription: {unsubscribe: () => void} | undefined;

    const searchParams = new URLSearchParams(window.location.search);
    const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);

    const errorDesc =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');

    if (errorDesc) {
      queueMicrotask(() => {
        if (!alive) return;
        setError(friendlyAuthError(new Error(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))));
        setReady(true);
      });
      return;
    }

    fetch('/api/config')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load configuration');
        return r.json() as Promise<{authConfigured: boolean; supabaseUrl: string; supabaseKey: string}>;
      })
      .then(async c => {
        if (!alive) return;
        if (!c.authConfigured) {
          setError('Account sync is not configured yet. Add your Supabase keys, then request a new reset link.');
          setReady(true);
          return;
        }
        const sb = getSupabaseBrowserClient(c.supabaseUrl, c.supabaseKey);
        if (!sb) {
          setError('Could not initialize account service.');
          setReady(true);
          return;
        }
        setClient(sb);

        const {data: authListener} = sb.auth.onAuthStateChange((_event, session) => {
          if (!alive) return;
          if (session) {
            setError('');
            setReady(true);
          }
        });
        subscription = authListener.subscription;

        const code = searchParams.get('code');
        if (code) {
          const {data: existing} = await sb.auth.getSession();
          if (existing?.session) {
            if (alive) {
              setError('');
              setReady(true);
            }
            return;
          }

          const {error: exchangeError} = await sb.auth.exchangeCodeForSession(code);
          if (!alive) return;
          if (exchangeError) {
            const {data: retrySession} = await sb.auth.getSession();
            if (!retrySession?.session) {
              setError(friendlyAuthError(exchangeError));
            } else {
              setError('');
            }
          } else {
            setError('');
          }
        } else {
          const {data} = await sb.auth.getSession();
          if (!alive) return;
          if (!data?.session) {
            setError('This reset link is missing or has expired. Request a new one from Sign in.');
          } else {
            setError('');
          }
        }
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) {
          setError('Configuration could not be loaded. Refresh to retry.');
          setReady(true);
        }
      });

    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, []);

  const text = authCopy.update;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark"><Route size={24} /></span>
          CourseCompass<span className="brand-dot">.</span>
        </Link>
        <AuthSymbol />
        <h1 className="dialog-title">{done ? 'Password saved.' : text.title}</h1>
        <p className="muted">{done ? 'You can return to your workspace and continue your path.' : text.description}</p>
        {!ready && <p className="inline-note">Checking your reset link…</p>}
        {error && <p role="alert" className="error-message">{error}</p>}
        {ready && !error && !done && (
          <AuthPanel
            client={client}
            mode="update"
            onModeChange={() => undefined}
            onComplete={() => setDone(true)}
          />
        )}
        <Link href="/" className="text-button">{done ? 'Open my workspace' : 'Back to CourseCompass AI'}</Link>
      </div>
    </div>
  );
}
