'use client';
import {useState} from 'react';
<<<<<<< Updated upstream
import {
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  Download,
  Check,
  Search,
  Video,
  Library,
  GraduationCap,
  BriefcaseBusiness,
  Compass,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';
import {resources, degrees, type Degree} from '@/lib/catalogue';
import {exportPlan, type Plan, type Profile} from '@/lib/domain';
import {Progress} from '@/components/ui/progress';
import {CheckField, Empty} from './fields';

interface LearningProps {
  plan: Plan | null;
  profile: Profile;
  onUpdate: (p: Plan) => void;
  onCreate: (goal: string, skills: string[]) => void;
  go: (id: string) => void;
}

export default function Learning({plan, profile, onUpdate, onCreate, go}: LearningProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'career' | 'education'>('all');
  const [format, setFormat] = useState('All formats');
  const [search, setSearch] = useState('');

  const done = plan?.milestones.filter(m => m.done).length || 0;
  const total = plan?.milestones.length || 0;
  const goal = degrees.find(d => d.id === profile.goal);

  const list = resources.filter(
    r =>
      (format === 'All formats' || r.format === format) &&
      `${r.title} ${r.skills.join(' ')} ${r.provider}`.toLowerCase().includes(search.toLowerCase())
  );

  function download() {
    if (!plan) return;
    const blob = new Blob([exportPlan(plan)], {type: 'text/markdown;charset=utf-8'});
=======
import {BookOpen,ArrowUpRight,ArrowRight,Clock3,Download,Check,Search,Video,Library,Flag,FileText} from 'lucide-react';
import {resources,degrees} from '@/lib/catalogue';
import {exportPlan,type Plan,type Profile,type MilestoneState} from '@/lib/domain';
import {Progress} from '@/components/ui/progress';
import {CheckField,Empty} from './fields';

export default function Learning({plan,profile,onUpdate,onCreate,go}:{plan:Plan|null;profile:Profile;onUpdate:(p:Plan)=>void;onCreate:(goal:string,skills:string[])=>void;go:(id:string)=>void}){
  const [format,setFormat] = useState('All formats');
  const [search,setSearch] = useState('');
  
  const done = plan?.milestones.filter(m => m.state === 'Demonstrated').length || 0;
  const total = plan?.milestones.length || 0;
  const goal = degrees.find(d => d.id === profile.goal);
  const list = resources.filter(r => (format === 'All formats' || r.format === format) && `${r.title} ${r.skills.join(' ')} ${r.provider}`.toLowerCase().includes(search.toLowerCase()));

  function download(){
    if(!plan) return;
    const blob = new Blob([exportPlan(plan)],{type:'text/markdown;charset=utf-8'});
>>>>>>> Stashed changes
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-coursecompass-learning-plan.md';
    a.click();
<<<<<<< Updated upstream
    setTimeout(() => URL.revokeObjectURL(url), 1000);
=======
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function updateMilestone(id: string, partial: any) {
    if(!plan) return;
    onUpdate({
      ...plan,
      milestones: plan.milestones.map(m => m.id === id ? { ...m, ...partial } : m)
    });
>>>>>>> Stashed changes
  }

  return (
    <>
      <div className="page-heading">
        <div>
<<<<<<< Updated upstream
          <div className="eyebrow">SAVED ROADMAPS &amp; GOALS</div>
          <h1>
            My <span>Roadmap.</span>
          </h1>
          <p>Track your academic direction and practical career learning milestones.</p>
        </div>
        {plan && (
          <button className="button outline" onClick={download}>
            <Download size={17} />
            Download career plan
          </button>
        )}
      </div>

      {/* Roadmap Category Switcher */}
      <div className="filter-chips roadmap-view-chips" aria-label="Roadmap views">
        <button
          className={`chip ${activeTab === 'all' ? 'selected' : ''}`}
          onClick={() => setActiveTab('all')}
          aria-pressed={activeTab === 'all'}
        >
          All Roadmaps
        </button>
        <button
          className={`chip ${activeTab === 'education' ? 'selected' : ''}`}
          onClick={() => setActiveTab('education')}
          aria-pressed={activeTab === 'education'}
        >
          <GraduationCap size={15} />
          Education Roadmap
        </button>
        <button
          className={`chip ${activeTab === 'career' ? 'selected' : ''}`}
          onClick={() => setActiveTab('career')}
          aria-pressed={activeTab === 'career'}
        >
          <BriefcaseBusiness size={15} />
          Career Roadmap
        </button>
      </div>

      {/* ── 1. Education Roadmap Section ────────────────────────── */}
      {(activeTab === 'all' || activeTab === 'education') && (
        <section className="roadmap-sub-section" aria-labelledby="edu-roadmap-heading">
          <div className="section-heading">
            <div>
              <h2 id="edu-roadmap-heading">Education Roadmap</h2>
              <p>Your chosen academic degree, entry guidance, and admission planning.</p>
            </div>
            {goal && <span className="status-label">{goal.field}</span>}
          </div>

          {goal ? (
            <article className="primary-journey-card student-card" style={{ marginBottom: '32px' }}>
              <div className="journey-card-header">
                <div className="journey-icon-wrap student">
                  <GraduationCap size={26} />
                </div>
                <span className="journey-badge student">Academic Pathway</span>
              </div>
              <h2>{goal.name}</h2>
              <p className="journey-desc">{goal.tagline}</p>

              <div
                className="university-facts"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  padding: '16px 0',
                  borderTop: '1px solid #edf1f7',
                  borderBottom: '1px solid #edf1f7',
                  marginBottom: '18px'
                }}
              >
                <div>
                  <small>HELPFUL SUBJECTS</small>
                  <strong>{goal.subjects.join(', ')}</strong>
                </div>
                <div>
                  <small>CORE SKILLS DEVELOPED</small>
                  <div className="tags" style={{ marginTop: '4px' }}>
                    {goal.skills.map(s => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <small>POTENTIAL CAREER ROUTES</small>
                  <strong>{goal.roles.join(', ')}</strong>
                </div>
              </div>

              <div className="try-panel" style={{ marginBottom: '20px' }}>
                <Lightbulb size={22} />
                <div>
                  <strong>A practical first experiment</strong>
                  <p>{goal.trial}</p>
                </div>
              </div>

              <div className="journey-card-footer" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="button dark" onClick={() => go('universities')}>
                  Find university campuses <ArrowRight size={16} />
                </button>
                <button className="button outline" onClick={() => go('explore')}>
                  Change degree direction <Compass size={16} />
                </button>
              </div>
            </article>
          ) : (
            <div className="no-plan edu-empty-state">
              <span className="action-symbol blue">
                <GraduationCap size={27} />
              </span>
              <div>
                <h2>No academic goal selected yet</h2>
                <p>Explore degrees and university pathways that connect with your subjects and interests.</p>
              </div>
              <button className="button dark" onClick={() => go('explore')}>
                Explore degree paths <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── 2. Career & Learning Roadmap Section ────────────────── */}
      {(activeTab === 'all' || activeTab === 'career') && (
        <section className="roadmap-sub-section space-top-lg" aria-labelledby="career-roadmap-heading">
          <div className="section-heading">
            <div>
              <h2 id="career-roadmap-heading">Career &amp; Learning Roadmap</h2>
              <p>Practical skill milestones and practice tasks based on your target role.</p>
            </div>
            {plan && (
              <span className="catalogue-count">
                {done} / {total} completed
              </span>
            )}
          </div>

          {plan ? (
            <section className="learning-plan">
              <div className="plan-header">
                <div>
                  <span className="light-label">ACTIVE LEARNING ROADMAP</span>
                  <h2>{plan.title}</h2>
                  <p>
                    <Clock3 size={15} />
                    {plan.hoursPerWeek} hours / week · approximately{' '}
                    {Math.ceil(plan.milestones.reduce((a, m) => a + m.hours, 0) / plan.hoursPerWeek)} weeks
                  </p>
                </div>
                <div className="plan-progress">
                  <strong>
                    {done}
                    <span> / {total}</span>
                  </strong>
                  <span>steps completed</span>
                  <Progress value={total ? (done / total) * 100 : 0} className="plan-bar" />
                </div>
              </div>

              <div className="milestones">
                {plan.milestones.map((m, i) => {
                  const resource = resources.find(r => r.id === m.resourceId);
                  return (
                    <article className={`milestone ${m.done ? 'complete' : ''}`} key={m.id}>
                      <span className="milestone-number">
                        {m.done ? <Check size={18} /> : String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="milestone-content">
                        <div className="milestone-title">
                          <div>
                            <span className="eyebrow">{m.skill}</span>
                            <h3>{m.title}</h3>
                          </div>
                          <span className="time-pill">
                            <Clock3 size={13} />
                            {m.hours}h estimated
                          </span>
                        </div>
                        {resource && (
                          <a className="resource-link" href={resource.url} target="_blank" rel="noreferrer">
                            <BookOpen size={17} />
                            <span>
                              {resource.title}
                              <small>
                                {resource.provider} · {resource.access}
                              </small>
                            </span>
                            <ArrowUpRight size={16} />
                          </a>
                        )}
                        <div className="practice-task">
                          <strong>Make it practical</strong>
                          <p>{m.practice}</p>
                        </div>
                        <CheckField
                          label="I completed the practice task"
                          checked={m.done}
                          onChange={v =>
                            onUpdate({
                              ...plan,
                              milestones: plan.milestones.map(x => (x.id === m.id ? {...x, done: v} : x))
                            })
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="plan-footnote">
                Time estimates are planning suggestions. Completion is self-reported and does not guarantee job eligibility.
              </p>
            </section>
          ) : (
            <div className="no-plan">
              <span className="action-symbol green">
                <BriefcaseBusiness size={27} />
              </span>
              <div>
                <h2>No career learning roadmap created yet</h2>
                <p>
                  {goal
                    ? `Build a practical starter roadmap for ${goal.name.toLowerCase()}.`
                    : 'Paste a target job description or choose an example role to build a skill roadmap.'}
                </p>
              </div>
              <button
                className="button dark"
                onClick={() => (goal ? onCreate(goal.name, goal.skills) : go('jobs'))}
              >
                {goal ? 'Create my learning plan' : 'Analyze a job brief'}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── 3. Learning Bookshelf ───────────────────────────────── */}
=======
          <div className="eyebrow">SMALL STEPS. REAL PROGRESS.</div>
          <h1>Build your <span>next chapter.</span></h1>
          <p>A resource is a start. What you do with it makes the difference.</p>
        </div>
        {plan && <button className="button outline" onClick={download}><Download size={17}/>Download my plan</button>}
      </div>

      {plan ? (
        <section className="learning-plan">
          <div className="plan-header">
            <div>
              <span className="light-label">YOUR LEARNING ROADMAP</span>
              <h2>{plan.title}</h2>
            </div>
            <div className="plan-progress">
              <strong>{done}<span> / {total}</span></strong>
              <span>skills demonstrated</span>
              <Progress value={total ? (done/total)*100 : 0} className="plan-bar"/>
            </div>
          </div>

          <div className="milestones">
            {plan.milestones.map((m, i) => (
              <article className={`milestone ${m.state === 'Demonstrated' ? 'complete' : ''}`} key={m.id}>
                <span className="milestone-number">{m.state === 'Demonstrated' ? <Check size={18}/> : String(i+1).padStart(2,'0')}</span>
                <div className="milestone-content">
                  <div className="milestone-title">
                    <div>
                      <span className="eyebrow">{m.skill}</span>
                      <h3>{m.title}</h3>
                    </div>
                    <select className="status-select" value={m.state} onChange={e => updateMilestone(m.id, { state: e.target.value as MilestoneState })}>
                      <option value="Not started">Not started</option>
                      <option value="Learning">Learning</option>
                      <option value="Practiced">Practiced</option>
                      <option value="Demonstrated">Demonstrated</option>
                    </select>
                  </div>
                  
                  <div className="resources-grid">
                    {m.startLearning && (
                      <div className="resource-box">
                        <strong>Start Learning</strong>
                        <a href={m.startLearning.url} target="_blank" rel="noreferrer">
                          <Video size={15}/> {m.startLearning.title}
                        </a>
                        <small>{m.startLearning.provider} · {m.startLearning.cost}</small>
                      </div>
                    )}
                    {m.structuredLearning && (
                      <div className="resource-box">
                        <strong>Structured Course</strong>
                        <a href={m.structuredLearning.url} target="_blank" rel="noreferrer">
                          <BookOpen size={15}/> {m.structuredLearning.title}
                        </a>
                        <small>{m.structuredLearning.provider} · {m.structuredLearning.cost}</small>
                      </div>
                    )}
                  </div>

                  <div className="practice-task">
                    <strong>1. Practice</strong>
                    <p>{m.practice}</p>
                    <strong>2. Prove your skill</strong>
                    <p>{m.proveSkill}</p>
                  </div>
                  
                  <div className="evidence-section">
                    <label className="field">
                      <span>Evidence / Project URL</span>
                      <input type="url" placeholder="https://github.com/..." value={m.evidenceUrl} onChange={e => updateMilestone(m.id, { evidenceUrl: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>Personal Notes</span>
                      <textarea rows={2} placeholder="What I learned, what I struggled with..." value={m.notes} onChange={e => updateMilestone(m.id, { notes: e.target.value })} />
                    </label>
                  </div>

                </div>
              </article>
            ))}
          </div>

          {plan.interviewPrep && (
            <div className="interview-prep space-top">
              <div className="section-heading">
                <h2>Interview & Application Prep</h2>
                <FileText size={20}/>
              </div>
              <div className="prep-grid">
                <div>
                  <h3>Technical Questions</h3>
                  <ul className="question-list">
                    {plan.interviewPrep.technical.map((q, i) => (
                      <li key={i}>
                        <strong>{q.question}</strong>
                        <p className="hint">Hint: {q.hint}</p>
                        <details><summary>Suggested Answer</summary><p>{q.answer}</p></details>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Behavioral Questions</h3>
                  <ul className="question-list">
                    {plan.interviewPrep.behavioral.map((q, i) => (
                      <li key={i}>
                        <strong>{q.question}</strong>
                        <p className="hint">Hint: {q.hint}</p>
                        <details><summary>Suggested Answer</summary><p>{q.answer}</p></details>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="prep-grid space-top">
                <div className="checklist-box">
                  <h3>Resume Checklist</h3>
                  <ul>
                    {plan.interviewPrep.resumeChecklist.map((c, i) => <li key={i}><Check size={14}/> {c}</li>)}
                  </ul>
                </div>
                <div className="checklist-box">
                  <h3>Application Checklist</h3>
                  <ul>
                    {plan.interviewPrep.applicationChecklist.map((c, i) => <li key={i}><Check size={14}/> {c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <p className="plan-footnote">Time estimates are planning suggestions. Completion is self-reported and does not guarantee job eligibility.</p>
        </section>
      ) : (
        <div className="no-plan">
          <span className="action-symbol green"><Flag size={27}/></span>
          <div>
            <h2>Your next step is waiting.</h2>
            <p>{goal ? `Build a practical starter plan for ${goal.name.toLowerCase()}.` : 'Choose a direction or analyse a job to make learning personal.'}</p>
          </div>
          <button className="button dark" onClick={() => goal ? onCreate(goal.name, goal.skills) : go('explore')}>
            {goal ? 'Create my learning plan' : 'Explore my direction'}
            <ArrowRight size={17}/>
          </button>
        </div>
      )}

>>>>>>> Stashed changes
      <section className="resource-library">
        <div className="section-heading">
          <div>
            <h2>Your learning bookshelf</h2>
            <p>Free resources. Useful practice. No paid API required.</p>
          </div>
          <span className="catalogue-count">{resources.length} resources</span>
        </div>
<<<<<<< Updated upstream

        <div className="filter-row">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search learning resources"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find a skill, subject, or provider…"
            />
          </label>
        </div>

        <div className="filter-chips">
          {['All formats', 'Lessons', 'Textbook', 'Video'].map(f => (
            <button
              className={`chip ${format === f ? 'selected' : ''}`}
              key={f}
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
            >
              {f}
            </button>
          ))}
        </div>

=======
        <div className="filter-row">
          <label className="search-field">
            <Search size={18}/>
            <input aria-label="Search learning resources" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a skill, subject, or provider…"/>
          </label>
        </div>
        <div className="filter-chips">
          {['All formats','Lessons','Textbook','Video'].map(f => (
            <button className={`chip ${format === f ? 'selected' : ''}`} key={f} onClick={() => setFormat(f)} aria-pressed={format === f}>{f}</button>
          ))}
        </div>
>>>>>>> Stashed changes
        <div className="resource-grid">
          {list.map(r => (
            <article className="resource-card" key={r.id}>
              <div className="resource-top">
<<<<<<< Updated upstream
                <span className="resource-icon">
                  {r.format === 'Video' ? (
                    <Video size={21} />
                  ) : r.format === 'Textbook' ? (
                    <Library size={21} />
                  ) : (
                    <BookOpen size={21} />
                  )}
                </span>
=======
                <span className="resource-icon">{r.format === 'Video' ? <Video size={21}/> : (r.format === 'Textbook' ? <Library size={21}/> : <BookOpen size={21}/>)}</span>
>>>>>>> Stashed changes
                <span className="free-badge">{r.access}</span>
              </div>
              <small>{r.provider}</small>
              <h3>{r.title}</h3>
              <div className="tags">
<<<<<<< Updated upstream
                {r.skills.slice(0, 2).map(s => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <div className="card-footer">
                <span>
                  {r.format} · {r.language}
                </span>
                <a
                  className="text-button"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${r.title}`}
                >
                  Open <ArrowUpRight size={17} />
                </a>
=======
                {r.skills.slice(0, 2).map(s => <span key={s}>{s}</span>)}
              </div>
              <div className="card-footer">
                <span>{r.format} · {r.language}</span>
                <a className="text-button" href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.title}`}>Open <ArrowUpRight size={17}/></a>
>>>>>>> Stashed changes
              </div>
            </article>
          ))}
        </div>
<<<<<<< Updated upstream

        {!list.length && (
          <Empty title="No resources found" text="Try a broader skill or another format." />
        )}

        <p className="small-text muted space-top">
          Links may lead to resource collections. Free learning does not imply a free certificate. Provider access may change.
        </p>
=======
        {!list.length && <Empty title="No resources found" text="Try a broader skill or another format."/>}
        <p className="small-text muted space-top">Links may lead to resource collections. Free learning does not imply a free certificate. Provider access may change.</p>
>>>>>>> Stashed changes
      </section>
    </>
  );
}
