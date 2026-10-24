import { z } from 'zod';
import { createHash } from 'node:crypto';
import { userClient, body, ApiError } from '@/lib/server';
import {
  extensionOptions,
  extensionJson,
  extensionFailure,
} from '@/lib/extension-http';
import { loadLearningMemory } from '@/lib/learning-memory';
import { accountJobAnalysis } from '@/lib/account-job-analysis';
import { createJobRoadmap } from '@/lib/job-roadmap';
import { planSchema } from '@/lib/validation';
export const OPTIONS = extensionOptions;
const jobSchema = z.object({
  bodyText: z.string().trim().min(30).max(15000),
  jobTitle: z.string().max(150).default('Target role'),
  company: z.string().max(150).default(''),
  url: z
    .string()
    .max(2000)
    .refine((v) => !v || /^https?:\/\//.test(v))
    .default(''),
});
export async function POST(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const parsed = jobSchema.safeParse(await body(req));
    if (!parsed.success)
      throw new ApiError(
        400,
        'Open a full job description or paste at least 30 characters.',
      );
    const job = parsed.data;
    const memory = await loadLearningMemory(client, user.id);
    const analysis = accountJobAnalysis(job.bodyText, memory);
    const key = createHash('sha256')
      .update(`${job.url}\n${job.jobTitle}\n${job.bodyText}`)
      .digest('hex');
    const result = await client
      .from('job_analyses')
      .upsert(
        {
          user_id: user.id,
          job_key: key,
          data: { ...job, ...analysis },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,job_key' },
      )
      .select('id')
      .single();
    if (result.error)
      throw new ApiError(
        503,
        'Analysis could not be saved. Check the extension database migration.',
      );
    return extensionJson({ ...analysis, id: result.data.id });
  } catch (e) {
    return extensionFailure(e);
  }
}
export async function GET(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const id = new URL(req.url).searchParams.get('id');
    const query = client
      .from('job_analyses')
      .select('id,data,plan_id,updated_at')
      .eq('user_id', user.id);
    if (id) {
      if (!z.uuid().safeParse(id).success)
        throw new ApiError(400, 'Invalid analysis identifier.');
      const result = await query.eq('id', id).maybeSingle();
      if (result.error)
        throw new ApiError(503, 'Analysis storage unavailable.');
      if (!result.data)
        throw new ApiError(404, 'Analysis not found for this account.');
      const memory = await loadLearningMemory(client, user.id);
      return extensionJson({
        ...result.data,
        analysis: {
          ...result.data.data,
          ...accountJobAnalysis(result.data.data.bodyText, memory),
        },
      });
    }
    const result = await query
      .order('updated_at', { ascending: false })
      .limit(100);
    if (result.error) throw new ApiError(503, 'Saved analyses unavailable.');
    const memory = await loadLearningMemory(client, user.id);
    return extensionJson({
      analyses: (result.data || []).map((row) => ({
        ...row,
        data: { ...row.data, ...accountJobAnalysis(row.data.bodyText, memory) },
      })),
    });
  } catch (e) {
    return extensionFailure(e);
  }
}
export async function PUT(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const parsed = z.object({ id: z.uuid() }).safeParse(await body(req));
    if (!parsed.success)
      throw new ApiError(400, 'Invalid analysis identifier.');
    const row = await client
      .from('job_analyses')
      .select('data,plan_id')
      .eq('user_id', user.id)
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (row.error) throw new ApiError(503, 'Analysis storage unavailable.');
    if (!row.data)
      throw new ApiError(404, 'Analysis not found for this account.');
    const memory = await loadLearningMemory(client, user.id);
    const analysis = accountJobAnalysis(row.data.data.bodyText, memory);
    const prior = memory.plans.find((p) => p.id === row.data!.plan_id);
    const plan =
      prior ||
      createJobRoadmap(
        parsed.data.id,
        row.data.data.jobTitle,
        Array.isArray(row.data.data.targetSkills)
          ? row.data.data.targetSkills.filter(
              (skill: string) =>
                !memory.skills
                  .concat(memory.learnedSkills)
                  .some((known) => known.toLowerCase() === skill.toLowerCase()),
            )
          : analysis.missingSkills,
        typeof memory.profile?.hours === 'number'
          ? Math.max(1, Math.min(30, memory.profile.hours))
          : 5,
      );
    // A stable analysis-based plan ID makes concurrent first opens idempotent. Never reset existing progress.
    if (!prior) {
      const stored = await client
        .from('plans')
        .upsert(
          { id: plan.id, user_id: user.id, data: planSchema.parse(plan) },
          { onConflict: 'id', ignoreDuplicates: true },
        );
      if (stored.error) throw new ApiError(503, 'Roadmap could not be saved.');
      const linked = await client
        .from('job_analyses')
        .update({ plan_id: plan.id })
        .eq('user_id', user.id)
        .eq('id', parsed.data.id);
      if (linked.error)
        throw new ApiError(503, 'Roadmap link could not be saved. Retry.');
    }
    const saved = await client
      .from('plans')
      .select('data')
      .eq('user_id', user.id)
      .eq('id', plan.id)
      .single();
    if (saved.error) throw new ApiError(503, 'Saved roadmap unavailable.');
    return extensionJson({ plan: saved.data.data, analysis });
  } catch (e) {
    return extensionFailure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const id = new URL(req.url).searchParams.get('id');
    if (!z.uuid().safeParse(id).success)
      throw new ApiError(400, 'Invalid analysis identifier.');
    const result = await client
      .from('job_analyses')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id!);
    if (result.error) throw new ApiError(503, 'Could not remove analysis.');
    return extensionJson({ removed: true });
  } catch (e) {
    return extensionFailure(e);
  }
}

// Target choices affect the roadmap only; scores always use server-extracted requirements.
export async function PATCH(req: Request) {
  try {
    const { client, user } = await userClient(req);
    const parsed = z
      .object({
        id: z.uuid(),
        skills: z.array(z.string().trim().min(1).max(60)).min(1).max(150),
      })
      .safeParse(await body(req));
    if (!parsed.success)
      throw new ApiError(400, 'Select valid skills for your roadmap.');
    const row = await client
      .from('job_analyses')
      .select('data,plan_id')
      .eq('user_id', user.id)
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (row.error) throw new ApiError(503, 'Analysis storage unavailable.');
    if (!row.data)
      throw new ApiError(404, 'Analysis not found for this account.');
    if (row.data.plan_id) return extensionJson({ existing: true });
    const result = await client
      .from('job_analyses')
      .update({
        data: {
          ...row.data.data,
          targetSkills: [...new Set(parsed.data.skills)],
        },
      })
      .eq('user_id', user.id)
      .eq('id', parsed.data.id)
      .is('plan_id', null);
    if (result.error)
      throw new ApiError(503, 'Roadmap selection could not be saved.');
    return extensionJson({ saved: true });
  } catch (e) {
    return extensionFailure(e);
  }
}
