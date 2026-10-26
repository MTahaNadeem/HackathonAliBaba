import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGroqRequest, groqConfig, GroqFailure } from '../lib/ai/groq-provider';
import { personalizeRecommendations, personalizePlan, careerCandidates, recommendationContext } from '../lib/ai/recommendation-engine';
import { emptyProfile, rankTopDegrees, recommend, rankTopUniversities, type Profile } from '../lib/domain';
import { universities, resources } from '../lib/catalogue';
import { planSchema, profileSchema } from '../lib/validation';
import Dashboard from '../components/dashboard';
import Jobs from '../components/jobs';
import { POST as recommendationsPOST } from '../app/api/recommendations/route';
import { POST as planPOST } from '../app/api/plans/generate/route';

const student: Profile = { ...emptyProfile, subjects: ['Mathematics', 'Computer Science'], interests: ['Technology'], skills: ['Python'], ssc: 88, hssc: 85, city: 'Lahore', budget: 200000, student_knows_degree: false };
const output = (p = student) => ({ recommendations: (p.journey === 'career' ? careerCandidates(p).map(r => ({ id: r.id, score: r.score })) : rankTopDegrees(p, 33).map(r => ({ id: r.degree.id, score: r.score }))).map(r => ({ ...r, explanation: 'Your Python background offers a starting point; build evidence for the remaining skills.', nextAction: 'Build and document a small practice project.' })) });
const completion = (content: string, finish = 'stop') => Response.json({ choices: [{ finish_reason: finish, message: { content } }] });
const transport = (response: () => Response) => createGroqRequest({ env: { GROQ_API_KEY: 'test-only' }, fetcher: async () => response() });

void test('Groq provider sends official JSON request and configurable model', async () => {
  let calls = 0;
  const request = createGroqRequest({ env: { GROQ_API_KEY: 'test-only', GROQ_MODEL: 'llama-3.3-70b-versatile' }, fetcher: async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(typeof init?.body, 'string');
    const data = JSON.parse(init?.body as string);
    assert.equal(data.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(data.response_format, { type: 'json_object' });
    assert.equal(init?.redirect, 'error');
    return completion(JSON.stringify(output()));
  } });
  const result = await personalizeRecommendations(student, request);
  assert.equal(calls, 1); assert.equal(result.source, 'groq'); assert.equal(result.fallbackUsed, false);
  assert.equal(groqConfig().endpoint, 'https://api.groq.com/openai/v1/chat/completions');
  assert.throws(() => groqConfig({ GROQ_MODEL: 'invalid model!!' }), GroqFailure);
});

void test('Groq degree scores stay within ten points and preserve factual catalogue fields', async () => {
  const data = output(); data.recommendations.forEach(r => { r.score = 100; });
  const result = await personalizeRecommendations(student, async () => data);
  for (const rec of result.degreeRecommendations) {
    const original = rankTopDegrees(student, 33).find(r => r.degree.id === rec.degree.id)!;
    assert.deepEqual(rec.degree, original.degree);
    assert.ok(Math.abs(rec.score - original.score) <= 10);
    assert.ok(rec.score >= 0 && rec.score <= 100);
  }
  for (const rec of result.recommendations) assert.equal(rec.score, recommend(student).find(r => r.id === rec.id)?.score);
});

for (const [name, change] of Object.entries({
  'missing fields': (d: ReturnType<typeof output>) => { delete (d.recommendations[0] as Partial<typeof d.recommendations[0]>).explanation; },
  'unknown ID': (d: ReturnType<typeof output>) => { d.recommendations[0].id = 'invented'; },
  'duplicate ID': (d: ReturnType<typeof output>) => { d.recommendations[1].id = d.recommendations[0].id; },
  'negative score': (d: ReturnType<typeof output>) => { d.recommendations[0].score = -1; },
  'oversized score': (d: ReturnType<typeof output>) => { d.recommendations[0].score = 101; },
  'invented URL': (d: ReturnType<typeof output>) => { d.recommendations[0].explanation = 'Visit https://invented.example'; },
  'empty recommendations': (d: ReturnType<typeof output>) => { d.recommendations = []; },
  'partial candidates': (d: ReturnType<typeof output>) => { d.recommendations.pop(); },
})) void test(`Rejects ${name} and returns exact deterministic recommendations`, async () => {
  const data = output(); change(data);
  const result = await personalizeRecommendations(student, async () => data);
  assert.equal(result.source, 'deterministic'); assert.equal(result.fallbackUsed, true);
  assert.deepEqual(result.recommendations, recommend(student));
  assert.deepEqual(result.degreeRecommendations, rankTopDegrees(student, 33));
});

