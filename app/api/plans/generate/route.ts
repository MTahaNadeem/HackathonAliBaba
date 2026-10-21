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
      
<<<<<<< Updated upstream
      if (result && Array.isArray((result as any).milestones) && (result as any).milestones.length > 0) {
=======
      if (result && Array.isArray(result.milestones) && result.milestones.length > 0) {
>>>>>>> Stashed changes
        const plan: Plan = {
          id: crypto.randomUUID(),
          title: `Path to ${goal}`,
          goal,
          createdAt: new Date().toISOString(),
<<<<<<< Updated upstream
          milestones: (result as any).milestones.map((m: any) => ({
=======
          milestones: result.milestones.map((m: any) => ({
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          interviewPrep: (result as any).interviewPrep
=======
          interviewPrep: result.interviewPrep
>>>>>>> Stashed changes
        };

        return Response.json(plan);
      }
<<<<<<< Updated upstream
      throw new Error('Invalid AI response structure');
    } catch (aiErr) {
      console.warn('Gemini plan generation unavailable or failed; using deterministic fallback plan:', aiErr);
      const fallbackPlan = createPlan(goal, skills, 5);
      return Response.json(fallbackPlan);
    }
=======
    } catch (aiErr) {
      console.warn('AI plan generation failed or timed out, using enriched deterministic generator:', aiErr);
    }
    
    // Graceful fallback to enriched plan generator
    const fallbackPlan = createPlan(goal, skills, 10);
    return Response.json(fallbackPlan);
>>>>>>> Stashed changes
  } catch (e) {
    return failure(e);
  }
}
