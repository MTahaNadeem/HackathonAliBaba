import {degrees,resources,skillNames,type University} from './catalogue';
export type Journey = 'student' | 'career';
export type Profile={name:string;stage:string;qualification:string;subjects:string[];interests:string[];skills:string[];city:string;budget:number|null;hours:number;ssc:number|null;hssc:number|null;equivalence:boolean;net:number|null;goal:string;relocate:boolean;experience?:string;projects?:string;certifications?:string;links?:string;resumeText?:string;extractedSkills?:string;journey?:Journey;student_knows_degree?:boolean;specialization?:string;career_goal?:string};
export type UserProfile = Profile;
export const emptyProfile:Profile={name:'',stage:'Choosing a degree',qualification:'FSc',subjects:[],interests:[],skills:[],city:'',budget:null,hours:5,ssc:null,hssc:null,equivalence:false,net:null,goal:'',relocate:false,experience:'',projects:'',certifications:'',links:'',resumeText:'',extractedSkills:'',journey:'student',student_knows_degree:undefined,specialization:'',career_goal:''};
export function recommend(p:Profile){return degrees.map(d=>{const interests=d.interests.filter(i=>p.interests.includes(i));const subjects=d.subjects.filter(i=>p.subjects.includes(i));return {...d,reasons:[...interests.map(i=>`You enjoy ${i.toLowerCase()}`),...subjects.map(i=>`Connects with ${i}`)],score:interests.length*2+subjects.length}}).sort((a,b)=>b.score-a.score)}

export interface DegreeRecommendation {
  degree: (typeof degrees)[number];
  score: number; // 0 - 100 normalized relevance estimate
  reasons: string[];
  isPreliminary: boolean;
}

/**
 * Deterministically ranks up to `limit` relevant degrees based on user's actual subjects and interests.
 * Normalizes relevance to 0–100 scale and provides factual, profile-based explanations.
 * Never returns unrelated degrees with zero match just to fill slots.
 */
export function rankTopDegrees(p: Profile, limit = 5): DegreeRecommendation[] {
  const userSubjects = Array.isArray(p.subjects) ? p.subjects : [];
  const userInterests = Array.isArray(p.interests) ? p.interests : [];
  const userSkills = Array.isArray(p.skills) ? p.skills : [];

  const hasInputs = userSubjects.length > 0 || userInterests.length > 0;

  if (!hasInputs) {
    return degrees.slice(0, Math.min(limit, degrees.length)).map(d => ({
      degree: d,
      score: 50,
      reasons: ['Preliminary recommendation. Add your high-school subjects and interests for personalized ranking.'],
      isPreliminary: true,
    }));
  }

  const scored = degrees
    .map(d => {
      const subjectMatches = d.subjects.filter(s =>
        userSubjects.some(us => us.toLowerCase() === s.toLowerCase())
      );
      const interestMatches = d.interests.filter(i =>
        userInterests.some(ui => ui.toLowerCase() === i.toLowerCase())
      );
      const skillMatches = d.skills.filter(sk =>
        userSkills.some(usk => usk.toLowerCase() === sk.toLowerCase())
      );

      const reasons: string[] = [];
      subjectMatches.forEach(s => reasons.push(`Directly connects with your ${s} background`));
      interestMatches.forEach(i => reasons.push(`Matches your interest in ${i.toLowerCase()}`));
      if (skillMatches.length > 0) {
        reasons.push(`Applies your ${skillMatches.slice(0, 2).join(' & ')} skills`);
      }

      const maxPossible = d.subjects.length * 3 + d.interests.length * 2;
      const rawScore = subjectMatches.length * 3 + interestMatches.length * 2 + Math.min(skillMatches.length, 2);

      const normalizedScore =
        rawScore > 0 ? Math.min(98, Math.max(30, Math.round((rawScore / maxPossible) * 100))) : 0;

      return {
        degree: d,
        score: normalizedScore,
        rawScore,
        reasons: reasons.slice(0, 3),
        isPreliminary: false,
      };
    })
    .filter(item => item.rawScore > 0)
    .sort((a, b) => b.score - a.score || b.rawScore - a.rawScore);

  return scored.slice(0, limit).map(({ degree, score, reasons, isPreliminary }) => ({
    degree,
    score,
    reasons,
    isPreliminary,
  }));
}

export interface RankedUniversity {
  university: University;
  assessment: ReturnType<typeof assessUniversity>;
  tuitionDisplay: ReturnType<typeof getFeeDisplay>;
  relevanceScore: number;
  fitPercentage: number;
  matchReasons: string[];
}

/**
 * Calculates a 0–100% preference fit percentage for a university based on
 * academic eligibility criteria, city location preference, and semester budget.
 */
