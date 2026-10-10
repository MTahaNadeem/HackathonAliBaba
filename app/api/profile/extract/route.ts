import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { callGemini } from '@/lib/ai';
import { z } from 'zod';
const pdfParse = require('pdf-parse');

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    
    // Check content type to see if it's multipart/form-data (PDF) or JSON (text paste)
    const contentType = req.headers.get('content-type') || '';
    let text = '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) throw new ApiError(400, 'No file provided.');
      if (file.type === 'application/pdf') {
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else {
        text = await file.text();
      }
    } else {
      const parsed = z.object({ text: z.string().min(10).max(50000) }).safeParse(await body(req));
      if (!parsed.success) throw new ApiError(400, 'Invalid input text.');
      text = parsed.data.text;
    }

    const systemPrompt = `You are a career profile extractor. Extract the following from the resume text:
- skills: array of strings (e.g. "React", "Python", "Communication"). Normalize to title case.
- experience: string describing work history, clearly separated by newlines.
- projects: string describing personal or academic projects.
- certifications: string listing certifications and courses.
- links: string of URLs (LinkedIn, GitHub, Portfolio).

Return ONLY JSON. Do not invent information. If a section is completely missing, return an empty string or empty array.`;

    const schema = {
      type: "object",
      properties: {
        skills: { type: "array", items: { type: "string" } },
        experience: { type: "string" },
        projects: { type: "string" },
        certifications: { type: "string" },
        links: { type: "string" }
      },
      required: ["skills", "experience", "projects", "certifications", "links"]
    };

    const data = await callGemini(systemPrompt, text, schema);
    
    return Response.json({
      ...data,
      resumeText: text
    });
  } catch (e) {
    return failure(e);
  }
}
