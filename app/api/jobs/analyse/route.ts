import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { jobSchema } from '@/lib/validation';
import { callGroq } from '@/lib/ai';
import { analyseJob } from '@/lib/domain';
import { roles } from '@/lib/catalogue';
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
    
    if (!jobText || jobText.length < 30) throw new ApiError(400, 'Job description too short. Please provide at least 30 characters.');

    const profile = parsed.data.profile;
    const userSkills = profile?.skills || [];

    // Helper for deterministic skill-matching fallback
    const getDeterministicFallback = () => {
      const det = analyseJob(jobText, userSkills);
      const matchedRole = roles.find(r => 
        r.description.trim() === jobText.trim() || 
        jobText.toLowerCase().includes(r.title.toLowerCase())
      );
      const title = matchedRole ? matchedRole.title : 'Target Role';
      const company = matchedRole ? 'Example Role Brief' : '';

      return {
        title,
        company,
        gaps: det.gaps.map(g => {
          const isDemonstrated = g.status === 'Self-reported';
          return {
            skill: g.skill,
            status: isDemonstrated ? 'Demonstrated' : 'Learn Next',
            evidence: g.evidence,
            optional: g.optional,
            importance: g.optional 
              ? 'Preferred skill mentioned in job requirements' 
              : 'Required skill identified from role description'
          };
        }),
        formal: det.formal,
        method: 'Keyword-assisted analysis (Guided Fallback). Review the original wording; nuanced requirements may need correction.'
      };
    };

    // Attempt Groq AI analysis if configured
    try {
      const profileContext = profile ? `User Profile:
- Skills: ${profile.skills.join(', ')}
- Other Skills: ${profile.extractedSkills || 'None'}
- Experience: ${profile.experience || 'None'}
- Projects: ${profile.projects || 'None'}
- Certifications: ${profile.certifications || 'None'}
- Education: ${profile.qualification || 'None'}` : 'No profile provided.';

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

      const data = await callGroq(systemPrompt, `Job Description:\n${jobText}\n\n${profileContext}`, schema);
      if (data && typeof data === 'object' && Array.isArray((data as any).gaps) && (data as any).gaps.length > 0) {
        return Response.json(data);
      }
      // If AI returned empty gaps or unexpected object, fall back to deterministic
      console.warn('AI returned empty or unexpected structure; using deterministic fallback.');
      return Response.json(getDeterministicFallback());
    } catch (aiErr) {
      console.warn('Groq analysis unavailable or failed, falling back to deterministic matching:', aiErr);
      return Response.json(getDeterministicFallback());
    }
  } catch (e) {
    return failure(e);
  }
}
