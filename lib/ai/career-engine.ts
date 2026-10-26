// Server-only. Career recommendation engine powered by Groq.
// No names, raw CVs, or personal contact details are sent to Groq.
import { z } from 'zod';
import { requestGroq, logFallback } from './groq-provider';

export interface CareerProfile {
  journey?: string;
  stage?: string;
  qualification?: string;
  subjects?: string[];
  interests?: string[];
  skills?: string[];
  extractedSkills?: string;
  experience?: string;
  projects?: string;
  certifications?: string;
  city?: string;
  hours?: number;
  career_goal?: string;
  specialization?: string;
  goal?: string;
}

export interface CareerRecommendation {
  id: string;
  title: string;
  field: string;
  matchScore: number; // 0-100
  description: string;
  whyItFits: string;
  strengths: string[];
  skillGaps: string[];
  nextSteps: string[];
  salaryRange?: string;
  growthOutlook?: string;
}

export interface CareerRecommendationsResult {
  recommendations: CareerRecommendation[];
  source: 'groq' | 'deterministic';
  fallbackUsed: boolean;
  profileSummary?: string;
}

const careerRecSchema = z.object({
  profileSummary: z.string().max(500),
  recommendations: z.array(z.object({
    id: z.string().min(1).max(80),
    title: z.string().min(1).max(120),
    field: z.string().min(1).max(80),
    matchScore: z.number().min(0).max(100),
    description: z.string().min(10).max(600),
    whyItFits: z.string().min(10).max(500),
    strengths: z.array(z.string().max(200)).min(1).max(5),
    skillGaps: z.array(z.string().max(200)).max(6),
    nextSteps: z.array(z.string().max(300)).min(1).max(4),
    salaryRange: z.string().max(100).optional(),
    growthOutlook: z.string().max(200).optional(),
  })).min(1).max(5),
});

const CAREER_PROMPT = `You are CourseCompass AI's career matching engine for Pakistani students and professionals.
Analyze the user's academic background, skills, interests, and experience to recommend exactly 5 personalized career paths.

CRITICAL RULES:
- Return ONLY valid JSON matching the exact schema below.
- matchScore must be 0-100 (genuine match based on profile, not flattery).
- Rank by matchScore descending (index 0 = best match).
- Each recommendation must have a unique id (slug: e.g. "software-engineer").
- skillGaps: skills the user lacks relative to this career (empty array if none significant).
- strengths: skills/traits the user already has that fit this career.
- nextSteps: 2-3 concrete, actionable steps to pursue this career.
- Focus on careers realistic and accessible from Pakistan (remote, local, and international).
- Do NOT mention the user's name or any personal contact information.
- salaryRange: approximate PKR/month range (e.g., "PKR 80,000 – 200,000/month") or USD for remote.
- growthOutlook: 1-sentence job market note for this role in Pakistan/globally.

JSON schema:
{
  "profileSummary": "...",
  "recommendations": [
    {
      "id": "...",
      "title": "...",
      "field": "...",
      "matchScore": 0-100,
      "description": "...",
      "whyItFits": "...",
      "strengths": ["..."],
      "skillGaps": ["..."],
      "nextSteps": ["..."],
      "salaryRange": "...",
      "growthOutlook": "..."
    }
  ]
}`;

const DETERMINISTIC_CAREERS: Omit<CareerRecommendation, 'matchScore' | 'whyItFits' | 'strengths' | 'skillGaps'>[] = [
  {
    id: 'software-developer',
    title: 'Software Developer',
    field: 'Technology',
    description: 'Build and maintain web, mobile, or desktop software. Spans front-end, back-end, and full-stack roles in startups and enterprises.',
    nextSteps: ['Build 2-3 portfolio projects on GitHub', 'Learn a modern framework (React/Node.js)', 'Apply to junior developer roles or internships'],
    salaryRange: 'PKR 80,000 – 300,000/month (or $15–$50/hr remote)',
    growthOutlook: 'High demand in Pakistan with strong remote freelance opportunities globally.',
  },
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    field: 'Data & Analytics',
    description: 'Transform raw data into actionable insights using SQL, Python, and BI tools. Works across industries including fintech, e-commerce, and healthcare.',
    nextSteps: ['Master SQL and Excel/Power BI', 'Complete a data analysis project with a public dataset', 'Build a portfolio dashboard and share on LinkedIn'],
    salaryRange: 'PKR 60,000 – 200,000/month',
    growthOutlook: 'Growing demand in Pakistan as businesses invest in data-driven decisions.',
  },
  {
    id: 'ui-ux-designer',
    title: 'UI/UX Designer',
    field: 'Design & Product',
    description: 'Design intuitive digital experiences through research, wireframing, and prototyping. Bridges user needs and technical constraints.',
    nextSteps: ['Learn Figma and build 3 case studies', 'Study Human-Computer Interaction principles', 'Contribute to open-source UI projects'],
    salaryRange: 'PKR 60,000 – 250,000/month',
    growthOutlook: 'Growing need for product designers in Pakistani tech startups.',
  },
  {
    id: 'digital-marketer',
    title: 'Digital Marketing Specialist',
    field: 'Marketing',
    description: 'Drive online growth through SEO, content, social media, and paid advertising. Combines creative and analytical thinking.',
    nextSteps: ['Earn Google Analytics and Meta Blueprint certifications', 'Run a small ad campaign with a real budget', 'Build a portfolio of campaign case studies'],
    salaryRange: 'PKR 50,000 – 180,000/month',
    growthOutlook: 'High demand as Pakistani businesses expand their digital presence.',
  },
  {
    id: 'cybersecurity-analyst',
    title: 'Cybersecurity Analyst',
    field: 'Technology',
    description: 'Protect systems and data from cyber threats through monitoring, vulnerability assessment, and incident response.',
    nextSteps: ['Study for CompTIA Security+ certification', 'Practice on TryHackMe or HackTheBox', 'Learn network fundamentals and Linux administration'],
    salaryRange: 'PKR 100,000 – 400,000/month',
    growthOutlook: 'Critical shortage of cybersecurity professionals in Pakistan and globally.',
  },
];

