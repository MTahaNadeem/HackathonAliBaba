import { z } from 'zod';
import { degrees, resources, roles, skillNames } from '../catalogue';
import { analyseJob, createPlan, rankTopDegrees, recommend, type Profile } from '../domain';
import { requestGroq, logFallback, type GroqRequest } from './groq-provider';
import { rankingPrompt, roadmapPrompt } from './prompts';

const text = z.string().trim().min(1).max(500).refine(s => !/(?:https?:|www\.|\]\(|\b[\w-]+\.(?:com|org|edu|pk)\b)/i.test(s));
const rankingSchema = z.strictObject({ recommendations: z.array(z.strictObject({
  id: z.string().min(1).max(100), score: z.number().min(0).max(100), explanation: text, nextAction: text,
})).min(1).max(33) });
const roadmapSchema = z.strictObject({ milestones: z.array(z.strictObject({
  id: z.string().min(1).max(100), skill: z.string().min(1).max(80),
  resourceId: z.string().max(100).nullable(), practice: text, proveSkill: text,
})).min(1).max(8) });
function exactIds(ids: string[], expected: string[]) {
  if (ids.length !== expected.length || new Set(ids).size !== ids.length || ids.some(id => !expected.includes(id))) {
    throw new Error('Invalid candidate set');
  }
}
// No names, contact details, raw CVs or arbitrary biography text are sent to Groq.
export function recommendationContext(p: Profile) {
  const cv = (p.extractedSkills || '').split(/[,;\n]/).map(s => s.trim().toLowerCase());
  return {
    journey: p.journey || 'student', stage: p.stage, qualification: p.qualification,
    subjects: p.subjects, interests: p.interests, skills: p.skills,
    cvMentionedSkills: skillNames.filter(s => cv.includes(s.toLowerCase())),
    city: p.city, budget: p.budget, relocate: p.relocate, ssc: p.ssc, hssc: p.hssc,
    net: p.net, equivalence: p.equivalence, goal: p.goal, hours: p.hours,
    targetRoleId: roles.find(r => r.id === p.career_goal || r.title === p.career_goal)?.id ?? null,
  };
}
export function careerCandidates(p: Profile) {
  const context = recommendationContext(p);
  const goal = degrees.find(d => d.id === p.goal);
  return roles.map(role => {
    const gaps = analyseJob(role.description, p.skills).gaps;
    const matchedSkills = gaps.filter(g => g.status === 'Self-reported').map(g => g.skill);
    const uncertainSkills = gaps.filter(g => !matchedSkills.includes(g.skill) && context.cvMentionedSkills.includes(g.skill)).map(g => g.skill);
    const missingSkills = gaps.filter(g => !matchedSkills.includes(g.skill) && !uncertainSkills.includes(g.skill)).map(g => g.skill);
    const score = Math.min(100, Math.round(20 + (role.degreeId === p.goal ? 40 : goal && degrees.find(d => d.id === role.degreeId)?.field === goal.field ? 20 : 0) + 40 * matchedSkills.length / Math.max(1, gaps.length)));
    return { ...role, score, matchedSkills, missingSkills, uncertainSkills,
      explanation: `${matchedSkills.length} self-reported skills match; ${missingSkills.length} skills need evidence; ${uncertainSkills.length} are CV-mentioned and need confirmation.`,
      nextAction: missingSkills.length ? `Practise ${missingSkills[0]} and record evidence.` : 'Review the role requirements and collect portfolio evidence.',
    };
  }).sort((a, b) => b.score - a.score);
}
// 90% deterministic / 10% model; at most a ten-point adjustment, never a success probability.
const blend = (baseline: number, ai: number) => Math.round(baseline * 0.9 + ai * 0.1);
export async function personalizeRecommendations(p: Profile, request: GroqRequest = requestGroq) {
  const degreeRecommendations = rankTopDegrees(p, degrees.length);
  const careers = careerCandidates(p);
  const kind = p.journey === 'career' ? 'careers' as const : 'degrees' as const;
  const fallback = { kind, recommendations: recommend(p), degreeRecommendations, careers, source: 'deterministic' as const, fallbackUsed: true };
  const career = p.journey === 'career';
  const candidates = career ? careers.map(r => ({ ...r, baselineScore: r.score })) : degreeRecommendations.map(r => ({ ...r.degree, baselineScore: r.score, reasons: r.reasons }));
  if (!candidates.length || (!career && degreeRecommendations.every(d => d.isPreliminary))) return fallback;
  try {
    const result = rankingSchema.parse(await request(rankingPrompt, { profile: recommendationContext(p), candidates }));
    exactIds(result.recommendations.map(r => r.id), candidates.map(c => c.id));
    const byId = new Map(result.recommendations.map(r => [r.id, r]));
    if (career) {
      return { ...fallback, source: 'groq' as const, fallbackUsed: false, careers: careers.map(r => {
        const ai = byId.get(r.id)!;
        return { ...r, score: blend(r.score, ai.score), explanation: ai.explanation, nextAction: ai.nextAction };
      }).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 })) };
    }
    const ranked = degreeRecommendations.map(r => {
      const ai = byId.get(r.degree.id)!;
      return { ...r, score: blend(r.score, ai.score), reasons: [ai.explanation, ...r.reasons].slice(0, 3), nextAction: ai.nextAction };
    }).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
    // Legacy recommendations keep their original unnormalized score contract.
    const order = new Map(ranked.map((r, i) => [r.degree.id, i]));
    return { ...fallback, source: 'groq' as const, fallbackUsed: false, degreeRecommendations: ranked,
      recommendations: fallback.recommendations.map(r => ({ ...r, reasons: ranked.find(d => d.degree.id === r.id)?.reasons ?? r.reasons }))
        .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)),
    };
  } catch (error) { logFallback(error); return fallback; }
}
export type RecommendationResult = Awaited<ReturnType<typeof personalizeRecommendations>>;

export async function personalizePlan(goal: string, skills: string[], hours: number, profile?: Profile, request: GroqRequest = requestGroq) {
  const baseline = createPlan(goal, skills, hours);
  const fallback = { ...baseline, source: 'deterministic' as const, fallbackUsed: true };
  // Legacy arbitrary skills still work through the original deterministic generator.
  if (!baseline.milestones.length || skills.some(s => !skillNames.includes(s))) return fallback;
  try {
    const candidates = baseline.milestones.map(m => ({ id: m.id, skill: m.skill,
      resources: resources.filter(r => r.skills.includes(m.skill)).map(r => ({ id: r.id, title: r.title, practice: r.practice })),
    }));
    const result = roadmapSchema.parse(await request(roadmapPrompt, { goal, hours, profile: profile ? recommendationContext(profile) : null, milestones: candidates }));
    exactIds(result.milestones.map(m => m.id), baseline.milestones.map(m => m.id));
    const milestones = result.milestones.map(m => {
      const original = baseline.milestones.find(b => b.id === m.id)!;
      if (m.skill !== original.skill) throw new Error('Changed skill');
      const resource = resources.find(r => r.id === m.resourceId);
      if (m.resourceId !== null && (!resource || !resource.skills.includes(m.skill))) throw new Error('Unknown or unrelated resource');
      return { ...original, practice: m.practice, proveSkill: m.proveSkill,
        ...(resource ? { resourceId: resource.id, structuredLearning: { title: resource.title, url: resource.url, provider: resource.provider, level: 'Catalogue resource', cost: resource.access } } : {}),
      };
    });
    return { ...baseline, milestones, source: 'groq' as const, fallbackUsed: false };
  } catch (error) { logFallback(error); return fallback; }
}
