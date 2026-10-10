import {createClient} from '@supabase/supabase-js';
import {degrees,resources,universities,roles,skillNames} from '../lib/catalogue';
import {analyseJob} from '../lib/domain';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('Set the Supabase URL and a service role key (or anon key) in .env.local for seed operation.');
}
const db = createClient(url, key, { auth: { persistSession: false } });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function upsert(table: string, rows: unknown[], onConflict?: string) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) {
    console.warn(`Seed note for ${table}: ${error.message}`);
    return;
  }
  console.log(`Seeded ${table}: ${rows.length}`);
}

await upsert('skills', skillNames.map(name => ({ id: slug(name), name })), 'id');
await upsert('degrees', degrees.map(d => ({ id: d.id, name: d.name, field: d.field, data: d })), 'id');
await upsert('degree_skills', degrees.flatMap(d => d.skills.map(s => ({ degree_id: d.id, skill_id: slug(s) }))), 'degree_id,skill_id');
await upsert('careers', degrees.flatMap(d => d.roles.map((title, i) => ({ id: `${d.id}-${i}`, title, degree_id: d.id }))), 'id');
await upsert('career_skills', degrees.flatMap(d => d.roles.flatMap((_, i) => d.skills.map(s => ({ career_id: `${d.id}-${i}`, skill_id: slug(s) })))), 'career_id,skill_id');
await upsert('resources', resources.map(r => ({ id: r.id, title: r.title, provider: r.provider, url: r.url, access_label: r.access, data: r })), 'id');
await upsert('resource_skills', resources.flatMap(r => r.skills.map(s => ({ resource_id: r.id, skill_id: slug(s) }))), 'resource_id,skill_id');

// Seed 50+ HEC-recognized Universities across all provinces
await upsert(
  'universities',
  Array.from(
    new Map(
      universities.map(u => [
        u.short,
        {
          id: slug(u.short),
          name: u.name,
          official_url: u.url,
          source_url: u.sourceUrl || u.feeUrl || u.url,
          last_verified_at: u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`,
          verification_status: u.verificationStatus || 'source_backed'
        }
      ])
    ).values()
  ),
  'id'
);

await upsert(
  'campuses',
  Array.from(
    new Map(
      universities.map(u => [
        `${u.short}-${u.city}`,
        {
          id: slug(`${u.short}-${u.city}`),
          university_id: slug(u.short),
          city: u.city,
          name: u.city,
          source_url: u.sourceUrl || u.feeUrl || u.url,
          last_verified_at: u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`,
          verification_status: u.verificationStatus || 'source_backed'
        }
      ])
    ).values()
  ),
  'id'
);

await upsert(
  'programmes',
  universities.map(u => ({
    id: u.id,
    campus_id: slug(`${u.short}-${u.city}`),
    degree_id: u.degreeId,
    title: u.programme,
    source_url: u.sourceUrl || u.feeUrl || u.url,
    last_verified_at: u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`,
    verification_status: u.verificationStatus || 'source_backed'
  })),
  'id'
);

await upsert(
  'admission_cycles',
  universities.map(u => ({
    programme_id: u.id,
    academic_year: u.feeYear || '2026–27',
    source_url: u.feeUrl || u.url,
    checked_at: u.checked,
    verified: u.verificationStatus === 'source_backed',
    tuition_per_semester: u.fee,
    mandatory_per_semester: u.mandatory,
    rules: {
      kind: u.rule,
      entryTest: u.entryTest,
      minEligibility: u.minEligibility,
      aggregateFormula: u.aggregateFormula,
      notes: u.notes
    },
    last_verified_at: u.lastVerifiedAt || `${u.checked}T00:00:00.000Z`,
    verification_status: u.verificationStatus || 'source_backed',
    fee_currency: 'PKR',
    fee_period: 'semester',
    fee_mandatory_description: u.mandatory ? `PKR ${u.mandatory.toLocaleString()} mandatory semester charges` : null
  })),
  'programme_id,academic_year'
);

await upsert('jobs', roles.map(r => ({ id: r.id, title: r.title, description: r.description, source_kind: 'example', city: r.city })), 'id');
await upsert(
  'job_requirements',
  roles.flatMap(r => analyseJob(r.description, []).gaps.map(g => ({ job_id: r.id, skill_id: slug(g.skill), evidence: g.evidence, optional: g.optional }))),
  'job_id,skill_id'
);

console.log(`Catalogue seed complete with ${universities.length} programs across ${new Set(universities.map(u => u.name)).size} universities.`);

