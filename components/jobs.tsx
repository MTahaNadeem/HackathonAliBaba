'use client';
import {useState} from 'react';
import type {RecommendationResult} from '@/lib/ai/recommendation-engine';
import {ArrowRight,Search,MapPin,BriefcaseBusiness,Check,ArrowUpRight,FileText,LoaderCircle,Link,Sparkles} from 'lucide-react';
import {roles,degrees} from '@/lib/catalogue';
import {type Profile} from '@/lib/domain';
import {Empty} from './fields';

type Gap = { skill: string, status: 'Demonstrated'|'Improve'|'Learn Next', evidence: string, optional: boolean, importance: string };
type AnalysisResult = { title: string, company: string, gaps: Gap[], formal: string[], method: string };

export default function Jobs({profile,onPlan,recommendations}:{profile:Profile;recommendations?:RecommendationResult;onPlan:(goal:string,skills:string[])=>void}) {
  const goalDegree = degrees.find(d => d.id === profile.goal);
  const [prioritizePersonalized, setPrioritizePersonalized] = useState(Boolean(goalDegree) || profile.journey === 'career');
  const [text,setText] = useState('');
  const [url,setUrl] = useState('');
  const [query,setQuery] = useState('');
  const [result,setResult] = useState<AnalysisResult|null>(null);
  const [title,setTitle] = useState('your target role');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');

  async function analyse(content=text, jobUrl=url) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/jobs/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, url: jobUrl, profile })
      });
      const data = await r.json() as AnalysisResult & { error?: string };
      if (!r.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
      if(data.title) setTitle(data.title);
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Analysis could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  const personalizedRoles = prioritizePersonalized && recommendations?.source === 'groq' && recommendations.kind === 'careers' ? recommendations.careers : undefined;
  const filtered = (personalizedRoles || roles)
    .filter(r => `${r.title} ${r.city} ${r.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (personalizedRoles) return 0;
      if (prioritizePersonalized && goalDegree) {
        const aExact = a.degreeId === goalDegree.id;
        const bExact = b.degreeId === goalDegree.id;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        const aField = degrees.find(d => d.id === a.degreeId)?.field === goalDegree.field;
        const bField = degrees.find(d => d.id === b.degreeId)?.field === goalDegree.field;
        if (aField && !bField) return -1;
        if (bField && !aField) return 1;
      }
      return 0;
    });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM “NOT YET” TO “I CAN”</div>
          <h1>Meet your <span>next opportunity.</span></h1>
          <p>Understand what a role asks for. Build a plan to work towards it.</p>
        </div>
      </div>
      <div className="jobs-layout">
        <section className="job-library">
          <div className="section-heading">
            <h2>Explore role briefs</h2>
            <span className="status-label">Examples</span>
          </div>
          <label className="search-field">
            <Search size={18}/>
            <input aria-label="Search role briefs" placeholder="Role, skill, or location…" value={query} onChange={e=>setQuery(e.target.value)}/>
          </label>
          <p className="small-text muted space-top">These illustrate requirements. They are not live vacancies.</p>

          {prioritizePersonalized && goalDegree && (
            <div
              className="active-filter-banner"
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginTop: '12px',
                marginBottom: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#1e3a8a' }}>
                  Prioritizing role briefs for <strong>{goalDegree.name} ({goalDegree.field})</strong>
                </span>
              </div>
              <button
                className="text-button"
                style={{
                  fontSize: '12px',
                  color: '#2563eb',
                  textDecoration: 'underline',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setPrioritizePersonalized(false)}
              >
                Standard order
              </button>
            </div>
          )}
          {!prioritizePersonalized && goalDegree && (
            <div
              className="active-filter-banner"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginTop: '12px',
                marginBottom: '14px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Showing role briefs in default order.
              </span>
              <button
                className="text-button"
                style={{
                  fontSize: '12px',
                  color: '#2563eb',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setPrioritizePersonalized(true)}
              >
                Prioritize for {goalDegree.name}
              </button>
            </div>
          )}
          {personalizedRoles && <p className="small-text muted">Groq-personalized role suggestions; skill matches are self-reported, not verified competence.</p>}
          <div className="role-list">
            {filtered.map(r => (
              <button key={r.id} className={`role-card ${title === r.title ? 'chosen' : ''}`} onClick={() => { setTitle(r.title); setText(r.description); setUrl(''); setResult(null); }}>
                <span className="role-icon"><BriefcaseBusiness size={20}/></span>
                <div>
                  <strong>{r.title}</strong>
                  <span>{degrees.find(d => d.id === r.degreeId)?.field}</span>
                  <small><MapPin size={12}/>{r.city} · Example brief</small>
                  {personalizedRoles && (() => {
                    const detail = personalizedRoles.find(item => item.id === r.id);
                    return detail ? <>
                      <small>{detail.explanation}</small>
                      <small>Self-reported: {detail.matchedSkills.join(', ') || 'None'} · Needs evidence: {detail.missingSkills.join(', ') || 'None'}</small>
                      {detail.uncertainSkills.length > 0 && <small>CV-mentioned; confirm: {detail.uncertainSkills.join(', ')}</small>}
                      <small>{detail.nextAction}</small>
                    </> : null;
                  })()}
                </div>
                <ArrowUpRight size={17}/>
              </button>
            ))}
          </div>
          {!filtered.length && <Empty title="No matching role briefs" text="Try a skill or paste your own description."/>}
        </section>

        <section className="analysis-panel">
          <div className="section-heading">
            <div>
              <h2>Your job, decoded.</h2>
              <p>Paste a job description or provide a URL.</p>
            </div>
            <FileText size={23}/>
          </div>
          
          <label className="field">
            <span>Job URL (optional)</span>
            <div className="search-field">
              <Link size={18}/>
              <input type="url" placeholder="https://..." value={url} onChange={e => {setUrl(e.target.value); setResult(null);}} />
            </div>
          </label>

          <label className="field space-top">
            <span>Job description</span>
            <textarea rows={8} maxLength={15000} value={text} onChange={e => {setText(e.target.value); setTitle('your target role'); setResult(null);}} placeholder="Paste a real description here..."/>
          </label>
          
          <div className="analysis-action">
            <span className="small-text muted">Compared with your profile</span>
            <button className="button blue" disabled={busy || (!text.trim() && !url.trim())} onClick={() => analyse()}>
              {busy ? <><LoaderCircle className="spin" size={17}/>Analysing…</> : <>Find my skill gaps <ArrowRight size={17}/></>}
            </button>
          </div>
          
          {error && <p role="alert" className="error-message">{error}</p>}
          
          {result && (
            <div className="analysis-results">
              {result.title && <div className="result-summary">
                <strong>{result.title}</strong>
                {result.company && (
                  <div>
                    <b>{result.company}</b>
                  </div>
                )}
              </div>}
              
              <div className="gap-list">
                {(result.gaps || []).map((g, i) => {
                  const isDemonstrated = g.status === 'Demonstrated' || (g.status as string) === 'Self-reported';
                  return (
                    <div className={`gap-row ${isDemonstrated ? 'known' : ''}`} key={i}>
                      <span className="gap-dot">{isDemonstrated ? <Check size={13}/> : (g.status === 'Improve' ? '~' : '+')}</span>
                      <div>
                        <strong>{g.skill}</strong>
                        {g.importance && <p>{g.importance}</p>}
                        <p className="small-text muted">{g.evidence}</p>
                      </div>
                      <span className="gap-status">{g.optional ? 'Preferred · ' : ''}{g.status}</span>
                    </div>
                  );
                })}
              </div>
              
              {(!result.gaps || !result.gaps.length) && <Empty title="No skills identified" text="The analyser could not identify catalogued skills from this description."/>}
              
              {Boolean(result.formal && result.formal.length > 0) && (
                <div className="formal-panel">
                  <strong>Also check these requirements</strong>
                  <ul>{result.formal.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              )}
              
              {result.method && <p className="small-text muted">{result.method}</p>}
              
              {Boolean(result.gaps && result.gaps.length > 0) && (
                <button className="button dark full space-top" onClick={() => {
                  const skillsToLearn = (result.gaps || []).filter(g => g.status !== 'Demonstrated' && (g.status as string) !== 'Self-reported').map(g => g.skill);
                  onPlan(title, skillsToLearn.length ? skillsToLearn : result.gaps.map(g => g.skill));
                }}>
                  Turn these gaps into a plan <ArrowRight size={18}/>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
