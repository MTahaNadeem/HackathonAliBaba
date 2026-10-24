import { userClient, body, ApiError } from '@/lib/server';
import { loadLearningMemory } from '@/lib/learning-memory';
import {
  extensionOptions,
  extensionJson,
  extensionFailure,
} from '@/lib/extension-http';
import { z } from 'zod';
export const OPTIONS = extensionOptions;
export async function GET(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const memory = await loadLearningMemory(client, user.id);
    const latest = [...memory.plans].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
    return extensionJson({
      ...memory,
      email: user.email,
      plan: latest
        ? {
            title: latest.title,
            goal: latest.goal,
            totalMilestones: latest.milestones.length,
            completedMilestones: latest.milestones.filter(
              (m) => m.done || m.state === 'Demonstrated',
            ).length,
          }
        : null,
    });
  } catch (e) {
    return extensionFailure(e);
  }
}
export async function PUT(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const parsed = z
      .object({
        skill: z.string().trim().min(1).max(80),
        remove: z.boolean().default(false),
      })
      .safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Enter a valid skill.');
    const { skill, remove } = parsed.data;
    const result = remove
      ? await client
          .from('user_skill_claims')
          .delete()
          .eq('user_id', user.id)
          .eq('skill_key', skill.toLowerCase())
      : await client
          .from('user_skill_claims')
          .upsert(
            { user_id: user.id, skill_key: skill.toLowerCase(), skill },
            { onConflict: 'user_id,skill_key' },
          );
    if (result.error)
      throw new ApiError(503, 'Skill update could not be saved.');
    return extensionJson({ saved: true });
  } catch (e) {
    return extensionFailure(e);
  }
}