function buildCareerContext(profile: CareerProfile): object {
  const extractedSkills = (profile.extractedSkills || '')
    .split(/[,;\n]/)
    .map(s => s.trim())
    .filter(Boolean);

  return {
    journey: profile.journey || 'career',
    stage: profile.stage || 'unknown',
    qualification: profile.qualification || '',
    subjects: profile.subjects || [],
    interests: profile.interests || [],
    skills: profile.skills || [],
    extractedSkillsFromCV: extractedSkills.slice(0, 20),
    hasCV: extractedSkills.length > 0 || Boolean(profile.extractedSkills),
    experience: profile.experience
      ? profile.experience.slice(0, 300) + (profile.experience.length > 300 ? '...' : '')
      : '',
    projectsSummary: profile.projects
      ? profile.projects.slice(0, 200) + (profile.projects.length > 200 ? '...' : '')
      : '',
    certifications: profile.certifications || '',
    city: profile.city || '',
    targetHoursPerWeek: profile.hours || 10,
    careerGoalHint: profile.career_goal || '',
    specializationHint: profile.specialization || '',
    degreeGoal: profile.goal || '',
  };
}

function deterministicCareerRecs(profile: CareerProfile): CareerRecommendationsResult {
  const skills = profile.skills || [];
  const interests = profile.interests || [];

  const scored = DETERMINISTIC_CAREERS.map(c => {
    let score = 45;
    const isTech = ['software-developer', 'data-analyst', 'cybersecurity-analyst'].includes(c.id);
    const hasCode = skills.some(s => ['Python', 'SQL', 'Git', 'JavaScript', 'TypeScript'].includes(s));

    if (c.id === 'software-developer' && hasCode) score += 30;
    if (c.id === 'data-analyst' && skills.some(s => ['SQL', 'Statistics', 'Python', 'Data visualisation'].includes(s))) score += 30;
    if (c.id === 'ui-ux-designer' && (interests.includes('Design') || skills.some(s => s.includes('Visual design')))) score += 30;
    if (c.id === 'digital-marketer' && interests.some(i => ['Creativity', 'Storytelling', 'People'].includes(i))) score += 25;
    if (c.id === 'cybersecurity-analyst' && isTech && hasCode) score += 20;

    const strengths = skills.slice(0, 3);
    const skillGaps = c.id === 'software-developer'
      ? ['Portfolio projects', 'System design basics'].filter(g => !skills.includes(g))
      : c.id === 'data-analyst'
      ? ['SQL', 'Power BI / Tableau'].filter(g => !skills.some(s => s.toLowerCase().includes(g.toLowerCase())))
      : [];

    return {
      ...c,
      matchScore: Math.min(98, score),
      whyItFits: `Based on your background in ${profile.qualification || 'your studies'} and interests in ${interests.slice(0, 2).join(' & ') || 'technology'}, this role aligns well with your profile.`,
      strengths: strengths.length > 0 ? strengths : ['Analytical thinking', 'Communication'],
      skillGaps,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return {
    recommendations: scored.slice(0, 5),
    source: 'deterministic',
    fallbackUsed: true,
    profileSummary: 'Career recommendations based on your declared profile.',
  };
}

export async function generateCareerRecommendations(profile: CareerProfile): Promise<CareerRecommendationsResult> {
  const fallback = deterministicCareerRecs(profile);

  const context = buildCareerContext(profile);

  try {
    const raw = await requestGroq(CAREER_PROMPT, context);
    const parsed = careerRecSchema.parse(raw);

    const recs: CareerRecommendation[] = parsed.recommendations.map(r => ({
      id: r.id,
      title: r.title,
      field: r.field,
      matchScore: r.matchScore,
      description: r.description,
      whyItFits: r.whyItFits,
      strengths: r.strengths,
      skillGaps: r.skillGaps,
      nextSteps: r.nextSteps,
      salaryRange: r.salaryRange,
      growthOutlook: r.growthOutlook,
    }));

    return {
      recommendations: recs.sort((a, b) => b.matchScore - a.matchScore),
      source: 'groq',
      fallbackUsed: false,
      profileSummary: parsed.profileSummary,
    };
  } catch (error) {
    logFallback(error);
    return fallback;
  }
}
