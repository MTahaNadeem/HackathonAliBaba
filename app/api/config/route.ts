import {config} from '@/lib/server';
export function GET(){const c=config();return Response.json({supabaseUrl:c.supabaseUrl,supabaseKey:c.supabaseKey,authConfigured:!!(c.supabaseUrl&&c.supabaseKey),aiConfigured:!!process.env.GEMINI_API_KEY,storage:'PostgreSQL via Supabase',guestPersistence:false},{headers:{'Cache-Control':'no-store'}})}
