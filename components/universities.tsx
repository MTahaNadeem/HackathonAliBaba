'use client';
import {useState} from 'react';
import {Search,MapPin,ArrowUpRight,Info,GraduationCap,SlidersHorizontal,AlertTriangle,Clock,CheckCircle,RefreshCw} from 'lucide-react';
import {universities as catalogueUniversities,sourceLinks,degrees,type University,type VerificationStatus} from '@/lib/catalogue';
import {assessUniversity,getFeeDisplay,type Profile} from '@/lib/domain';
import {Choice,CheckField,Empty} from './fields';

/** Format a last_verified_at ISO string to a human-readable date */
function fmtVerified(iso:string|null|undefined):string{
  if(!iso||typeof iso!=='string')return 'not yet verified';
  try{const d=new Date(iso);if(isNaN(d.getTime()))return iso.slice(0,10);return d.toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'});}catch{return iso.slice(0,10);}
}

/** Verification badge shown on each university card */
function VerificationBadge({status,lastVerifiedAt,sourceUrl}:{status:VerificationStatus|undefined;lastVerifiedAt:string|null|undefined;sourceUrl:string|undefined}){
  const verified=fmtVerified(lastVerifiedAt);
  if(status==='live_refreshed'){
    return <span className="verification-badge live-refreshed" title={`Auto-refreshed on weekly pipeline schedule · Last verified: ${verified}`}><RefreshCw size={12}/>Live-refreshed · {verified}</span>;
  }
  if(status==='manual_snapshot'||status==='source_backed'||!status){
    const dateLabel = verified !== 'not yet verified' ? verified : 'verified';
    return <a className="verification-badge manual-snapshot" href={sourceUrl||'#'} target="_blank" rel="noreferrer" title={`Manually verified against official fee schedule (${dateLabel}). Parser not yet automated in pipeline. Click to view official source.`}><CheckCircle size={12}/>Manual snapshot · {dateLabel}<ArrowUpRight size={11}/></a>;
  }
  if(status==='stale'){
    return <a className="verification-badge stale" href={sourceUrl||'#'} target="_blank" rel="noreferrer" title="Data is more than 90 days old. Check the official source."><Clock size={12}/>Stale (&gt;90d) — check source<ArrowUpRight size={11}/></a>;
  }
  // needs_information
  return <a className="verification-badge needs-info" href={sourceUrl||'#'} target="_blank" rel="noreferrer" title="Fee and admission rules not yet verified. Check current admissions directly."><AlertTriangle size={12}/>Check current admissions<ArrowUpRight size={11}/></a>;
}

interface UniversitiesProps {
  profile:Profile;
  go:(id:string)=>void;
  liveUniversities?:University[];
  dataSource?:'database'|'catalogue_fallback';
  lastRunAt?:string|null;
  lastRunOk?:boolean|null;
}

export default function Universities({profile,go,liveUniversities,dataSource,lastRunAt,lastRunOk}:UniversitiesProps){
  // Prefer live DB universities; fall back to static catalogue, defensively flattening
  const rawSource = liveUniversities?.length ? liveUniversities : catalogueUniversities;
  const source: University[] = (rawSource as (University | University[])[]).flat();
  const [city,setCity]=useState(profile.relocate?'All cities':profile.city||'All cities');
  const [query,setQuery]=useState('');
  const [budgetOnly,setBudgetOnly]=useState(false);
  const list=source.filter(u=>(city==='All cities'||u.city===city)&&`${u.name} ${u.short} ${u.programme}`.toLowerCase().includes(query.toLowerCase())&&(!budgetOnly||assessUniversity(u,profile).budget==='Within semester budget'));

  const liveCount = source.filter(u => u.verificationStatus === 'live_refreshed').length;
  const manualCount = source.filter(u => u.verificationStatus === 'manual_snapshot' || u.verificationStatus === 'source_backed' || !u.verificationStatus).length;
  const needsInfoCount = source.filter(u => u.verificationStatus === 'needs_information').length;

  return <><div className="page-heading"><div><div className="eyebrow">A PLACE TO GROW</div><h1>Find your <span>next campus.</span></h1><p>Bring your ambitions, your location, and your budget together.</p></div><button className="button outline" onClick={()=>go('profile')}><SlidersHorizontal size={17}/>Update my preferences</button></div>

  {/* Data freshness notice */}
  {dataSource==='catalogue_fallback'&&<div className="inline-note freshness-notice"><AlertTriangle size={16}/><div><strong>Limited preview data.</strong> University fees and admission rules are served from the static catalogue. Sign in and ensure your Supabase database is set up to see live-refreshed data.</div></div>}
  {dataSource==='database'&&lastRunOk===false&&<div className="inline-note freshness-notice stale-notice"><AlertTriangle size={16}/><div><strong>Last pipeline refresh had failures.</strong> Some entries may not have updated. Check the ingestion run log.</div></div>}

  <div className="university-intro"><div><GraduationCap size={28}/><strong>Your fit comes first.</strong><p>We separate academic requirements, affordability and location. A recommendation is a starting point—not an admission offer.</p></div><div className="preference-summary"><span>{profile.qualification}</span><span>{profile.city||'Choose your city'}</span><span>{typeof profile.budget==='number'&&!isNaN(profile.budget)?`PKR ${profile.budget.toLocaleString()} / semester`:'Budget not set'}</span></div></div>

  <div className="filter-row"><label className="search-field"><Search size={18}/><input aria-label="Search universities" placeholder="Search universities or programmes…" value={query} onChange={e=>setQuery(e.target.value)}/></label><Choice label="City" value={city} options={Array.from(new Set(['All cities',...source.map(u=>u.city),...(profile.city?[profile.city]:[])]))} onChange={setCity}/></div>
  <div className="filter-row secondary"><CheckField label="Only verified costs within my budget" checked={budgetOnly} onChange={setBudgetOnly}/><span className="muted small-text">{list.length} programme listings ({liveCount} live-refreshed · {manualCount} manual snapshots · {needsInfoCount} inquiry required) · {dataSource==='database'?'live database':'initial curated catalogue'}</span></div>

  <div className="university-list">{list.map(u=>{
    const a=assessUniversity(u,profile);
    const vs=u.verificationStatus;
    const {tuition,mandatory,isFeeVerified}=getFeeDisplay(u);
    return <article className={`university-card${vs==='stale'?' card-stale':''}${vs==='needs_information'?' card-needs-info':''}`} key={u.id}><div className="university-logo">{u.short}</div><div className="university-content"><div className="university-title"><div><span className="location"><MapPin size={14}/>{u.city}</span><h2>{u.name}</h2><p>{u.programme}</p></div><span className="status-label">{a.status}</span></div>

  <VerificationBadge status={vs} lastVerifiedAt={u.lastVerifiedAt} sourceUrl={u.sourceUrl||u.feeUrl}/>

  <div className="university-facts"><div><small>SEMESTER TUITION</small><strong>{tuition}</strong><span>{mandatory}</span></div><div><small>YOUR BUDGET</small><strong>{a.budget}</strong><span>Hostel and transport excluded</span></div>{typeof a.aggregate==='number'&&!isNaN(a.aggregate)&&<div><small>STANDARD NET AGGREGATE</small><strong>{a.aggregate}%</strong><span>Estimate · completed qualifications</span></div>}</div>
  {(u.entryTest||u.minEligibility||u.aggregateFormula)&&<div className="university-requirements">{u.entryTest&&<div className="requirement-pill"><span>Entry Test:</span> <strong>{u.entryTest}</strong></div>}{u.minEligibility&&<div className="requirement-pill"><span>Eligibility:</span> <strong>{u.minEligibility}</strong></div>}{u.aggregateFormula&&<div className="requirement-pill"><span>Merit:</span> <strong>{u.aggregateFormula}</strong></div>}</div>}
  <p className="assessment-detail"><Info size={15}/>{a.detail}</p>
  {u.notes&&<div className={`university-notes${vs==='needs_information'?' needs-info-notice':''}`}><Info size={14}/><span>{u.notes}</span></div>}
  <div className="university-links"><a className="text-button" href={u.url} target="_blank" rel="noreferrer">Official admissions <ArrowUpRight size={16}/></a>{u.feeUrl&&isFeeVerified&&<a className="text-button" href={u.feeUrl} target="_blank" rel="noreferrer">Fee source · {u.feeYear||'Official'}<ArrowUpRight size={16}/></a>}{(vs==='stale'||vs==='needs_information')&&(u.sourceUrl||u.feeUrl)&&<a className="text-button" href={u.sourceUrl||u.feeUrl} target="_blank" rel="noreferrer">Official portal / inquiry <ArrowUpRight size={16}/></a>}</div>
  </div></article>})}
  </div>


  {!list.length&&<Empty title="No verified matches for these filters" text="Unknown fees are excluded when you ask for confirmed affordability. Broaden your city or turn off the budget filter to investigate more options." action="Reset filters" onAction={()=>{setCity('All cities');setQuery('');setBudgetOnly(false)}}/>}

  <div className="source-strip"><strong>Check before you apply</strong><a href={sourceLinks.ibcc} target="_blank" rel="noreferrer">IBCC equivalence <ArrowUpRight size={14}/></a><a href={sourceLinks.hec} target="_blank" rel="noreferrer">HEC qualification register <ArrowUpRight size={14}/></a><a href={sourceLinks.nustEligibility} target="_blank" rel="noreferrer">NUST eligibility <ArrowUpRight size={14}/></a><a href={sourceLinks.nustMerit} target="_blank" rel="noreferrer">NET formula <ArrowUpRight size={14}/></a>{lastRunAt&&<span className="muted">Data refreshed {fmtVerified(lastRunAt)}</span>}</div></>;
}
