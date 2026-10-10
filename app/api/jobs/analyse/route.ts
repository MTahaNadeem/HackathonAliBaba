import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { jobSchema } from '@/lib/validation';
import { callGemini } from '@/lib/ai';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = jobSchema.safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Invalid job input.');
    
    let jobText = parsed.data.text;
    const url = parsed.data.url;
    
    if (url && !jobText) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error();
        const html = await res.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        jobText = $('body').text().replace(/\s+/g, ' ').trim();
      } catch {
        throw new ApiError(400, 'Could not fetch job description from URL. Please paste the text instead.');
      }
    }
    
    if (!jobText || jobText.length < 30) throw new ApiError(400, 'Job description too short.');

    const profile = parsed.data.profile;
    const profileContext = profile ? `User Profile:
- Skills: ${profile.skills.join(', ')}
- Experience: ${profile.experience}
- Projects: ${profile.projects}
- Certifications: ${profile.certifications}
- Education: ${profile.qualification}` : 'No profile provided.';

    const systemPrompt = `You are an expert career advisor. Analyze the provided job description and compare it to the user's profile.
Extract the Job Title and Company (if available).
Extract the required and preferred skills. 
Categorize the required and preferred skills into exactly these three categories based on the user's profile:
1. "Demonstrated" (User Already Has): The user's profile has clear evidence (experience, projects, certifications) supporting this skill.
2. "Improve": The user has some mention of this skill or related skills, but needs more evidence.
3. "Learn Next": The user lacks this skill completely or it's a major gap.

Return a JSON object with:
- title: string
- company: string
- gaps: array of objects { skill: string, status: "Demonstrated" | "Improve" | "Learn Next", evidence: string (why it was categorized this way, mention the user's evidence or lack thereof), optional: boolean, importance: string (Why it matters for this job) }
- formal: array of strings (e.g. specific degree, years of experience, license requirements)
- method: "AI Analysis"

Be realistic. If the user doesn't have evidence, put it in Learn Next or Improve.`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skill: { type: "string" },
              status: { type: "string", enum: ["Demonstrated", "Improve", "Learn Next"] },
              evidence: { type: "string" },
              optional: { type: "boolean" },
              importance: { type: "string" }
            },
            required: ["skill", "status", "evidence", "optional", "importance"]
          }
        },
        formal: { type: "array", items: { type: "string" } },
        method: { type: "string" }
      },
      required: ["title", "company", "gaps", "formal", "method"]
    };

    const data = await callGemini(systemPrompt, `Job Description:\n${jobText}\n\n${profileContext}`, schema);
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
