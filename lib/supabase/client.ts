import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Module-level singleton instance for browser context to prevent multiple GoTrueClient warnings
let clientInstance: SupabaseClient | null = null;

/**
 * Returns a single shared Supabase client for browser usage.
 * Reuses the existing client instance if already created.
 */
export function getSupabaseBrowserClient(url?: string, anonKey?: string): SupabaseClient | null {
  if (clientInstance) {
    return clientInstance;
  }

  const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  clientInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
    },
  });

  return clientInstance;
}
