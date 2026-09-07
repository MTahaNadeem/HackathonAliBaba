'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {Route} from 'lucide-react';
import AuthPanel, {AuthSymbol, authCopy} from './auth-panel';

export default function AuthReset() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/config')
      .then(r => r.json() as Promise<{authConfigured: boolean; supabaseUrl: string; supabaseKey: string}>)
      .then(async c => {
        if (!alive) return;
        if (!c.authConfigured) {
          setError('Account sync is not configured yet. Add your Supabase keys, then request a new reset link.');
          setReady(true);
          return;
        }
        const sb = createClient(c.supabaseUrl, c.supabaseKey, {auth: {flowType: 'pkce', detectSessionInUrl: true}});
        setClient(sb);
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const {error: exchangeError} = await sb.auth.exchangeCodeForSession(code);
          if (exchangeError) setError(exchangeError.message);
        } else {
          const {data} = await sb.auth.getSession();
          if (!data.session) setError('This reset link is missing or has expired. Request a new one from Sign in.');
        }
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setError('Configuration could not be loaded. Refresh to retry.');
          setReady(true);
        }
      });
    return () => {
      alive = false;
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
