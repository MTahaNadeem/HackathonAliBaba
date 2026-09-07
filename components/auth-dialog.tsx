'use client';

import {useEffect, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Dialog, DialogContent, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import AuthPanel, {AuthSymbol, authCopy, type AuthMode} from './auth-panel';

export default function AuthDialog({
  open,
  onOpenChange,
  client,
  recovery = false,
  onRecovered,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: SupabaseClient | null;
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(recovery ? 'update' : 'signin');

  useEffect(() => {
    if (open) setMode(recovery ? 'update' : 'signin');
  }, [open, recovery]);

  const text = authCopy[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="raah-dialog auth-dialog">
        <AuthSymbol />
        <DialogTitle className="dialog-title">{text.title}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
        <AuthPanel
          client={client}
          mode={mode}
          onModeChange={setMode}
          onComplete={() => {
            if (mode === 'update') onRecovered?.();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
