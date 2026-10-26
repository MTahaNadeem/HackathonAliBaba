import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, PUT, POST } from '../app/api/extension/analyses/route';
import { planSchema } from '../lib/validation';

void test('Owned analysis handoff reuses stable plan and preserves completed progress; other accounts cannot open it', async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-publishable';
  const id = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  let plan: ReturnType<typeof planSchema.parse> | null = null;
  let linked = false;
  let inserts = 0;
  const job = {
    jobTitle: 'React developer',
    bodyText:
      'React and TypeScript are required for this frontend developer role.',
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(init?.headers);
    const isOther = headers.get('Authorization') === 'Bearer other';
    const method = init?.method || 'GET';
    if (url.pathname === '/auth/v1/user')
      return Response.json({
        id: isOther ? '33333333-3333-4333-8333-333333333333' : owner,
        email: 'fixture@example.invalid',
      });
    assert.ok(
      url.searchParams.get('user_id') ===
        `eq.${isOther ? '33333333-3333-4333-8333-333333333333' : owner}` ||
        method === 'POST',
    );
    if (url.pathname.endsWith('/profiles')) return Response.json(null);
    if (url.pathname.endsWith('/user_skill_claims')) return Response.json([]);
    if (url.pathname.endsWith('/job_analyses')) {
      if (method === 'PATCH') {
        linked = true;
        return new Response(null, { status: 204 });
      }
      return Response.json(
        isOther ? null : { data: job, plan_id: linked ? id : null },
      );
    }
    if (url.pathname.endsWith('/plans')) {
      if (method === 'POST') {
        inserts++;
        const value = JSON.parse(init?.body as string);
        assert.equal(value.user_id, owner);
        assert.equal(url.searchParams.get('on_conflict'), 'id');
        assert.ok(headers.get('Prefer')?.includes('ignore-duplicates'));
        plan = planSchema.parse(value.data);
        return new Response(null, { status: 201 });
      }
      return Response.json(
        url.searchParams.has('id')
          ? { data: plan }
          : plan
            ? [{ data: plan }]
            : [],
      );
    }
    throw new Error('Unexpected fixture request');
  };
  const request = (token = 'owner') =>
    new Request('http://localhost/api/extension/analyses', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
  try {
    const first = await PUT(request());
    assert.equal(first.status, 200);
    const data = (await first.json()) as {
      plan: ReturnType<typeof planSchema.parse>;
    };
    assert.equal(data.plan.id, id);
    assert.equal(data.plan.milestones.length, 6);
    assert.equal(inserts, 1);
    const stored = planSchema.parse(plan);
    stored.milestones
      .filter((m) => m.skill === 'React')
      .forEach((m) => {
        m.state = 'Demonstrated';
        m.done = true;
      });
    plan = stored;
    const again = await PUT(request());
    assert.equal(again.status, 200);
    const refreshed = (await again.json()) as {
      plan: ReturnType<typeof planSchema.parse>;
      analysis: { matchPercent: number; missingSkills: string[] };
    };
    assert.equal(inserts, 1);
    assert.equal(refreshed.analysis.matchPercent, 50);
    assert.deepEqual(refreshed.analysis.missingSkills, ['TypeScript']);
    assert.equal(
      refreshed.plan.milestones.find(
        (m: { skill: string }) => m.skill === 'React',
      )?.state,
      'Demonstrated',
    );
    assert.equal((await PUT(request('other'))).status, 404);
    assert.equal(
      (
        await GET(
          new Request(`http://localhost/api/extension/analyses?id=${id}`, {
            headers: { Authorization: 'Bearer other' },
          }),
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await POST(
          new Request('http://localhost/api/extension/analyses', {
            method: 'POST',
            headers: { Authorization: 'Bearer owner' },
            body: JSON.stringify({ bodyText: 'short' }),
          }),
        )
      ).status,
      400,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
