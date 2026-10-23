import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { profileSchema } from '@/lib/validation';
import { personalizeRecommendations } from '@/lib/ai/recommendation-engine';
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = profileSchema.safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Complete a valid student profile first.');
    return Response.json(await personalizeRecommendations(parsed.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
