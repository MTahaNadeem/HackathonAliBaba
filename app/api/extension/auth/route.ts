import { config, ApiError, body } from '@/lib/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  extensionOptions,
  extensionJson,
  extensionFailure,
} from '@/lib/extension-http';
export const OPTIONS = extensionOptions;
const requestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('login'),
    email: z.email(),
    password: z.string().min(1).max(1000),
  }),
  z.object({
    action: z.literal('refresh'),
    refresh_token: z.string().min(1).max(8000),
  }),
  z.object({
    action: z.literal('logout'),
    access_token: z.string().min(1).max(8000),
    refresh_token: z.string().min(1).max(8000),
  }),
]);
export async function POST(req: Request) {
  try {
    const raw = await body(req);
    const parsed = requestSchema.safeParse({
      ...raw,
      action: raw.action || 'login',
    });
    if (!parsed.success)
      throw new ApiError(400, 'Enter a valid email and password or session.');
    const c = config();
    if (!c.supabaseUrl || !c.supabaseKey)
      throw new ApiError(
        503,
        'Account authentication is not configured on this website.',
      );
    const client = createClient(c.supabaseUrl, c.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const input = parsed.data;
    if (input.action === 'logout') {
      const restored = await client.auth.setSession({
        access_token: input.access_token,
        refresh_token: input.refresh_token,
      });
      if (
        restored.error &&
        (!restored.error.status || restored.error.status >= 500)
      )
        throw new ApiError(
          503,
          'Session revocation unavailable. Retry logout.',
        );
      if (!restored.error) {
        const result = await client.auth.signOut({ scope: 'local' });
        if (result.error)
          throw new ApiError(503, 'Session revocation failed. Retry logout.');
      }
      return extensionJson({ signedOut: true });
    }
    const result =
      input.action === 'refresh'
        ? await client.auth.refreshSession({
            refresh_token: input.refresh_token,
          })
        : await client.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });
    if (result.error || !result.data.session)
      throw new ApiError(
        result.error?.status && result.error.status >= 500 ? 503 : 401,
        input.action === 'refresh'
          ? 'Your session expired. Sign in again.'
          : 'Sign-in failed. Check your credentials and email confirmation.',
      );
    const s = result.data.session;
    return extensionJson({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      user: { id: s.user.id, email: s.user.email },
    });
  } catch (error) {
    return extensionFailure(error);
  }
}
