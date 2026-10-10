import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { callGemini } from '@/lib/ai';
import { z } from 'zod';
import { type Plan, createPlan } from '@/lib/domain';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = z.object({
      goal: z.string().max(100),
      skills: z.array(z.string()).max(10)
    }).safeParse(await body(req));
    
    if (!parsed.success) throw new ApiError(400, 'Invalid request to generate plan.');
    
    const { goal, skills } = parsed.data;
    
    try {
      const systemPrompt = `You are a career learning path generator. The user wants to prepare for the role: "${goal}".
They need to learn or improve the following skills: ${skills.join(', ')}.

For each skill, generate a milestone with:
- A beginner-friendly video tutorial (startLearning) from a credible source (like YouTube).
- A structured course (structuredLearning) from Coursera, freeCodeCamp, etc.
- A practice suggestion (practice).
- A project idea to prove the skill (proveSkill).

Also, generate interview preparation for this specific job role:
- 3 technical questions, with hints and answers.
- 3 behavioral questions, with hints and answers.
- A resume checklist specific to this role.
- An application checklist.

Output in strict JSON format.`;

      const schema = {
        type: "object",
        properties: {
          milestones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                skill: { type: "string" },
                title: { type: "string" },
                startLearning: {
                  type: "object",
                  properties: { title: { type: "string" }, url: { type: "string" }, provider: { type: "string" }, level: { type: "string" }, cost: { type: "string" } },
                  required: ["title", "url", "provider", "level", "cost"]
                },
                structuredLearning: {
                  type: "object",
                  properties: { title: { type: "string" }, url: { type: "string" }, provider: { type: "string" }, level: { type: "string" }, cost: { type: "string" } },
                  required: ["title", "url", "provider", "level", "cost"]
                },
                practice: { type: "string" },
                proveSkill: { type: "string" }
              },
              required: ["skill", "title", "startLearning", "structuredLearning", "practice", "proveSkill"]
            }
          },
          interviewPrep: {
            type: "object",
            properties: {
              technical: { type: "array", items: { type: "object", properties: { question: { type: "string" }, hint: { type: "string" }, answer: { type: "string" } }, required: ["question", "hint", "answer"] } },
              behavioral: { type: "array", items: { type: "object", properties: { question: { type: "string" }, hint: { type: "string" }, answer: { type: "string" } }, required: ["question", "hint", "answer"] } },
              resumeChecklist: { type: "array", items: { type: "string" } },
              applicationChecklist: { type: "array", items: { type: "string" } }
            },
            required: ["technical", "behavioral", "resumeChecklist", "applicationChecklist"]
          }
        },
        required: ["milestones", "interviewPrep"]
      };

      const result = await callGemini(systemPrompt, 'Generate the plan now.', schema);
      
      if (result && Array.isArray((result as any).milestones) && (result as any).milestones.length > 0) {
        const plan: Plan = {
          id: crypto.randomUUID(),
          title: `Path to ${goal}`,
          goal,
          createdAt: new Date().toISOString(),
          milestones: (result as any).milestones.map((m: any) => ({
            id: crypto.randomUUID(),
            skill: m.skill,
            title: m.title,
            startLearning: m.startLearning,
            structuredLearning: m.structuredLearning,
            practice: m.practice,
            proveSkill: m.proveSkill,
            state: 'Not started',
            notes: '',
            evidenceUrl: ''
          })),
          interviewPrep: (result as any).interviewPrep
        };

        return Response.json(plan);
      }
      throw new Error('Invalid AI response structure');
    } catch (aiErr) {
      console.warn('Gemini plan generation unavailable or failed; using deterministic fallback plan:', aiErr);
      const fallbackPlan = createPlan(goal, skills, 5);
      return Response.json(fallbackPlan);
    }
  } catch (e) {
    return failure(e);
  }
}
