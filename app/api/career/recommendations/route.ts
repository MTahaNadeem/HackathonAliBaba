import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { profileSchema } from '@/lib/validation';
import { generateCareerRecommendations } from '@/lib/ai/career-engine';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = profileSchema.partial().safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Invalid profile data.');
    const result = await generateCareerRecommendations(parsed.data as Parameters<typeof generateCareerRecommendations>[0]);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