export function calculateUniversityFit(u: University, p: Profile): { fitPercentage: number; matchReasons: string[] } {
  const assessment = assessUniversity(u, p);
  const matchReasons: string[] = [];

  let academicScore = 20;
  if (assessment.status === 'Academic minimum met') {
    academicScore = 40;
    matchReasons.push('Meets published academic criteria');
  } else if (assessment.status === 'Subject route needs review') {
    academicScore = 25;
    matchReasons.push('Subject route requires departmental check');
  } else if (assessment.status === 'Check current admissions') {
    academicScore = 20;
    matchReasons.push('Admission criteria pending confirmation');
  } else if (assessment.status === 'Below published minimum') {
    academicScore = 5;
  }

  let locationScore = 15;
  const userCity = p.city?.trim().toLowerCase();
  if (userCity && u.city.toLowerCase() === userCity) {
    locationScore = 30;
    matchReasons.push(`Located in ${u.city}`);
  } else if (p.relocate) {
    locationScore = 22;
    matchReasons.push('Open to relocation');
  } else if (!userCity) {
    locationScore = 20;
  } else {
    locationScore = 10;
  }

  let budgetScore = 15;
  if (assessment.budget === 'Within semester budget') {
    budgetScore = 30;
    matchReasons.push('Tuition fits your semester budget');
  } else if (assessment.budget === 'Add your budget') {
    budgetScore = 18;
  } else if (assessment.budget === 'Costs need checking') {
    budgetScore = 18;
  } else if (assessment.budget === 'Above semester budget') {
    budgetScore = 8;
  }

  let raw = academicScore + locationScore + budgetScore;

  if (p.goal && u.degreeId) {
    if (u.degreeId === p.goal) {
      matchReasons.unshift('Matches your chosen degree');
    } else {
      raw -= 12;
    }
  }

  const fitPercentage = Math.min(98, Math.max(30, raw));

  return { fitPercentage, matchReasons };
}

/**
 * Filters universities strictly to those that offer targetDegreeId,
 * evaluates eligibility and costs via assessUniversity(), and ranks qualifying institutions.
 */
export function rankTopUniversities(
  source: University[],
  p: Profile,
  targetDegreeId?: string,
  limit = 5
): RankedUniversity[] {
  const goalId = targetDegreeId || p.goal;
  if (!goalId) return [];

  // Strictly filter to universities offering this exact degree
  const offerings = source.filter(u => u.degreeId === goalId);
  if (offerings.length === 0) return [];

  const ranked = offerings.map(u => {
    const assessment = assessUniversity(u, p);
    const tuitionDisplay = getFeeDisplay(u);
    const fit = calculateUniversityFit(u, p);
    const matchReasons: string[] = [];

    let score = 50;

    // Academic eligibility
    if (assessment.status === 'Academic minimum met') {
      score += 30;
      matchReasons.push('Meets published academic minimum');
    } else if (assessment.status === 'Subject route needs review') {
      score += 15;
      matchReasons.push('Subject combination needs departmental check');
    } else if (assessment.status === 'Check current admissions') {
      score += 10;
      matchReasons.push('Current admission rules need portal check');
    } else if (assessment.status === 'Below published minimum') {
      score -= 20;
    }

    // City preference
    const userCity = p.city?.trim();
    if (userCity && u.city.toLowerCase() === userCity.toLowerCase()) {
      score += 15;
      matchReasons.push(`Located in your preferred city (${u.city})`);
    } else if (p.relocate) {
      score += 5;
    }

    // Budget fit
    if (assessment.budget === 'Within semester budget') {
      score += 15;
      matchReasons.push('Verified tuition fits within semester budget');
    } else if (assessment.budget === 'Add your budget') {
      matchReasons.push('Add budget to evaluate semester cost fit');
    } else if (assessment.budget === 'Costs need checking') {
      matchReasons.push('Official fee confirmation needed from university');
    }

    return {
      university: u,
      assessment,
      tuitionDisplay,
      relevanceScore: score,
      fitPercentage: fit.fitPercentage,
      matchReasons: matchReasons.slice(0, 3),
    };
  });

  ranked.sort((a, b) => b.relevanceScore - a.relevanceScore || b.fitPercentage - a.fitPercentage);
  return ranked.slice(0, limit);
}

/**
 * Checks whether a user profile has the minimum required preferences filled
 * to enable meaningful site-wide personalization:
 * 1. qualification: non-empty string
 * 2. goal: non-empty string representing a recognized degree id
 * 3. city: non-empty string
 * 4. budget: positive number
 */
export function isProfileComplete(p: Profile | null | undefined): boolean {
  if (!p) return false;
  const isGraduate = p.stage === 'Graduate / job seeker' || p.journey === 'career';
  if (isGraduate) {
    const hasQualification = Boolean(p.qualification && p.qualification.trim().length > 0);
    const hasCity = Boolean(p.city && p.city.trim().length > 0);
    const hasSkillsOrCv = Boolean(
      (Array.isArray(p.skills) && p.skills.length > 0) ||
      (p.resumeText && p.resumeText.trim().length > 0) ||
      (p.extractedSkills && p.extractedSkills.trim().length > 0)
    );
    return Boolean(hasQualification && hasCity && hasSkillsOrCv);
  }
  const hasQualification = Boolean(p.qualification && p.qualification.trim().length > 0);
  const hasGoalOrModelRecommendation = Boolean(
    (p.goal && p.goal.trim().length > 0 && degrees.some(d => d.id === p.goal)) ||
    p.student_knows_degree === false ||
    (Array.isArray(p.interests) && p.interests.length > 0) ||
    (Array.isArray(p.subjects) && p.subjects.length > 0)
  );
  const hasCity = Boolean(p.city && p.city.trim().length > 0);
  const hasBudget = typeof p.budget === 'number' && !isNaN(p.budget) && p.budget > 0;
  return Boolean(hasQualification && hasGoalOrModelRecommendation && hasCity && hasBudget);
}

