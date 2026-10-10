/**
 * app/api/ingestion/refresh/route.ts
 *
 * Vercel Cron endpoint for the scheduled ingestion pipeline.
 *
 * Secured with CRON_SECRET: Vercel sets the Authorization header with the
 * secret value when invoking a cron route. Manual calls must also supply
 * it: Authorization: Bearer <CRON_SECRET>
 *
 * Free-tier note: This route is configured to run once per week (Sunday 02:00 UTC)
 * in vercel.json. Vercel Hobby allows at most once-per-day schedules; weekly
 * is within that limit.
 */

import { runIngestionPipeline } from '@/lib/ingestion/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // seconds; Hobby tier max is 300s

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Determine trigger type: Vercel sets x-vercel-cron: 1 on cron invocations
  const isCron = request.headers.get('x-vercel-cron') === '1';
  const trigger = isCron ? 'cron' : 'manual';

  try {
    const result = await runIngestionPipeline(trigger);
    return Response.json({ ok: true, trigger, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ingestion/refresh] Pipeline error:', message);
    return Response.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
