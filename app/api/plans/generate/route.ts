import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { profileSchema } from '@/lib/validation';
import { personalizePlan } from '@/lib/ai/recommendation-engine';
import { z } from 'zod';
import { generateCurriculum } from '@/lib/ai/curriculum-engine';
import type { Profile } from '@/lib/domain';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = z.object({
      goal: z.string().max(150),
      skills: z.array(z.string().min(1).max(80)).max(30),
      profile: profileSchema.partial().extend({
        skills: z.array(z.string().max(80)).optional(),
        interests: z.array(z.string().max(80)).optional()
      }).optional(),
      completedTopics: z.array(z.string().max(200)).max(40).optional(),
      mode: z.literal('curriculum').optional(),
      goalType: z.enum(['degree', 'career', 'specialization', 'skill']).default('skill'),
      missingSkills: z.array(z.string().max(100)).max(30).optional(),
    }).safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Invalid request to generate plan.');
    const { goal, skills, profile } = parsed.data;
    if (parsed.data.mode === 'curriculum') {
      const input = {
        goal,
        skills,
        profile,
        goalType: parsed.data.goalType,
        completedTopics: parsed.data.completedTopics,
        missingSkills: parsed.data.missingSkills,
      };
      if (!goal.trim()) throw new ApiError(400, 'Choose a subject or skill first.');
      if (req.headers.get('accept') === 'application/x-ndjson') {
        const abort = new AbortController();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: unknown) => {
              if (!abort.signal.aborted) controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
            };
            try {
              const plan = await generateCurriculum(input, {
                signal: AbortSignal.any([req.signal, abort.signal]),
                onProgress: (progress) => send({ type: 'progress', ...progress }),
              });
              send({ type: 'complete', plan });
            } catch {
              if (!abort.signal.aborted && !req.signal.aborted) {
                send({ type: 'error', message: 'Generation could not finish. Your existing plans are unchanged.' });
              }
            } finally {
              if (!abort.signal.aborted) controller.close();
            }
          },
          cancel() {
            abort.abort();
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
        });
      }
      return Response.json(await generateCurriculum(input, { signal: req.signal }), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return Response.json(await personalizePlan(goal, skills, profile?.hours ?? 10, profile as Profile | undefined), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
