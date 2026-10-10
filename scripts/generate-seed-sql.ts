import fs from 'fs';
import path from 'path';
import { degrees, resources, universities, roles, skillNames } from '../lib/catalogue';
import { analyseJob } from '../lib/domain';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const sqlStr = (s: string | null | undefined) => {
  if (s === null || s === undefined) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
};
const sqlJson = (obj: unknown) => {
  if (obj === null || obj === undefined) return 'NULL';
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
};
const sqlNum = (n: number | null | undefined) => (n === null || n === undefined ? 'NULL' : String(n));
const sqlBool = (b: boolean) => (b ? 'TRUE' : 'FALSE');

const lines: string[] = [
  '-- Migration 003: Full catalogue seed (77 programmes, 67 universities, 33 degrees, skills, roles)',
  '-- Run in Supabase SQL Editor if service-role API key is unavailable via REST.',
  'BEGIN;',
  ''
];

// 1. Skills
lines.push('-- 1. Skills');
lines.push('INSERT INTO public.skills (id, name) VALUES');
const skillValues = skillNames.map(name => `  (${sqlStr(slug(name))}, ${sqlStr(name)})`).join(',\n');
lines.push(skillValues + ' ON CONFLICT (id) DO NOTHING;\n');

// 2. Degrees
lines.push('-- 2. Degrees');
lines.push('INSERT INTO public.degrees (id, name, field, data) VALUES');
const degreeValues = degrees.map(d => `  (${sqlStr(d.id)}, ${sqlStr(d.name)}, ${sqlStr(d.field)}, ${sqlJson(d)})`).join(',\n');
lines.push(degreeValues + ' ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, field = EXCLUDED.field, data = EXCLUDED.data;\n');

// 3. Degree Skills
lines.push('-- 3. Degree Skills');
lines.push('INSERT INTO public.degree_skills (degree_id, skill_id) VALUES');
const degreeSkillRows: string[] = [];
for (const d of degrees) {
  for (const s of d.skills) {
    degreeSkillRows.push(`  (${sqlStr(d.id)}, ${sqlStr(slug(s))})`);
  }
}
lines.push(degreeSkillRows.join(',\n') + ' ON CONFLICT (degree_id, skill_id) DO NOTHING;\n');

// 4. Careers
lines.push('-- 4. Careers');
lines.push('INSERT INTO public.careers (id, title, degree_id) VALUES');
const careerValues = degrees.flatMap(d => d.roles.map((title, i) => `  (${sqlStr(`${d.id}-${i}`)}, ${sqlStr(title)}, ${sqlStr(d.id)})`)).join(',\n');
lines.push(careerValues + ' ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;\n');

// 5. Career Skills
lines.push('-- 5. Career Skills');
lines.push('INSERT INTO public.career_skills (career_id, skill_id) VALUES');
const careerSkillRows = degrees.flatMap(d => d.roles.flatMap((_, i) => d.skills.map(s => `  (${sqlStr(`${d.id}-${i}`)}, ${sqlStr(slug(s))})`))).join(',\n');
lines.push(careerSkillRows + ' ON CONFLICT (career_id, skill_id) DO NOTHING;\n');

// 6. Resources
lines.push('-- 6. Resources');
lines.push('INSERT INTO public.resources (id, title, provider, url, access_label, data) VALUES');
const resourceValues = resources.map(r => `  (${sqlStr(r.id)}, ${sqlStr(r.title)}, ${sqlStr(r.provider)}, ${sqlStr(r.url)}, ${sqlStr(r.access)}, ${sqlJson(r)})`).join(',\n');
lines.push(resourceValues + ' ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;\n');

// 7. Resource Skills
lines.push('-- 7. Resource Skills');
lines.push('INSERT INTO public.resource_skills (resource_id, skill_id) VALUES');
const resourceSkillRows = resources.flatMap(r => r.skills.map(s => `  (${sqlStr(r.id)}, ${sqlStr(slug(s))})`)).join(',\n');
lines.push(resourceSkillRows + ' ON CONFLICT (resource_id, skill_id) DO NOTHING;\n');

// 8. Universities (67 unique institutions)
lines.push('-- 8. Universities');
lines.push('INSERT INTO public.universities (id, name, official_url, source_url, last_verified_at, verification_status) VALUES');
const uniqueUnis = Array.from(new Map(universities.map(u => [u.short, {
  id: slug(u.short),
  name: u.name,
  official_url: u.url,
  source_url: u.sourceUrl || u.feeUrl || u.url,
  last_verified_at: u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`,
  verification_status: u.verificationStatus === 'needs_information' ? 'needs_information' : 'source_backed'
}])).values());
const uniValues = uniqueUnis.map(u => `  (${sqlStr(u.id)}, ${sqlStr(u.name)}, ${sqlStr(u.official_url)}, ${sqlStr(u.source_url)}, ${sqlStr(u.last_verified_at)}::timestamptz, ${sqlStr(u.verification_status)}::public.verification_status)`).join(',\n');
lines.push(uniValues + ' ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, official_url = EXCLUDED.official_url, source_url = EXCLUDED.source_url, last_verified_at = EXCLUDED.last_verified_at, verification_status = EXCLUDED.verification_status;\n');

// 9. Campuses
lines.push('-- 9. Campuses');
lines.push('INSERT INTO public.campuses (id, university_id, city, name, source_url, last_verified_at, verification_status) VALUES');
const uniqueCampuses = Array.from(new Map(universities.map(u => [`${u.short}-${u.city}`, {
  id: slug(`${u.short}-${u.city}`),
  university_id: slug(u.short),
  city: u.city,
  name: u.city,
  source_url: u.sourceUrl || u.feeUrl || u.url,
  last_verified_at: u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`,
  verification_status: u.verificationStatus === 'needs_information' ? 'needs_information' : 'source_backed'
}])).values());
const campusValues = uniqueCampuses.map(c => `  (${sqlStr(c.id)}, ${sqlStr(c.university_id)}, ${sqlStr(c.city)}, ${sqlStr(c.name)}, ${sqlStr(c.source_url)}, ${sqlStr(c.last_verified_at)}::timestamptz, ${sqlStr(c.verification_status)}::public.verification_status)`).join(',\n');
lines.push(campusValues + ' ON CONFLICT (id) DO UPDATE SET city = EXCLUDED.city, name = EXCLUDED.name, source_url = EXCLUDED.source_url, last_verified_at = EXCLUDED.last_verified_at, verification_status = EXCLUDED.verification_status;\n');

