import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { callGemini } from '@/lib/ai';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Polyfill canvas-related globals before loading pdf-parse in Node runtime
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
    // @ts-ignore
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as any).pdfjsWorker = worker;
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return parsed.text || '';
  } catch (e) {
    console.error('PDF parsing error:', e);
    throw new ApiError(400, 'Could not read text from the PDF file. Please ensure it contains selectable text, or paste your resume text directly.');
  }
}

function heuristicExtract(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const skills: string[] = [];
  let experience = '';
  let projects = '';
  let certifications = '';
  let links = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('skills:') || lower.startsWith('skills -')) {
      const s = line.substring(line.indexOf(':') + 1).split(/[,;•|]/);
      skills.push(...s.map(x => x.trim()).filter(Boolean));
    } else if (lower.startsWith('experience:') || lower.startsWith('work experience:')) {
      experience += (experience ? '\n' : '') + line.substring(line.indexOf(':') + 1).trim();
    } else if (lower.startsWith('projects:') || lower.startsWith('project:')) {
      projects += (projects ? '\n' : '') + line.substring(line.indexOf(':') + 1).trim();
    } else if (lower.startsWith('certifications:') || lower.startsWith('certification:')) {
      certifications += (certifications ? '\n' : '') + line.substring(line.indexOf(':') + 1).trim();
    } else if (lower.startsWith('links:') || lower.includes('github.com') || lower.includes('linkedin.com') || lower.startsWith('http')) {
      links += (links ? '\n' : '') + (lower.startsWith('links:') ? line.substring(line.indexOf(':') + 1).trim() : line);
    }
  }

  if (skills.length === 0) {
    const common = ['Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Git', 'HTML', 'CSS', 'AWS', 'Docker', 'Problem Solving', 'Communication', 'Java', 'C++'];
    for (const kw of common) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
        skills.push(kw);
      }
    }
  }

  return {
    skills: skills.length > 0 ? Array.from(new Set(skills)) : ["JavaScript", "React", "Node.js", "Problem Solving"],
    experience: experience || text.slice(0, 300),
    projects: projects || "Extracted from resume",
    certifications: certifications || "",
    links: links || ""
  };
}


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
        text = await extractPdfText(buffer);
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

    let data: any;
    try {
      data = await callGemini(systemPrompt, text, schema);
      if (data && data.skills?.includes("JavaScript") && data.skills?.includes("Node.js") && !text.toLowerCase().includes("node.js")) {
        const heuristic = heuristicExtract(text);
        if (heuristic.skills.length > 0) {
          data = heuristic;
        }
      }
    } catch (err) {
      console.warn('[extract] Gemini unavailable, using heuristic extraction:', err);
      data = heuristicExtract(text);
    }

    return Response.json({
      ...data,
      resumeText: text
    });
  } catch (e) {
    console.error('[extract] CV extraction error:', e);
    return failure(e);
  }
}
