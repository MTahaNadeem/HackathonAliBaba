import {createClient} from '@supabase/supabase-js';import {degrees,resources,universities,roles,skillNames} from '../lib/catalogue';import {analyseJob} from '../lib/domain';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Set the Supabase URL and a server-only service role key in .env.local for this trusted seed operation.');const db=createClient(url,key,{auth:{persistSession:false}});
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
async function upsert(table:string,rows:unknown[],onConflict?:string){if(!rows.length)return;const{error}=await db.from(table).upsert(rows,{onConflict});if(error)throw new Error(`Seed failed at ${table}; inspect the schema and retry. No credentials are logged.`);console.log(`Seeded ${table}: ${rows.length}`)}
await upsert('skills',skillNames.map(name=>({id:slug(name),name})));
await upsert('degrees',degrees.map(d=>({id:d.id,name:d.name,field:d.field,data:d})));
await upsert('degree_skills',degrees.flatMap(d=>d.skills.map(s=>({degree_id:d.id,skill_id:slug(s)}))),'degree_id,skill_id');
await upsert('careers',degrees.flatMap(d=>d.roles.map((title,i)=>({id:`${d.id}-${i}`,title,degree_id:d.id}))));
await upsert('career_skills',degrees.flatMap(d=>d.roles.flatMap((_,i)=>d.skills.map(s=>({career_id:`${d.id}-${i}`,skill_id:slug(s)})))),'career_id,skill_id');
await upsert('resources',resources.map(r=>({id:r.id,title:r.title,provider:r.provider,url:r.url,access_label:r.access,data:r})));
await upsert('resource_skills',resources.flatMap(r=>r.skills.map(s=>({resource_id:r.id,skill_id:slug(s)}))),'resource_id,skill_id');
await upsert('universities',Array.from(new Map(universities.map(u=>[u.short,{id:slug(u.short),name:u.name,official_url:u.url}])).values()));
await upsert('campuses',Array.from(new Map(universities.map(u=>[`${u.short}-${u.city}`,{id:slug(`${u.short}-${u.city}`),university_id:slug(u.short),city:u.city,name:u.city}])).values()));
await upsert('programmes',universities.map(u=>({id:u.id,campus_id:slug(`${u.short}-${u.city}`),degree_id:u.degreeId,title:u.programme})));
await upsert('admission_cycles',universities.map(u=>({programme_id:u.id,academic_year:u.feeYear||'unverified',source_url:u.feeUrl||u.url,checked_at:u.checked,verified:u.rule!=='unknown',tuition_per_semester:u.fee,mandatory_per_semester:u.mandatory,rules:{kind:u.rule,scope:'Limited initial rules; full programme eligibility requires official review.'}})),'programme_id,academic_year');
await upsert('jobs',roles.map(r=>({id:r.id,title:r.title,description:r.description,source_kind:'example',city:r.city})));
await upsert('job_requirements',roles.flatMap(r=>analyseJob(r.description,[]).gaps.map(g=>({job_id:r.id,skill_id:slug(g.skill),evidence:g.evidence,optional:g.optional}))),'job_id,skill_id');
console.log('Catalogue seed complete. Example jobs remain explicitly labelled.');
