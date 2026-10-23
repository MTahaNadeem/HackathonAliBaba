import { config, failure, ApiError, body as parseBody } from '@/lib/server';
import { createClient } from '@supabase/supabase-js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/** Extension login: accepts email + password, returns session token */
export async function POST(req: Request) {
  try {
    const { email, password } = await parseBody(req) as { email?: string; password?: string };
    if (!email || !password) throw new ApiError(400, 'Email and password required.');

    const c = config();
    if (!c.supabaseUrl || !c.supabaseKey) {
      throw new ApiError(503, 'Auth is not configured.');
    }

    const supabase = createClient(c.supabaseUrl, c.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new ApiError(401, error?.message || 'Invalid credentials.');
    }

    return Response.json(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      { headers: corsHeaders() }
    );
  } catch (e) {
    const res = failure(e);
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}
