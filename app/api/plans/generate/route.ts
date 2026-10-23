import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { profileSchema } from '@/lib/validation';
import { personalizePlan } from '@/lib/ai/recommendation-engine';
import { z } from 'zod';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = z.object({
      goal: z.string().max(100), skills: z.array(z.string().min(1).max(80)).max(10),
      profile: profileSchema.optional(),
    }).safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Invalid request to generate plan.');
    const { goal, skills, profile } = parsed.data;
    return Response.json(await personalizePlan(goal, skills, profile?.hours ?? 10, profile), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