for (const [name, request] of [
  ['malformed JSON', transport(() => completion('{broken'))],
  ['invalid envelope', transport(() => Response.json({ choices: [] }))],
  ['truncated response', transport(() => completion(JSON.stringify(output()), 'length'))],
  ['empty content', transport(() => completion(''))],
  ['rate limit', transport(() => new Response('', { status: 429 }))],
  ['provider failure', transport(() => new Response('', { status: 503 }))],
  ['network failure', createGroqRequest({ env: { GROQ_API_KEY: 'test-only' }, fetcher: async () => { throw new Error('sensitive provider error'); } })],
  ['timeout', createGroqRequest({ env: { GROQ_API_KEY: 'test-only' }, timeoutMs: 5, fetcher: () => new Promise(() => {}) })],
  ['missing key', createGroqRequest({ env: {}, fetcher: async () => { assert.fail('Must not call network'); } })],
] as const) void test(`${name} safely falls back`, async () => {
  const result = await personalizeRecommendations(student, request);
  assert.equal(result.source, 'deterministic'); assert.deepEqual(result.degreeRecommendations, rankTopDegrees(student, 33));
});

void test('Preliminary profile skips provider; different students use different real candidates', async () => {
  await personalizeRecommendations(emptyProfile, async () => { assert.fail('No personalization evidence'); });
  const arts = { ...student, subjects: ['Art', 'English'], interests: ['Design', 'Creativity'], skills: [] };
  const a = await personalizeRecommendations(student, async () => output(student));
  const b = await personalizeRecommendations(arts, async () => output(arts));
  assert.notEqual(a.degreeRecommendations[0].degree.id, b.degreeRecommendations[0].degree.id);
});

void test('Career recommendations preserve skill evidence and exclude raw personal data', async () => {
  const p = { ...student, journey: 'career' as const, goal: 'computing', name: 'PRIVATE NAME', resumeText: 'PRIVATE CV', links: 'PRIVATE LINK', extractedSkills: 'SQL, Uncatalogued skill' };
  const result = await personalizeRecommendations(p, async (_, input) => {
    const payload = JSON.stringify(input);
    assert.doesNotMatch(payload, /PRIVATE NAME|PRIVATE CV|PRIVATE LINK/);
    return output(p);
  });
  const developer = result.careers.find(r => r.id === 'developer')!;
  assert.deepEqual(developer.matchedSkills, ['Python']); assert.deepEqual(developer.uncertainSkills, ['SQL']);
  assert.ok(developer.missingSkills.includes('Git'));
  const html = renderToStaticMarkup(React.createElement(Jobs, { profile: p, onPlan: () => {}, recommendations: result }));
  assert.match(html, /Groq-personalized/); assert.match(html, /not live vacancies/); assert.match(html, /CV-mentioned; confirm/);
  assert.equal(recommendationContext(p).targetRoleId, null);
});

void test('Groq cannot override ineligible university results, fees or verification', async () => {
  const p = { ...student, goal: 'civil', student_knows_degree: true, ssc: 45, hssc: 45 };
  const original = structuredClone(rankTopUniversities(universities, p, p.goal));
  const result = await personalizeRecommendations(p, async () => output(p));
  assert.deepEqual(rankTopUniversities(universities, p, p.goal), original);
  assert.ok(original.some(r => r.assessment.status === 'Below published minimum'));
  const props = { profile: p, go: () => {}, onChat: () => {} };
  assert.equal(renderToStaticMarkup(React.createElement(Dashboard, { ...props, recommendations: result })), renderToStaticMarkup(React.createElement(Dashboard, props)));
});

void test('Case B renders Groq results while Case A remains unchanged', async () => {
  const result = await personalizeRecommendations(student, async () => output());
  const html = renderToStaticMarkup(React.createElement(Dashboard, { profile: student, go: () => {}, onChat: () => {}, recommendations: result }));
  assert.match(html, /Groq-personalized/); assert.match(html, /Your Python background/); assert.match(html, /not admission or success probabilities/);
});

const planOutput = { milestones: [
  { id: 'step-1', skill: 'Git', resourceId: 'git', practice: 'Track your Python project changes to practise version control.', proveSkill: 'Document a branch and merge with a short project report.' },
  { id: 'step-0', skill: 'Python', resourceId: 'python', practice: 'Build a small parser as a diagnostic for your self-reported Python skills.', proveSkill: 'Add tests for the parser and explain the results.' },
] };
void test('Groq roadmap prioritizes existing milestones and uses only catalogue resources', async () => {
  const plan = await personalizePlan('Junior software developer', ['Python', 'Git'], 6, student, async (_, input) => {
    assert.ok(JSON.stringify(input).includes('Python')); return planOutput;
  });
  assert.equal(plan.source, 'groq'); assert.equal(plan.hoursPerWeek, 6);
  assert.equal(plan.milestones[0].skill, 'Git');
  assert.equal(plan.milestones[0].structuredLearning?.url, resources.find(r => r.id === 'git')?.url);
  assert.equal(plan.milestones[0].state, 'Not started'); assert.equal(plan.milestones[0].notes, '');
  assert.ok(planSchema.safeParse(plan).success);
});
for (const [name, mutate] of Object.entries({
  'unknown resource': (d: typeof planOutput) => { d.milestones[0].resourceId = 'invented'; },
  'wrong-skill resource': (d: typeof planOutput) => { d.milestones[0].resourceId = 'python'; },
  'unknown skill': (d: typeof planOutput) => { d.milestones[0].skill = 'invented'; },
  'duplicate milestone': (d: typeof planOutput) => { d.milestones[0].id = 'step-0'; },
  'missing milestone': (d: typeof planOutput) => { d.milestones.pop(); },
})) void test(`Roadmap rejects ${name} without losing existing deterministic resources`, async () => {
  const data = structuredClone(planOutput); mutate(data);
  const result = await personalizePlan('Developer', ['Python', 'Git'], 6, student, async () => data);
  assert.equal(result.source, 'deterministic'); assert.deepEqual(result.milestones.map(m => m.skill), ['Python', 'Git']);
  assert.ok(planSchema.safeParse(result).success);
});

