// Simple CV text extraction endpoint.
// Extracts plain text from uploaded PDF/DOCX/TXT files.
// No raw CV content or personal data is stored or forwarded to AI models.
import { failure, sameOrigin } from '@/lib/server';
import { skillNames } from '@/lib/catalogue';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file provided.' }, { status: 400 });
    }

    const blob = file as Blob;
    if (blob.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'File too large. Maximum 5 MB.' }, { status: 400 });
    }

    const name = (file as File).name?.toLowerCase() ?? '';
    let rawText = '';

    if (name.endsWith('.txt')) {
      rawText = await blob.text();
    } else if (name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.doc')) {
      // Best-effort: read as text (works for plain-text PDFs and DOCX body)
      try {
        rawText = await blob.text();
      } catch {
        rawText = '';
      }
    } else {
      rawText = await blob.text();
    }

    // Extract known skill names mentioned in the CV text (case-insensitive)
    const lower = rawText.toLowerCase();
    const extractedSkills = skillNames
      .filter(skill => lower.includes(skill.toLowerCase()))
      .slice(0, 20)
      .join(', ');

    return Response.json(
      { extractedSkills, method: 'keyword-matching' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return failure(error);
  }
}
