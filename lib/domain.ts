import {degrees,resources,skillNames,type University} from './catalogue';
<<<<<<< Updated upstream
export type Profile={name:string;stage:string;qualification:string;subjects:string[];interests:string[];skills:string[];city:string;budget:number|null;hours:number;ssc:number|null;hssc:number|null;equivalence:boolean;net:number|null;goal:string;relocate:boolean;experience?:string;projects?:string;certifications?:string;links?:string;resumeText?:string};
export const emptyProfile:Profile={name:'',stage:'Choosing a degree',qualification:'FSc',subjects:[],interests:[],skills:[],city:'',budget:null,hours:5,ssc:null,hssc:null,equivalence:false,net:null,goal:'',relocate:false,experience:'',projects:'',certifications:'',links:'',resumeText:''};
=======
export type Profile={name:string;stage:string;qualification:string;subjects:string[];interests:string[];skills:string[];city:string;budget:number|null;hours:number;ssc:number|null;hssc:number|null;equivalence:boolean;net:number|null;goal:string;relocate:boolean;experience:string;projects:string;certifications:string;links:string;resumeText:string;extractedSkills:string};
export const emptyProfile:Profile={name:'',stage:'Choosing a degree',qualification:'FSc',subjects:[],interests:[],skills:[],city:'',budget:null,hours:5,ssc:null,hssc:null,equivalence:false,net:null,goal:'',relocate:false,experience:'',projects:'',certifications:'',links:'',resumeText:'',extractedSkills:''};
>>>>>>> Stashed changes
export function recommend(p:Profile){return degrees.map(d=>{const interests=d.interests.filter(i=>p.interests.includes(i));const subjects=d.subjects.filter(i=>p.subjects.includes(i));return {...d,reasons:[...interests.map(i=>`You enjoy ${i.toLowerCase()}`),...subjects.map(i=>`Connects with ${i}`)],score:interests.length*2+subjects.length}}).sort((a,b)=>b.score-a.score)}
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
export type Plan={id:string;title:string;goal:string;createdAt:string;hoursPerWeek?:number;milestones:Milestone[];interviewPrep?:InterviewPrep};
export function createPlan(goal:string,skills:string[],hours:number):Plan{const wanted=Array.from(new Set(skills)).slice(0,8);return{id:crypto.randomUUID(),title:`Your path to ${goal}`,goal,hoursPerWeek:Math.max(1,Math.min(30,hours)),createdAt:new Date().toISOString(),milestones:wanted.map((skill,i)=>{const r=resources.find(r=>r.skills.includes(skill));return{id:`step-${i}`,skill,title:`Learn ${skill}`,startLearning:null,structuredLearning:null,practice:r?.practice||'Practice this skill.',proveSkill:'Build a project.',state:'Not started',notes:'',evidenceUrl:'',resourceId:r?.id||null,hours:4,done:false}})}}
export function exportPlan(p:Plan){return `# ${p.title}\n\n`+p.milestones.map((m,i)=>{return `## ${i+1}. ${m.title}\n- Status: ${m.state||(m.done?'Demonstrated':'Not started')}\n`}).join('\n')}