void test('Plan and profile persistence contracts preserve progress and journey data', async () => {
  const result = await personalizePlan('Developer', ['Python', 'Git'], 6, student, async () => planOutput);
  result.milestones[0].state = 'Demonstrated'; result.milestones[0].notes = 'My evidence'; result.milestones[0].done = true;
  const saved = planSchema.parse(JSON.parse(JSON.stringify(result)));
  assert.deepEqual(saved.milestones, result.milestones);
  const career = profileSchema.parse({ ...student, journey: 'career' });
  const back = profileSchema.parse({ ...career, journey: 'student' });
  assert.deepEqual(back, profileSchema.parse(student));
});

void test('Existing APIs accept legacy requests and fall back without credentials', async () => {
  const previous = process.env.GROQ_API_KEY; delete process.env.GROQ_API_KEY;
  try {
    const req = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: JSON.stringify(body) });
    const response = await recommendationsPOST(req('/api/recommendations', student));
    assert.equal(response.status, 200); assert.deepEqual(((await response.json()) as { recommendations: unknown }).recommendations, recommend(student));
    const plan = await planPOST(req('/api/plans/generate', { goal: 'Developer', skills: ['Python'] }));
    assert.equal(plan.status, 200); assert.ok(planSchema.safeParse(await plan.json()).success);
    const invalid = await recommendationsPOST(req('/api/recommendations', { skills: 'bad' })); assert.equal(invalid.status, 400);
  } finally { if (previous !== undefined) process.env.GROQ_API_KEY = previous; }
});

void test('Career rejects invented role IDs and extra model skill classifications', async () => {
  const p = { ...student, journey: 'career' as const };
  const bad = output(p); bad.recommendations[0].id = 'live-job-invented';
  assert.equal((await personalizeRecommendations(p, async () => bad)).source, 'deterministic');
  const extra = output(p);
  Object.assign(extra.recommendations[0], { matchedSkills: ['Invented skill'] });
  assert.equal((await personalizeRecommendations(p, async () => extra)).source, 'deterministic');
});

void test('Diagnostics do not expose provider error details or personal information', async () => {
  const messages: unknown[][] = [];
  const previous = console.warn;
  console.warn = (...args: unknown[]) => { messages.push(args); };
  try {
    await personalizeRecommendations(student, async () => { throw new Error('secret-key private-name provider-body'); });
    assert.equal(messages.length, 1);
    assert.doesNotMatch(JSON.stringify(messages), /secret-key|private-name|provider-body/);
  } finally { console.warn = previous; }
});

void test('Unknown legacy roadmap skills preserve deterministic behavior without a provider request', async () => {
  const plan = await personalizePlan('Frontend developer', ['React'], 10, student, async () => { assert.fail('Unsupported skill must not be sent'); });
  assert.equal(plan.source, 'deterministic'); assert.equal(plan.milestones[0].skill, 'React');
});

void test('Profile and plan PUT handlers preserve data through mocked Supabase persistence', async () => {
  const { PUT: saveProfile } = await import('../app/api/profile/route');
  const { PUT: savePlan } = await import('../app/api/plans/route');
  const previousFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const writes: { path: string; body: { data: unknown; user_id: string } }[] = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-only.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only';
  globalThis.fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    if (path === '/auth/v1/user') return Response.json({ id: 'test-user', aud: 'authenticated' });
    assert.ok(path === '/rest/v1/profiles' || path === '/rest/v1/plans');
    assert.equal(typeof init?.body, 'string');
    writes.push({ path, body: JSON.parse(init?.body as string) });
    return Response.json({}, { status: 201 });
  };
  try {
    const p = profileSchema.parse({ ...student, journey: 'career' });
    const plan = await personalizePlan('Developer', ['Python', 'Git'], 6, student, async () => planOutput);
    plan.milestones[0].state = 'Demonstrated'; plan.milestones[0].notes = 'Evidence retained';
    const request = (path: string, data: unknown) => new Request(`http://localhost${path}`, {
      method: 'PUT', headers: { Origin: 'http://localhost', Authorization: 'Bearer test-only', 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    assert.equal((await saveProfile(request('/api/profile', p))).status, 200);
    assert.equal((await savePlan(request('/api/plans', plan))).status, 200);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].body.data, p);
    assert.deepEqual(writes[1].body.data, planSchema.parse(plan));
    assert.ok(writes.every(w => w.body.user_id === 'test-user'));
  } finally {
    globalThis.fetch = previousFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