export function getProfileDirection(p: Profile | null | undefined) {
  if (!p?.goal) return null;
  const d = degrees.find(deg => deg.id === p.goal);
  if (!d) return null;
  return { id: d.id, name: d.name, field: d.field };
}
/** Safe currency / amount formatter for PKR. Returns null if invalid or not a number. */
export function formatPKR(amount: number | null | undefined): string | null {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) return null;
  return `PKR ${amount.toLocaleString()}`;
}

/**
 * Returns human-readable fee text based on fee, mandatory charges, and verification status.
 * Strictly adheres to truthfulness:
 * - If status is 'needs_information': 'Not published online'
 * - If status is 'stale' or fee is not a valid number: 'Not verified'
 * - If verified with a valid fee: 'PKR <fee>'
 */
export function getFeeDisplay(u: University): {
  tuition: string;
  mandatory: string;
  isVerified: boolean;
  isFeeVerified: boolean;
} {
  const isStatusVerified =
    !u.verificationStatus ||
    u.verificationStatus === 'live_refreshed' ||
    u.verificationStatus === 'manual_snapshot' ||
    u.verificationStatus === 'source_backed';

  const hasValidFee = typeof u.fee === 'number' && !isNaN(u.fee) && isFinite(u.fee);
  const isFeeVerified = isStatusVerified && hasValidFee;

  let tuition: string;
  if (isFeeVerified) {
    tuition = `PKR ${u.fee!.toLocaleString()}`;
  } else if (u.verificationStatus === 'needs_information') {
    tuition = 'Not published online';
  } else {
    tuition = 'Not verified';
  }

  let mandatory: string;
  if (isFeeVerified) {
    if (typeof u.mandatory === 'number' && !isNaN(u.mandatory) && u.mandatory > 0) {
      mandatory = `+ PKR ${u.mandatory.toLocaleString()} mandatory charges`;
    } else {
      mandatory = 'Semester tuition';
    }
  } else {
    mandatory = u.notes ? 'Official inquiry / portal required' : 'Check the current fee schedule';
  }

  return { tuition, mandatory, isFeeVerified, isVerified: isFeeVerified };
}

