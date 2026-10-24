import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './server';
import { planSchema } from './validation';
export const uniqueSkills = (values: string[]) => [
  ...new Map(
    values
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => [s.trim().toLowerCase(), s.trim()]),
  ).values(),
];
export function learningEvidence(
  profile: Record<string, unknown> | null,
  plans: unknown[],
  manual: string[] = [],
) {
  const learned: string[] = [];
  const progress: string[] = [];
  const checked = plans.flatMap((p) => {
    const result = planSchema.safeParse(p);
    return result.success ? [result.data] : [];
  });
  for (const plan of checked) {
    const groups = new Map<string, typeof plan.milestones>();
    for (const milestone of plan.milestones) {
      const key = milestone.skill.toLowerCase();
      groups.set(key, [...(groups.get(key) || []), milestone]);
    }
    for (const steps of groups.values()) {
      if (steps.every((m) => m.state === 'Demonstrated' || m.done))
        learned.push(steps[0].skill);
      else if (
        steps.some(
          (m) =>
            m.done ||
            ['Learning', 'Practiced', 'Demonstrated'].includes(m.state || ''),
        )
      )
        progress.push(steps[0].skill);
    }
  }
  const skills = uniqueSkills([
    ...(Array.isArray(profile?.skills)
      ? profile.skills.filter((s): s is string => typeof s === 'string')
      : []),
    ...manual,
  ]);
  const inferred =
    typeof profile?.extractedSkills === 'string'
      ? uniqueSkills(profile.extractedSkills.split(/[,;\n]/))
      : [];
  const learnedSkills = uniqueSkills(learned);
  return {
    profile,
    plans: checked,
    manualSkills: uniqueSkills(manual),
    skills,
    learnedSkills,
    inProgressSkills: uniqueSkills(progress).filter(
      (s) => !learnedSkills.some((l) => l.toLowerCase() === s.toLowerCase()),
    ),
    inferredSkills: inferred,
  };
}
export async function loadLearningMemory(
  client: SupabaseClient,
  userId: string,
) {
  const { data: row, error } = await client
    .from('profiles')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new ApiError(503, 'Profile could not be loaded.');
  const plans: unknown[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await client
      .from('plans')
      .select('data')
      .eq('user_id', userId)
      .order('id')
      .range(offset, offset + 99);
    if (result.error)
      throw new ApiError(503, 'Learning history could not be loaded.');
    plans.push(...(result.data || []).map((r) => r.data));
    if (!result.data || result.data.length < 100) break;
  }
  const manual = await client
    .from('user_skill_claims')
    .select('skill')
    .eq('user_id', userId);
  if (manual.error)
    throw new ApiError(
      503,
      'Extension storage is not ready. Apply migration 004_extension_learning.sql.',
    );
  return learningEvidence(
    row?.data || null,
    plans,
    (manual.data || []).map((r) => r.skill),
  );
}
