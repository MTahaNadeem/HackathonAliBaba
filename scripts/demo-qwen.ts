/** Live demo only: calls the running app, which may consume the configured Qwen quota. */
import assert from 'node:assert/strict';
import type { RecommendationResult } from '../lib/ai/recommendation-engine';
import type { Plan } from '../lib/domain';
import { emptyProfile } from '../lib/domain';

const base = 'http://localhost:3000';
async function post<T>(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, 200, `${path} failed`);
  const data = await response.json() as T & { source: string; fallbackUsed: boolean };
  assert.equal(data.source, 'groq', 'A genuine Groq result is required. Check server configuration and safe diagnostics.');
  assert.equal(data.fallbackUsed, false);
  return data;
}
const technical = { ...emptyProfile, student_knows_degree: false, qualification: 'ICS', subjects: ['Mathematics', 'Computer Science'], interests: ['Technology', 'Problem solving'], skills: ['Python'], city: 'Lahore', budget: 150000, ssc: 88, hssc: 85 };
const creative = { ...emptyProfile, student_knows_degree: false, qualification: 'FA', subjects: ['Art', 'English'], interests: ['Design', 'Creativity'], skills: ['Visual design'], city: 'Karachi', budget: 100000, ssc: 78, hssc: 80 };
for (const [label, profile] of [['Technical student', technical], ['Creative student', creative]] as const) {
  const result = await post<RecommendationResult>('/api/recommendations', profile);
  console.log(label, result.degreeRecommendations.slice(0, 3).map((r: { degree: { id: string }; score: number; reasons: string[] }) => ({ id: r.degree.id, score: r.score, reasons: r.reasons })));
}
const career = { ...technical, journey: 'career', goal: 'computing', stage: 'Graduate / job seeker', extractedSkills: 'SQL', career_goal: 'Junior software developer' };
const ranked = await post<RecommendationResult>('/api/recommendations', career);
console.log('Career ranking and skill evidence', ranked.careers.slice(0, 3));
const plan = await post<Plan>('/api/plans/generate', { goal: 'Junior software developer', skills: ['Python', 'SQL', 'Git'], profile: career });
console.log('Personalized roadmap', plan.milestones);
