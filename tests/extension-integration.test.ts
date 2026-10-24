import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learningEvidence } from '../lib/learning-memory';
import { accountJobAnalysis } from '../lib/account-job-analysis';
import { createPlan } from '../lib/domain';
import { POST as authenticate } from '../app/api/extension/auth/route';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

void test('Learning memory aggregates all plans without confusing progress and completion', () => {
  const react = createPlan('Developer', ['React'], 5);
  react.milestones[0].state = 'Demonstrated';
  const ts = createPlan('Developer', ['TypeScript'], 5);
  ts.milestones[0].state = 'Learning';
  const memory = learningEvidence(
    { skills: ['JavaScript'], extractedSkills: 'SQL, Python' },
    [react, ts],
  );
  assert.deepEqual(memory.learnedSkills, ['React']);
  assert.deepEqual(memory.inProgressSkills, ['TypeScript']);
  const analysis = accountJobAnalysis(
    'React, TypeScript and JavaScript required. SQL preferred. A relevant degree required.',
    memory,
  );
  assert.deepEqual(analysis.missingSkills.sort(), ['SQL', 'TypeScript']);
  assert.equal(analysis.overallJobMatch, null);
  assert.ok(analysis.formal.length);
});
void test('Study stage alone does not earn a skill; all stages must be completed', () => {
  const plan = createPlan('Developer', ['React'], 5);
  plan.milestones.push({ ...plan.milestones[0], id: 'project' });
  plan.milestones[0].state = 'Demonstrated';
  assert.deepEqual(learningEvidence(null, [plan]).learnedSkills, []);
  plan.milestones[1].state = 'Demonstrated';
  assert.deepEqual(learningEvidence(null, [plan]).learnedSkills, ['React']);
});
void test('Reanalysis reflects newly completed skills on this job and overlapping jobs', () => {
  const p = createPlan('React developer', ['React', 'TypeScript'], 5);
  const text = 'React and TypeScript are required for this developer role.';
  const initial = accountJobAnalysis(text, learningEvidence(null, [p]));
  assert.equal(initial.matchPercent, 0);
  p.milestones[0].state = 'Demonstrated';
  const next = accountJobAnalysis(text, learningEvidence(null, [p]));
  assert.equal(next.matchPercent, 50);
  assert.deepEqual(next.missingSkills, ['TypeScript']);
  assert.equal(
    accountJobAnalysis(
      'React is required for our frontend engineer position.',
      learningEvidence(null, [p]),
    ).matchPercent,
    100,
  );
  p.milestones[1].state = 'Demonstrated';
  assert.equal(
    accountJobAnalysis(text, learningEvidence(null, [p])).matchPercent,
    100,
  );
});
void test('Required skills weigh twice preferred skills; inferred skills are not completion', () => {
  const result = accountJobAnalysis(
    'React required. TypeScript preferred.',
    learningEvidence({ skills: ['React'], extractedSkills: 'TypeScript' }, []),
  );
  assert.equal(result.matchPercent, 67);
  assert.equal(result.skillCoverage, 50);
  assert.equal(
    accountJobAnalysis(
      'No React required. Python required.',
      learningEvidence(null, []),
    ).detectedSkills.includes('React'),
    false,
  );
  assert.ok(
    accountJobAnalysis(
      'C++ and C# developers required.',
      learningEvidence(null, []),
    ).detectedSkills.includes('C++'),
  );
});
void test('Account evidence is isolated and never imports default guest skills', () => {
  const a = learningEvidence({ skills: ['React'] }, []);
  const b = learningEvidence(null, []);
  assert.equal(
    accountJobAnalysis('React is required for this role.', a).matchPercent,
    100,
  );
  assert.equal(
    accountJobAnalysis('React is required for this role.', b).matchPercent,
    0,
  );
});
void test('Login validates input without calling the identity service', async () => {
  const response = await authenticate(
    new Request('http://localhost/api/extension/auth', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid', password: 'x' }),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
function worker(
  initial: Record<string, unknown> = {},
  responses:
    | ((url: string, init: RequestInit) => Promise<Response>)
    | null = null,
) {
  const store = { ...initial };
  let listener: (
    message: unknown,
    sender: unknown,
    reply: (data: { ok: boolean; data?: unknown; error?: string }) => void,
  ) => unknown = () => {};
  let access = '';
  const chrome = {
    storage: {
      session: {
        setAccessLevel: async (x: { accessLevel: string }) => {
          access = x.accessLevel;
        },
      },
      local: {
        setAccessLevel: async (x: { accessLevel: string }) => {
          access = x.accessLevel;
        },
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (x: object) => Object.assign(store, x),
        remove: async (key: string) => {
          delete store[key];
        },
      },
    },
    runtime: {
      id: 'test',
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onInstalled: { addListener: () => {} },
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
    action: { setBadgeBackgroundColor: () => {} },
  };
  vm.runInNewContext(
    readFileSync('courseai-compass-extension/background.js', 'utf8'),
    {
      chrome,
      fetch:
        responses ||
        (() => {
          throw new Error('Unexpected fetch');
        }),
      AbortSignal,
      Date,
      Promise,
      Error,
    },
  );
  const send = (
    message: unknown,
    sender = { id: 'test', url: 'chrome-extension://test/popup.html' },
  ) =>
    new Promise<{ ok: boolean; data?: unknown; error?: string }>((resolve) =>
      listener(message, sender, resolve),
    );
  return { store, send, access: () => access, listener: () => listener };
}
void test('MV3 worker refreshes rotated tokens once, restores sessions and stores no passwords', async () => {
  let refreshes = 0;
  const w = worker(
    {
      compassSession: {
        access_token: 'old',
        refresh_token: 'refresh',
        expires_at: 1,
        email: 'a@example.invalid',
        userId: 'a',
      },
    },
    async (url, init) => {
      if (url.endsWith('/auth')) {
        refreshes++;
        assert.equal(JSON.parse(init.body as string).action, 'refresh');
        return Response.json({
          access_token: 'new',
          refresh_token: 'rotated',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'a', email: 'a@example.invalid' },
        });
      }
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        'Bearer new',
      );
      return Response.json({ skills: ['React'] });
    },
  );
  const results = await Promise.all([
    w.send({ action: 'session' }),
    w.send({ action: 'api', path: '/api/extension/profile' }),
  ]);
  assert.ok(results.every((r) => r.ok));
  assert.equal(refreshes, 1);
  assert.equal(w.access(), 'TRUSTED_CONTEXTS');
  assert.doesNotMatch(JSON.stringify(results), /rotated|access_token/);
  assert.doesNotMatch(JSON.stringify(w.store), /password/);
});
void test('Expired refresh clears the session and fails rather than using stale skills', async () => {
  const w = worker(
    {
      compassSession: {
        access_token: 'old',
        refresh_token: 'old',
        expires_at: 1,
      },
    },
    async () => Response.json({ error: 'Session expired' }, { status: 401 }),
  );
  const result = await w.send({
    action: 'api',
    path: '/api/extension/profile',
  });
  assert.equal(result.ok, false);
  assert.equal(w.store.compassSession, undefined);
});
void test('Network failure retains refresh credentials for a safe retry', async () => {
  const w = worker(
    {
      compassSession: {
        access_token: 'old',
        refresh_token: 'old',
        expires_at: 1,
      },
    },
    async () => {
      throw new Error('Network unavailable');
    },
  );
  assert.equal((await w.send({ action: 'session' })).ok, false);
  assert.ok(w.store.compassSession);
});
void test('Content scripts cannot ask the worker for authenticated requests', () => {
  const w = worker();
  let responded = false;
  const result = w.listener()(
    { action: 'session' },
    { id: 'test', url: 'https://indeed.com/jobs' },
    () => {
      responded = true;
    },
  );
  assert.equal(result, undefined);
  assert.equal(responded, false);
});
void test('Manifest requests only website network access and user-triggered extraction', () => {
  const manifest = JSON.parse(
    readFileSync('courseai-compass-extension/manifest.json', 'utf8'),
  );
  assert.deepEqual(manifest.host_permissions, [
    'https://coursecompassai.vercel.app/*',
  ]);
  assert.equal(manifest.content_scripts, undefined);
});

void test('Website curriculum lesson completion credits only linked stages and survives undo', async () => {
  const { createJobRoadmap, linkedLessonProgress } =
    await import('../lib/job-roadmap');
  const { planSchema } = await import('../lib/validation');
  const { jobSkills } = await import('../lib/job-skills');
  const plan = createJobRoadmap(crypto.randomUUID(), 'Frontend developer', [
    'React',
    'TypeScript',
  ]);
  const modules = plan.modules!;
  const reactIds = new Set(
    plan.milestones
      .filter((m) => m.skill === 'React')
      .map((m) => `syn-les-${m.id}`),
  );
  for (const lesson of modules.flatMap((m) => m.lessons))
    if (reactIds.has(lesson.id)) lesson.done = true;
  plan.milestones = plan.milestones.map(
    (m) => linkedLessonProgress(m, modules) || m,
  );
  assert.deepEqual(learningEvidence(null, [plan]).learnedSkills, ['React']);
  assert.deepEqual(learningEvidence(null, [plan]).inProgressSkills, []);
  modules[0].lessons[0].done = false;
  plan.milestones = plan.milestones.map(
    (m) => linkedLessonProgress(m, modules) || m,
  );
  assert.deepEqual(learningEvidence(null, [plan]).learnedSkills, []);
  assert.ok(
    planSchema.safeParse(
      createJobRoadmap(crypto.randomUUID(), 'Broad technology role', jobSkills),
    ).success,
  );
});
