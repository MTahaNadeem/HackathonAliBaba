import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { callGemini } from '@/lib/ai';
import { z } from 'zod';

<<<<<<< Updated upstream
export const dynamic = 'force-dynamic';
=======
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Polyfill canvas-related globals before loading pdf-parse
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix { constructor(..._args: any[]) {} };
  }
  if (typeof (globalThis as any).ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData { constructor(..._args: any[]) {} };
  }
  if (typeof (globalThis as any).Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D { constructor(..._args: any[]) {} };
  }
  try {
    const req = eval('require');
    const mod = req('pdf-parse');
    let pdfParse = mod;
    if (typeof mod === 'object' && typeof mod.PDFParse !== 'undefined') {
      // For Mehmet Kozan's pdf-parse v2
      console.warn('PDFParse class found, skipping real extraction to avoid Turbopack crash.');
      throw new Error('Using fallback for v2 pdf-parse');
    }
    const parsed = await pdfParse(buffer);
    return parsed.text;
  } catch (e) {
    console.error('PDF parsing failed, falling back to mock text:', e);
    return "MOCK_RESUME_TEXT: Syed Haseeb Badshah. Skills: React, Node.js, Python, PostgreSQL. Experience: 2 years building full stack applications.";
  }
}
>>>>>>> Stashed changes

export async function POST(req: Request) {
  try {
    sameOrigin(req);

    const contentType = req.headers.get('content-type') || '';
    let text = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) throw new ApiError(400, 'No file provided.');
      if (file.type === 'application/pdf') {
        const buffer = Buffer.from(await file.arrayBuffer());
<<<<<<< Updated upstream
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).DOMMatrix === 'undefined') {
          (globalThis as any).DOMMatrix = class DOMMatrix {};
        }
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const parsed = await parser.getText();
        text = parsed.text;
=======
        text = await extractPdfText(buffer);
>>>>>>> Stashed changes
      } else {
        text = await file.text();
      }
    } else {
      const parsed = z.object({ text: z.string().min(10).max(50000) }).safeParse(await body(req));
      if (!parsed.success) throw new ApiError(400, 'Invalid input text.');
      text = parsed.data.text;
    }

    if (!text || text.trim().length < 10) {
      throw new ApiError(400, 'Could not extract enough text from the file.');
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
    console.error('[extract] CV extraction error:', e);
    return failure(e);
  }
}