export function assessUniversity(u: University, p: Profile) {
  // stale and needs_information records must NEVER silently pass as verified costs.
  const costVerified =
    !u.verificationStatus ||
    u.verificationStatus === 'source_backed' ||
    u.verificationStatus === 'live_refreshed' ||
    u.verificationStatus === 'manual_snapshot';

  const hasValidFee = typeof u.fee === 'number' && !isNaN(u.fee) && isFinite(u.fee);
  const mandatoryCharge = typeof u.mandatory === 'number' && !isNaN(u.mandatory) && isFinite(u.mandatory) ? u.mandatory : 0;
  const cost = costVerified && hasValidFee ? u.fee! + mandatoryCharge : null;
  const hasValidBudget = typeof p.budget === 'number' && !isNaN(p.budget) && isFinite(p.budget);
  const budget =
    cost === null
      ? 'Costs need checking'
      : !hasValidBudget
      ? 'Add your budget'
      : cost <= p.budget!
      ? 'Within semester budget'
      : 'Above semester budget';
  const base = { budget, cost, aggregate: null as number | null };
  if (p.qualification === 'Matric' || p.qualification === 'O-levels') return { ...base, status: 'Next qualification needed', detail: 'Explore higher-secondary/A-level pathways before assessing undergraduate admission.' };
  if (u.rule === 'unknown') return { ...base, status: 'Check current admissions', detail: 'Current programme-specific rules are not verified in this catalogue. Use the official admissions page.' };
  if (['A-levels', 'Other equivalent'].includes(p.qualification) && !p.equivalence) return { ...base, status: 'Equivalence needed', detail: 'Add your official IBCC SSC and HSSC equivalence percentages. Raw grades are not converted here.' };
  if (p.ssc === null || p.hssc === null || typeof p.ssc !== 'number' || typeof p.hssc !== 'number') return { ...base, status: 'Add academic results', detail: 'Both SSC and HSSC/equivalent percentages are needed for the published minimum check.' };
  if (p.ssc < 60 || p.hssc < 60) return { ...base, status: 'Below published minimum', detail: 'NUST lists a minimum of 60% in each of SSC and HSSC/equivalent. Check the official page for your route.' };
  if (u.rule === 'nust-engineering') return { ...base, status: 'Subject route needs review', detail: 'Check science group, subject combination and any remedial requirements against the official engineering criteria. Marks alone do not establish eligibility.' };
  if (p.net === null || typeof p.net !== 'number') return { ...base, status: 'Academic minimum met', detail: 'Add a NET percentage to estimate the standard completed-qualification aggregate. Test route and other admission requirements still apply.' };
  return { ...base, status: 'Academic minimum met', aggregate: Math.round((p.ssc * 0.1 + p.hssc * 0.15 + p.net * 0.75) * 100) / 100, detail: 'Standard NET route, completed SSC/HSSC or equivalence: 10% SSC + 15% HSSC + 75% NET. Not an admission offer or closing-merit prediction.' };
}
const aliases:Record<string,string[]>={'Spreadsheets':['excel','spreadsheets','spreadsheet'],'Drawing interpretation':['drawing interpretation','technical drawings','engineering drawings'],'Quantity estimation':['quantity estimation','quantity surveying','bill of quantities','boq'],'Technical writing':['technical writing','report writing','site reports'],'Data visualisation':['data visualisation','data visualization'],'Communication':['communication','presentation skills'],'Research':['research'],'Visual design':['visual design','graphic design'],'Typography':['typography'],'Statistics':['statistics','statistical analysis'],'Project planning':['project planning','project management'],'Editing':['editing','proofreading'],'Python':['python'],'SQL':['sql'],'Git':['git','version control']};
function escape(s:string){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
export type Gap={skill:string;status:'Self-reported'|'Not yet demonstrated';evidence:string;optional:boolean};
export function analyseJob(text:string,skills:string[]):{gaps:Gap[];formal:string[];method:string}{
 const lines=text.split(/(?<=[.!?])\s+|\n|;/).map(s=>s.trim()).filter(Boolean);
 const gaps:Gap[]=[];
 for(const skill of skillNames){for(const sentence of lines){const re=new RegExp(`\\b(?:${(aliases[skill]||[skill]).map(escape).join('|')})\\b`,'i');const match=re.exec(sentence);if(!match)continue;const before=sentence.slice(Math.max(0,match.index-35),match.index);const after=sentence.slice(match.index+match[0].length,match.index+match[0].length+40);if(/(?:no|without|not requiring)\s+(?:prior\s+)?$/i.test(before)||/^\s*(?:experience\s+)?(?:is\s+)?(?:not required|isn't required|unnecessary)/i.test(after))continue;gaps.push({skill,status:skills.some(s=>s.toLowerCase()===skill.toLowerCase())?'Self-reported':'Not yet demonstrated',evidence:sentence.slice(0,400),optional:/preferred|optional|nice.to.have/i.test(sentence)});break}}
 return {gaps,formal:lines.filter(s=>/\b(degree|enrol|enroll|licen[cs]e|portfolio|years? of experience|induction|supervision)\b/i.test(s)).slice(0,8),method:'Keyword-assisted analysis. Review the original wording; nuanced requirements may need correction.'};
}
export type MilestoneState = 'Not started' | 'Learning' | 'Practiced' | 'Demonstrated';
export type Milestone={id:string;skill:string;title:string;startLearning?:{title:string;url:string;provider:string;level:string;cost:string}|null;structuredLearning?:{title:string;url:string;provider:string;level:string;cost:string}|null;practice:string;proveSkill?:string;state?:MilestoneState;notes?:string;evidenceUrl?:string;resourceId?:string|null;hours?:number;done?:boolean};
export type InterviewPrep = {technical:{question:string;hint:string;answer:string}[];behavioral:{question:string;hint:string;answer:string}[];resumeChecklist:string[];applicationChecklist:string[]};

export type LessonResourceType = 'video' | 'course' | 'documentation' | 'article' | 'exercise';

export interface LessonResource {
  title: string;
  provider: string;
  url: string;
  resourceType: LessonResourceType;
  verified?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  learningObjective: string;
  estimatedDuration: string;
  resources: LessonResource[];
  practiceTask?: string;
  done?: boolean;
  notes?: string;
}

export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  learningObjectives: string[];
  estimatedDuration: string;
  prerequisites: string[];
  lessons: Lesson[];
}

export interface LearningAssessment {
  whatYouWillLearn: string;
  whyIncluded: string;
  expectedSequence: string;
  estimatedTotalDuration: string;
  majorMilestones: string[];
  targetOutcome?: string;
  existingKnowledgeAssessed?: string;
  skillGapsIdentified?: string[];
  providerNotice?: string;
}

export type Plan={
  id:string;
  title:string;
  goal:string;
  createdAt:string;
  hoursPerWeek?:number;
  milestones:Milestone[];
  interviewPrep?:InterviewPrep;
  description?:string;
  goalType?:'degree'|'career'|'specialization'|'skill';
  subject?:string;
  targetOutcome?:string;
  estimatedDuration?:string;
  assessment?:LearningAssessment;
  modules?:CurriculumModule[];
  source?:'groq'|'qwen'|'deterministic';
  fallbackUsed?:boolean;
};


export function getSkillResources(skill: string): {
  startLearning: { title: string; url: string; provider: string; level: string; cost: string };
  structuredLearning: { title: string; url: string; provider: string; level: string; cost: string };
  practice: string;
  proveSkill: string;
} {
  const s = skill.trim();
  const lower = s.toLowerCase();
  
  if (lower.includes('react')) {
    return {
      startLearning: { title: 'React 19 / 18 Crash Course for Beginners', url: 'https://www.youtube.com/watch?v=w7ejDZ8SWv8', provider: 'Traversy Media · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'React Official Documentation & Interactive Guide', url: 'https://react.dev/learn', provider: 'React Team', level: 'Beginner to Intermediate', cost: 'Free' },
      practice: 'Build a modular dashboard application with reusable components, state hooks (useState, useEffect), and form validation.',
      proveSkill: 'Develop a responsive web app with client-side routing, theme toggling, and asynchronous API integration; deploy to Vercel.'
    };
  }
  if (lower.includes('typescript')) {
    return {
      startLearning: { title: 'TypeScript Full Course for Beginners', url: 'https://www.youtube.com/watch?v=BwuLxPH8IDs', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'The TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html', provider: 'Microsoft', level: 'Intermediate', cost: 'Free' },
      practice: 'Convert an existing JavaScript project to strict TypeScript, defining interfaces, union types, and generic utilities.',
      proveSkill: 'Build a type-safe REST API client library or utility package with comprehensive unit tests.'
    };
  }
  if (lower.includes('javascript') || lower === 'js') {
    return {
      startLearning: { title: 'JavaScript Tutorial for Beginners - Full Course', url: 'https://www.youtube.com/watch?v=W6NZfCO5SIk', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'JavaScript Algorithms and Data Structures', url: 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/', provider: 'freeCodeCamp', level: 'All levels', cost: 'Free' },
      practice: 'Implement interactive DOM operations, event handling, and asynchronous API calls using modern async/await syntax.',
      proveSkill: 'Construct a browser-based application (e.g. kanban board or expense tracker) with persistent local storage.'
    };
  }
  if (lower.includes('node') || lower.includes('express')) {
    return {
      startLearning: { title: 'Node.js and Express.js Full Course', url: 'https://www.youtube.com/watch?v=Oe421EPjeBE', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Back End Development and APIs Certification', url: 'https://www.freecodecamp.org/learn/back-end-development-and-apis/', provider: 'freeCodeCamp', level: 'Intermediate', cost: 'Free' },
      practice: 'Create a RESTful API server with Express, robust error middleware, request validation, and database operations.',
      proveSkill: 'Build a production-ready API service featuring JWT authentication, rate limiting, and automated endpoint tests.'
    };
  }
  if (lower.includes('next')) {
    return {
      startLearning: { title: 'Next.js App Router Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=ZVnjOPwW444', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Next.js Interactive Foundation Course', url: 'https://nextjs.org/learn', provider: 'Vercel', level: 'Beginner to Intermediate', cost: 'Free' },
      practice: 'Build a fast server-rendered web app utilizing Server Components, Server Actions, and dynamic layout routes.',
      proveSkill: 'Deploy a full-stack Next.js production portal with dynamic SEO tags, caching strategies, and database connection.'
    };
  }
  if (lower.includes('python')) {
    return {
      startLearning: { title: 'Python for Beginners - Full Course', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Scientific Computing with Python Certification', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', provider: 'freeCodeCamp', level: 'All levels', cost: 'Free' },
      practice: 'Write modular Python scripts to parse structured data files, clean datasets, and handle runtime exceptions.',
      proveSkill: 'Build an automated end-to-end data extraction and analysis pipeline with exported summary visualizations.'
    };
  }
  if (lower.includes('sql') || lower.includes('postgres') || lower.includes('mysql')) {
    return {
      startLearning: { title: 'SQL Tutorial - Full Database Course for Beginners', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Interactive SQL Lessons and Challenges', url: 'https://sqlbolt.com/', provider: 'SQLBolt', level: 'Beginner', cost: 'Free' },
      practice: 'Write complex multi-table queries utilizing INNER/LEFT JOINs, subqueries, GROUP BY aggregations, and window functions.',
      proveSkill: 'Design an optimal third-normal-form relational schema with proper foreign keys, constraints, and query indexes.'
    };
  }
  if (lower.includes('git')) {
    return {
      startLearning: { title: 'Git and GitHub for Beginners - Crash Course', url: 'https://www.youtube.com/watch?v=RGOj5yH7evk', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Pro Git Book (Complete Reference)', url: 'https://git-scm.com/book/en/v2', provider: 'Git-SCM', level: 'Intermediate', cost: 'Free' },
      practice: 'Practice branching, staging, atomic commits, interactive rebasing, and resolving tricky merge conflicts.',
      proveSkill: 'Set up an open-source GitHub repository with issue templates, branch protection rules, and CI validation.'
    };
  }
  if (lower.includes('docker')) {
    return {
      startLearning: { title: 'Docker Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo', provider: 'TechWorld with Nana · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Docker Official Getting Started Guide', url: 'https://docs.docker.com/get-started/', provider: 'Docker', level: 'Beginner', cost: 'Free' },
      practice: 'Write an optimized multi-stage Dockerfile for a web application and manage local containers and volumes.',
      proveSkill: 'Create a docker-compose.yml setup orchestrating frontend, backend API, and database services with networking.'
    };
  }
  if (lower.includes('kubernetes') || lower === 'k8s') {
    return {
      startLearning: { title: 'Kubernetes Crash Course for Beginners', url: 'https://www.youtube.com/watch?v=X48VuDVv0do', provider: 'TechWorld with Nana · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Kubernetes Official Tutorials', url: 'https://kubernetes.io/docs/tutorials/', provider: 'CNCF', level: 'Intermediate', cost: 'Free' },
      practice: 'Deploy application Pods, Services, and Deployments to a local Minikube or kind cluster.',
      proveSkill: 'Set up Ingress routing, ConfigMaps, and PersistentVolumeClaims for a production-like microservice deployment.'
    };
  }
  if (lower.includes('aws') || lower.includes('cloud')) {
    return {
      startLearning: { title: 'AWS Certified Cloud Practitioner Training', url: 'https://www.youtube.com/watch?v=SOTamWNgDKc', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'AWS Skill Builder Free Learning Path', url: 'https://explore.skillbuilder.aws/', provider: 'Amazon Web Services', level: 'Beginner to Intermediate', cost: 'Free' },
      practice: 'Deploy a static frontend on AWS S3 with CloudFront and configure IAM policies and roles with least privilege.',
      proveSkill: 'Build a serverless REST API using AWS Lambda, API Gateway, and DynamoDB.'
    };
  }
  if (lower.includes('tailwind')) {
    return {
      startLearning: { title: 'Tailwind CSS Full Course for Beginners', url: 'https://www.youtube.com/watch?v=lCxcTsOHrjo', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Tailwind CSS Documentation & Utility Reference', url: 'https://tailwindcss.com/docs', provider: 'Tailwind Labs', level: 'Beginner', cost: 'Free' },
      practice: 'Recreate a modern landing page hero and features section using utility classes, grid, and responsive breakpoints.',
      proveSkill: 'Build a fully responsive, accessible component library with dark mode support using Tailwind CSS.'
    };
  }
  if (lower.includes('machine learning') || lower.includes('deep learning') || lower.includes('ai')) {
    return {
      startLearning: { title: 'Machine Learning for Everybody - Full Course', url: 'https://www.youtube.com/watch?v=i_LwzRVP7bg', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Machine Learning Specialization', url: 'https://www.coursera.org/specializations/machine-learning-introduction', provider: 'Coursera · Andrew Ng', level: 'Beginner to Intermediate', cost: 'Free audit' },
      practice: 'Train and evaluate supervised classification and regression models using scikit-learn on a benchmark dataset.',
      proveSkill: 'Deliver a machine learning project notebook with data cleaning, feature engineering, cross-validation, and metrics.'
    };
  }
  if (lower === 'r' || lower.includes('r programming') || lower.includes('r language')) {
    return {
      startLearning: { title: 'R Programming Tutorial - Learn the Basics', url: 'https://www.youtube.com/watch?v=_V8eKsto3Ug', provider: 'freeCodeCamp · YouTube', level: 'Beginner', cost: 'Free' },
      structuredLearning: { title: 'Introduction to R for Data Science', url: 'https://www.edx.org/learn/r-programming', provider: 'edX', level: 'Beginner', cost: 'Free audit' },
      practice: 'Load tabular data into R data frames, compute summary statistics, and generate publication-quality ggplot2 charts.',
      proveSkill: 'Conduct an exploratory data analysis project with statistical hypothesis testing and reproducible RMarkdown report.'
    };
  }

  // Smart fallback for any other skill
  const matchedResource = resources.find(r => r.skills.some(sk => sk.toLowerCase() === lower));
  return {
    startLearning: {
      title: `${s} Crash Course & Core Concepts`,
      url: matchedResource?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(s + ' tutorial for beginners')}`,
      provider: matchedResource?.provider || 'Developer Education · YouTube',
      level: 'Beginner',
      cost: 'Free'
    },
    structuredLearning: {
      title: `${s} Documentation & Interactive Learning`,
      url: matchedResource?.url || `https://www.google.com/search?q=${encodeURIComponent(s + ' official documentation tutorial')}`,
      provider: matchedResource?.provider || 'Official Documentation & Guides',
      level: 'Intermediate',
      cost: 'Free'
    },
    practice: matchedResource?.practice || `Complete foundational exercises to understand the core concepts, syntax, and workflow of ${s}.`,
    proveSkill: `Build a small real-world project or module demonstrating hands-on competence in ${s}.`
  };
}

export function getInterviewPrepForGoal(goal: string, skills: string[]): InterviewPrep {
  const topSkills = skills.slice(0, 3).join(' and ') || 'the required technologies';
  const role = goal.replace(/^Job Application \(from Compass\)$/i, 'Software Engineering Role').replace(/^Target Job Role$/i, 'Professional Technical Role');
  return {
    technical: [
      {
        question: `How do you explain the core concepts and best practices when working with ${skills[0] || 'your primary stack'}?`,
        hint: `Discuss fundamentals, common pitfalls, performance considerations, and how you structure code maintainably.`,
        answer: `Provide a clear high-level definition, explain typical architectural patterns, describe error handling, and illustrate with an experience where you applied it effectively.`
      },
      {
        question: `Can you walk through a time you had to debug a difficult issue involving ${skills[1] || 'system integration'}?`,
        hint: `Outline your systematic troubleshooting steps: reproducing the bug, inspecting logs/network, isolating root causes, and writing regression tests.`,
        answer: `Structure the response using STAR: describe the symptoms, how you verified assumptions, identified the exact failure point, and shipped a verified fix.`
      },
      {
        question: `How do you ensure scalability, code quality, and security when building features for ${role}?`,
        hint: `Mention testing methodologies, code reviews, clean separation of concerns, and security considerations (input validation, auth, secrets).`,
        answer: `Explain that scalability starts with simple, modular design, automated unit/integration tests, defensive programming, and continuous monitoring.`
      }
    ],
    behavioral: [
      {
        question: `Describe a situation where you had to quickly learn a new technology or skill (like ${skills[0] || 'a new framework'}) under a tight deadline.`,
        hint: `Focus on your learning strategy: documentation, building minimal prototypes, seeking feedback, and delivering on time.`,
        answer: `Highlight your initiative, resourcefulness, structured approach to breaking down the topic, and delivering a functional solution on schedule.`
      },
      {
        question: `Tell me about a time you disagreed with a teammate or technical decision. How did you handle it?`,
        hint: `Demonstrate empathy, evidence-based reasoning, focus on project goals rather than ego, and commitment to the team once a decision was made.`,
        answer: `Frame it around listening first, discussing tradeoffs objectively with data/benchmarks, and maintaining strong collaborative alignment.`
      },
      {
        question: `What excites you most about this role and how does your skill journey prepare you for it?`,
        hint: `Connect your target learning roadmap directly to the company's domain and mission.`,
        answer: `Express genuine curiosity for the problem space, mention the specific skills you have strengthened, and show eagerness to create immediate impact.`
      }
    ],
    resumeChecklist: [
      `Feature ${topSkills} prominently in your technical skills and project descriptions.`,
      `Quantify accomplishments with metrics (e.g., 'reduced load time by 30%', 'automated workflow saving 5 hrs/week').`,
      `Include live demo links and clean GitHub repositories with comprehensive README files.`,
      `Tailor your professional summary to reflect the specific requirements of ${role}.`
    ],
    applicationChecklist: [
      `Review company engineering blogs, open source repos, and recent product launches before applying.`,
      `Customise your cover letter or introductory note highlighting how your recent skills align with their open role.`,
      `Prepare a 2-minute elevator pitch summarizing your background, key strengths, and learning trajectory.`,
      `Follow up politely with the hiring manager or technical recruiter on LinkedIn within 5–7 days.`
    ]
  };
}

export function createPlan(goal:string,skills:string[],hours:number):Plan{
  const wanted=Array.from(new Set(skills)).slice(0,8);
  const cleanGoal = goal?.trim() || 'Software Developer';
  return {
    id:crypto.randomUUID(),
    title:`Your path to ${cleanGoal}`,
    goal: cleanGoal,
    hoursPerWeek:Math.max(1,Math.min(30,hours)),
    createdAt:new Date().toISOString(),
    milestones:wanted.map((skill,i)=>{
      const r=resources.find(r=>r.skills.includes(skill));
      const enriched = getSkillResources(skill);
      return {
        id:`step-${i}`,
        skill,
        title:`Master ${skill}`,
        startLearning: enriched.startLearning,
        structuredLearning: enriched.structuredLearning,
        practice: enriched.practice,
        proveSkill: enriched.proveSkill,
        state:'Not started' as MilestoneState,
        notes:'',
        evidenceUrl:'',
        resourceId:r?.id||null,
        hours:4,
        done:false
      };
    }),
    interviewPrep: getInterviewPrepForGoal(cleanGoal, wanted)
  };
}
export function exportPlan(p: Plan): string {
  if (p.modules && p.modules.length > 0) {
    let md = `# ${p.title}\n\n`;
    if (p.description) md += `${p.description}\n\n`;
    if (p.assessment) {
      md += `## Learning Assessment Overview\n\n`;
      md += `- **What you will learn**: ${p.assessment.whatYouWillLearn}\n`;
      md += `- **Why included**: ${p.assessment.whyIncluded}\n`;
      md += `- **Expected sequence**: ${p.assessment.expectedSequence}\n`;
      md += `- **Estimated total duration**: ${p.assessment.estimatedTotalDuration}\n`;
      if (p.assessment.majorMilestones?.length) {
        md += `- **Major milestones**:\n`;
        p.assessment.majorMilestones.forEach(m => { md += `  - ${m}\n`; });
      }
      md += `\n`;
    }
    p.modules.forEach((mod, mi) => {
      md += `## Module ${mi + 1}: ${mod.title} (${mod.estimatedDuration})\n`;
      md += `${mod.description}\n\n`;
      if (mod.learningObjectives?.length) {
        md += `**Learning Objectives:**\n`;
        mod.learningObjectives.forEach(obj => { md += `- ${obj}\n`; });
        md += `\n`;
      }
      md += `### Lessons\n\n`;
      mod.lessons.forEach((les, li) => {
        md += `#### ${mi + 1}.${li + 1} ${les.title} [${les.done ? 'COMPLETED' : 'INCOMPLETE'}]\n`;
        md += `- **Duration**: ${les.estimatedDuration}\n`;
        md += `- **Objective**: ${les.learningObjective}\n`;
        if (les.resources?.length) {
          md += `- **Resources**:\n`;
          les.resources.forEach(r => {
            md += `  - [${r.title}](${r.url}) (${r.provider} · ${r.resourceType}${r.verified ? ' · Verified' : ''})\n`;
          });
        }
        if (les.practiceTask) {
          md += `- **Practice Task**: ${les.practiceTask}\n`;
        }
        if (les.notes) {
          md += `- **Notes**: ${les.notes}\n`;
        }
        md += `\n`;
      });
    });
    return md;
  }
  return `# ${p.title}\n\n` + p.milestones.map((m, i) => {
    return `## ${i + 1}. ${m.title}\n- Status: ${m.state || (m.done ? 'Demonstrated' : 'Not started')}\n`;
  }).join('\n');
}

export function synthesizeCurriculumIfMissing(p: Plan): Plan {
  if (p.modules && p.modules.length > 0 && p.assessment) {
    return p;
  }

  const milestones = p.milestones || [];
  const lessons: Lesson[] = milestones.map((m, idx) => {
    const resList: LessonResource[] = [];
    if (m.startLearning) {
      resList.push({
        title: m.startLearning.title,
        provider: m.startLearning.provider,
        url: m.startLearning.url,
        resourceType: m.startLearning.url.includes('youtube') ? 'video' : 'course',
        verified: true
      });
    }
    if (m.structuredLearning) {
      resList.push({
        title: m.structuredLearning.title,
        provider: m.structuredLearning.provider,
        url: m.structuredLearning.url,
        resourceType: 'documentation',
        verified: true
      });
    }
    return {
      id: `syn-les-${m.id || idx}`,
      title: m.title || `Master ${m.skill}`,
      description: `Targeted conceptual and practical mastery for ${m.skill}.`,
      learningObjective: `Demonstrate practical capability in ${m.skill} through hands-on practice.`,
      estimatedDuration: `${m.hours || 4} hours`,
      resources: resList,
      practiceTask: m.practice || 'Complete practical project and document evidence.',
      done: m.state === 'Demonstrated' || Boolean(m.done),
      notes: m.notes || ''
    };
  });

  const modules: CurriculumModule[] = [];
  if (lessons.length <= 3) {
    modules.push({
      id: 'mod-1',
      title: 'Module 1: Foundations & Core Practice',
      description: `Core concepts and practical competencies for ${p.goal}.`,
      learningObjectives: ['Establish fundamental knowledge', 'Complete guided exercises'],
      estimatedDuration: '4 weeks',
      prerequisites: ['Basic introductory knowledge'],
      lessons
    });
  } else {
    const half = Math.ceil(lessons.length / 2);
    modules.push({
      id: 'mod-1',
      title: 'Module 1: Foundations & Core Principles',
      description: `Foundational learning and core skills for ${p.goal}.`,
      learningObjectives: ['Understand underlying principles', 'Practice basic implementations'],
      estimatedDuration: '4-6 weeks',
      prerequisites: ['Introductory subject exposure'],
      lessons: lessons.slice(0, half)
    });
    modules.push({
      id: 'mod-2',
      title: 'Module 2: Advanced Implementation & Applied Project',
      description: `Practical systems, optimization, and capstone portfolio execution.`,
      learningObjectives: ['Synthesize technical methods', 'Deliver demonstrable portfolio artifacts'],
      estimatedDuration: '4-6 weeks',
      prerequisites: ['Module 1: Foundations & Core Principles'],
      lessons: lessons.slice(half)
    });
  }

  const assessment: LearningAssessment = p.assessment || {
    whatYouWillLearn: `Comprehensive, structured mastery of ${p.goal} through progressive modular checkpoints and verified resources.`,
    whyIncluded: `Personalized curriculum designed to cover academic and practical competencies for ${p.goal}.`,
    expectedSequence: 'Begins with core foundational knowledge, moves to guided practical tasks, and concludes with verified demonstrations.',
    estimatedTotalDuration: `${(p.hoursPerWeek || 10) * 12} hours (approx 12 weeks)`,
    majorMilestones: milestones.map(m => m.title).slice(0, 4),
    existingKnowledgeAssessed: 'Assessed from your declared skills and academic background.',
    skillGapsIdentified: milestones.filter(m => m.state !== 'Demonstrated').map(m => m.skill).slice(0, 4),
    providerNotice: p.source === 'qwen' ? 'Personalized by Alibaba Cloud Qwen' : 'Deterministic Learning Plan'
  };

  return {
    ...p,
    assessment,
    modules: p.modules && p.modules.length > 0 ? p.modules : modules
  };
}