// 10. Programmes (77 entries)
lines.push('-- 10. Programmes');
lines.push('INSERT INTO public.programmes (id, campus_id, degree_id, title, source_url, last_verified_at, verification_status) VALUES');
const progValues = universities.map(u => {
  const campus_id = slug(`${u.short}-${u.city}`);
  const status = u.verificationStatus === 'needs_information' ? 'needs_information' : 'source_backed';
  const last_verified = u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`;
  return `  (${sqlStr(u.id)}, ${sqlStr(campus_id)}, ${sqlStr(u.degreeId)}, ${sqlStr(u.programme)}, ${sqlStr(u.sourceUrl || u.feeUrl || u.url)}, ${sqlStr(last_verified)}::timestamptz, ${sqlStr(status)}::public.verification_status)`;
}).join(',\n');
lines.push(progValues + ' ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, source_url = EXCLUDED.source_url, last_verified_at = EXCLUDED.last_verified_at, verification_status = EXCLUDED.verification_status;\n');

// 11. Admission Cycles (77 entries)
lines.push('-- 11. Admission Cycles');
lines.push('INSERT INTO public.admission_cycles (programme_id, academic_year, source_url, checked_at, verified, tuition_per_semester, mandatory_per_semester, rules, last_verified_at, verification_status, fee_currency, fee_period, fee_mandatory_description) VALUES');
const cycleValues = universities.map(u => {
  const rules = {
    kind: u.rule,
    entryTest: u.entryTest,
    minEligibility: u.minEligibility,
    aggregateFormula: u.aggregateFormula,
    notes: u.notes
  };
  const verified = u.verificationStatus !== 'needs_information';
  const status = u.verificationStatus === 'needs_information' ? 'needs_information' : 'source_backed';
  const last_verified = u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`;
  const mandDesc = typeof u.mandatory === 'number' && !isNaN(u.mandatory) && u.mandatory > 0 ? `PKR ${u.mandatory.toLocaleString()} mandatory semester charges` : null;
  return `  (${sqlStr(u.id)}, ${sqlStr(u.feeYear || '2026–27')}, ${sqlStr(u.feeUrl || u.url)}, ${sqlStr(u.checked)}::date, ${sqlBool(verified)}, ${sqlNum(u.fee)}, ${sqlNum(u.mandatory)}, ${sqlJson(rules)}, ${sqlStr(last_verified)}::timestamptz, ${sqlStr(status)}::public.verification_status, 'PKR', 'semester', ${sqlStr(mandDesc)})`;
}).join(',\n');
lines.push(cycleValues + ' ON CONFLICT (programme_id, academic_year) DO UPDATE SET tuition_per_semester = EXCLUDED.tuition_per_semester, mandatory_per_semester = EXCLUDED.mandatory_per_semester, rules = EXCLUDED.rules, verified = EXCLUDED.verified, last_verified_at = EXCLUDED.last_verified_at, verification_status = EXCLUDED.verification_status;\n');

// 12. Jobs
lines.push('-- 12. Jobs');
lines.push('INSERT INTO public.jobs (id, title, description, source_kind, city) VALUES');
const jobValues = roles.map(r => `  (${sqlStr(r.id)}, ${sqlStr(r.title)}, ${sqlStr(r.description)}, 'example', ${sqlStr(r.city)})`).join(',\n');
lines.push(jobValues + ' ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;\n');

// 13. Job Requirements
lines.push('-- 13. Job Requirements');
lines.push('INSERT INTO public.job_requirements (job_id, skill_id, evidence, optional) VALUES');
const jobReqRows = roles.flatMap(r => analyseJob(r.description, []).gaps.map(g => `  (${sqlStr(r.id)}, ${sqlStr(slug(g.skill))}, ${sqlStr(g.evidence)}, ${sqlBool(g.optional)})`)).join(',\n');
lines.push(jobReqRows + ' ON CONFLICT (job_id, skill_id) DO NOTHING;\n');

lines.push('COMMIT;');

const outPath = path.join(process.cwd(), 'supabase', 'migrations', '003_seed_catalogue.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Generated migration 003_seed_catalogue.sql with ${universities.length} programmes and ${uniqueUnis.length} universities.`);
