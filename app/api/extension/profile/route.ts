import { userClient, failure, ApiError } from '@/lib/server';
import { profileSchema, planSchema } from '@/lib/validation';

/** Allow extension (cross-origin) to read profile + plan progress */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Cache-Control': 'no-store',
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    const { client, user } = await userClient(req);

    // Fetch profile
    const { data: profileRow, error: profileErr } = await client
      .from('profiles')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileErr) throw new ApiError(503, 'Profile could not be loaded.');

    // Fetch latest plan
    const { data: planRows, error: planErr } = await client
      .from('plans')
      .select('data')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (planErr) throw new ApiError(503, 'Plans could not be loaded.');

    const profile = profileRow?.data || null;
    const plan = planRows?.[0]?.data || null;

    // Extract learned skills from plan milestones
    const learnedSkills: string[] = [];
    const inProgressSkills: string[] = [];
    if (plan && Array.isArray(plan.milestones)) {
      for (const m of plan.milestones) {
        if (m.state === 'Demonstrated') {
          learnedSkills.push(m.skill);
        } else if (m.state === 'Learning' || m.state === 'Practiced') {
          inProgressSkills.push(m.skill);
        }
      }
    }

    // Aggregate all user skills from profile
    const profileSkills: string[] = [];
    if (profile) {
      if (Array.isArray(profile.skills)) profileSkills.push(...profile.skills);
      if (profile.extractedSkills) {
        profileSkills.push(
          ...profile.extractedSkills
            .split(/[,\n]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        );
      }
    }

    return Response.json(
      {
        email: user.email,
        profile,
        plan: plan
          ? {
              title: plan.title,
              goal: plan.goal,
              totalMilestones: plan.milestones?.length || 0,
              completedMilestones: learnedSkills.length,
            }
          : null,
        skills: [...new Set(profileSkills)],
        learnedSkills,
        inProgressSkills,
      },
      { headers: corsHeaders() }
    );
  } catch (e) {
    const res = failure(e);
    // Add CORS headers to error responses too
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}
