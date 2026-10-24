import { body, failure, ApiError, sameOrigin } from '@/lib/server';
import { callGroq } from '@/lib/ai';
import { skillNames } from '@/lib/catalogue';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, kw: string): boolean {
  if (!kw || !kw.trim()) return false;
  const escaped = escapeRegex(kw.trim());
  const pattern = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
  return pattern.test(text);
}

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
    if (parsed.text && parsed.text.trim().length > 0) {
      return parsed.text;
    }
  } catch (e) {
    console.warn('PDFParse primary extraction notice:', e);
  }

  // Fallback: extract legible text sequences from binary buffer
  const rawAscii = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  const readableWords = rawAscii.match(/[a-zA-Z0-9+#'.-]{2,}/g);
  if (readableWords && readableWords.length > 25) {
    return readableWords.join(' ');
  }

  throw new ApiError(400, 'Could not read text from the PDF file. Please ensure it contains selectable text, or paste your resume text directly.');
}

function extractSections(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sections: Record<'experience' | 'projects' | 'certifications' | 'skills' | 'links', string[]> = {
    experience: [],
    projects: [],
    certifications: [],
    skills: [],
    links: [],
  };

  let currentSection: 'experience' | 'projects' | 'certifications' | 'skills' | 'other' = 'other';

  const headingPatterns = [
    { type: 'skills' as const, re: /^(?:technical\s+|core\s+)?skills(?:\s*[:&–-])?$/i },
    { type: 'experience' as const, re: /^(?:work\s+|professional\s+|employment\s+)?experience(?:\s*[:&–-])?$/i },
    { type: 'projects' as const, re: /^(?:key\s+|personal\s+|academic\s+)?projects(?:\s*[:&–-])?$/i },
    { type: 'certifications' as const, re: /^(?:certifications?|licenses?|courses?|awards?)(?:\s*[:&–-])?$/i },
    { type: 'other' as const, re: /^(?:education|summary|objective|about\s+me|profile|languages?)(?:\s*[:&–-])?$/i },
  ];

  for (const line of lines) {
    const matched = headingPatterns.find(h => h.re.test(line));
    if (matched) {
      currentSection = matched.type;
      continue;
    }

    const linkMatches = line.match(/https?:\/\/[^\s)]+|github\.com\/[^\s)]+|linkedin\.com\/in\/[^\s)]+/gi);
    if (linkMatches) {
      sections.links.push(...linkMatches);
    }

    if (currentSection !== 'other') {
      sections[currentSection].push(line);
    }
  }

  return sections;
}

function heuristicExtract(text: string) {
  const sections = extractSections(text);
  const extractedSkills = new Set<string>();

  // 1. From explicitly listed skills lines
  for (const line of sections.skills) {
    const parts = line.replace(/^(?:skills|technical skills|tools)[\s:–-]+/i, '').split(/[,;•|/·\t]/);
    for (const p of parts) {
      const clean = p.trim();
      if (clean.length >= 2 && clean.length <= 40 && !clean.includes('\n')) {
        extractedSkills.add(clean);
      }
    }
  }

  // 2. Scan text for catalogue skills and common tech & soft skills (safely escaped)
  const commonTech = [
    ...skillNames,
    'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Express',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Git', 'GitHub', 'HTML', 'CSS', 'Tailwind',
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Linux', 'Java', 'C++', 'C#',
    'REST APIs', 'GraphQL', 'Machine Learning', 'Data Analysis', 'Deep Learning',
    'Problem Solving', 'Communication', 'Teamwork', 'Agile', 'Scrum'
  ];

  for (const kw of commonTech) {
    if (matchesKeyword(text, kw)) {
      extractedSkills.add(kw);
    }
  }

  const skillsList = Array.from(extractedSkills);
  const experience = sections.experience.slice(0, 15).join('\n') || text.slice(0, 350);
  const projects = sections.projects.slice(0, 15).join('\n') || '';
  const certifications = sections.certifications.slice(0, 10).join('\n') || '';
  const links = Array.from(new Set(sections.links)).join('\n') || '';

  return {
    skills: skillsList.length > 0 ? skillsList : ['Problem Solving', 'Communication'],
    experience,
    projects: projects || 'Extracted from resume',
    certifications,
    links
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

      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
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
      data = await callGroq(systemPrompt, text, schema);
      if (data && data.skills?.includes("JavaScript") && data.skills?.includes("Node.js") && !text.toLowerCase().includes("node.js")) {
        const heuristic = heuristicExtract(text);
        if (heuristic.skills.length > 0) {
          data = heuristic;
        }
      }
    } catch (err) {
      console.warn('[extract] Groq unavailable, using heuristic extraction:', err);
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
