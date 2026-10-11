'use client';
import {useState} from 'react';
import {BookOpen,ArrowUpRight,ArrowRight,Clock3,Download,Check,Search,Video,Library,Flag,FileText,Code2,MessagesSquare,FileCheck,Send,HelpCircle,CheckCircle2,ChevronDown} from 'lucide-react';
import {resources,degrees} from '@/lib/catalogue';
import {exportPlan,type Plan,type Profile,type MilestoneState} from '@/lib/domain';
import {Progress} from '@/components/ui/progress';
import {Checkbox} from '@/components/ui/checkbox';
import {CheckField,Empty} from './fields';

function QuestionBlock({ q, index }: { q: { question: string; hint: string; answer: string }; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`question-block ${open ? 'expanded' : ''}`}>
      <div className="question-heading-row">
        <span className="question-index-pill">Q{index + 1}</span>
        <strong className="question-text">{q.question}</strong>
      </div>
      <div className="question-hint">
        <HelpCircle size={14} className="hint-icon" />
        <p><span className="hint-label">Hint:</span> {q.hint}</p>
      </div>
      <div className="answer-disclosure">
        <button
          type="button"
          className={`answer-toggle-btn ${open ? 'active' : ''}`}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span>{open ? 'Hide Suggested Answer' : 'Suggested Answer'}</span>
          <ChevronDown size={14} className="chevron-icon" />
        </button>
        {open && (
          <div className="answer-panel">
            <div className="answer-panel-label">
              <CheckCircle2 size={13} />
              <span>SUGGESTED ANSWER</span>
            </div>
            <p>{q.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Learning({plan,profile,onUpdate,onCreate,go}:{plan:Plan|null;profile:Profile;onUpdate:(p:Plan)=>void;onCreate:(goal:string,skills:string[])=>void;go:(id:string)=>void}){
  const [format,setFormat] = useState('All formats');
  const [search,setSearch] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  
  function toggleCheck(key: string) {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  }
  
  const done = plan?.milestones.filter(m => m.state === 'Demonstrated' || Boolean(m.done)).length || 0;
  const total = plan?.milestones.length || 0;
  const goal = degrees.find(d => d.id === profile.goal);
  const list = resources.filter(r => (format === 'All formats' || r.format === format) && `${r.title} ${r.skills.join(' ')} ${r.provider}`.toLowerCase().includes(search.toLowerCase()));

  function download(){
    if(!plan) return;
    const blob = new Blob([exportPlan(plan)],{type:'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-coursecompass-learning-plan.md';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function updateMilestone(id: string, partial: any) {
    if(!plan) return;
    onUpdate({
      ...plan,
      milestones: plan.milestones.map(m => m.id === id ? { ...m, ...partial } : m)
    });
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SAVED ROADMAPS &amp; GOALS</div>
          <h1>My <span>Roadmap.</span></h1>
          <p>Track your academic direction and practical career learning milestones.</p>
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
            {plan.milestones.map((m, i) => {
              const resource = (m.resourceId ? resources.find(r => r.id === m.resourceId) : null)
                || resources.find(r => r.skills.some(s => s.toLowerCase() === m.skill.toLowerCase()))
                || resources.find(r => r.skills.includes(m.skill));
              const isCompleted = m.state === 'Demonstrated' || Boolean(m.done);

              return (
                <article className={`milestone ${isCompleted ? 'complete' : ''}`} key={m.id}>
                  <span className="milestone-number">{isCompleted ? <Check size={18}/> : String(i+1).padStart(2,'0')}</span>
                  <div className="milestone-content">
                    <div className="milestone-title">
                      <div>
                        <span className="eyebrow">{m.skill}</span>
                        <h3>{m.title}</h3>
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <span className="time-pill"><Clock3 size={13}/>{m.hours ?? 4}h estimated</span>
                        <select className="status-select" value={m.state || (m.done ? 'Demonstrated' : 'Not started')} onChange={e => {
                          const s = e.target.value as MilestoneState;
                          updateMilestone(m.id, { state: s, done: s === 'Demonstrated' });
                        }}>
                          <option value="Not started">Not started</option>
                          <option value="Learning">Learning</option>
                          <option value="Practiced">Practiced</option>
                          <option value="Demonstrated">Demonstrated</option>
                        </select>
                      </div>
                    </div>
                    
                    {(m.startLearning || m.structuredLearning) && (
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
                    )}

                    {resource && (
                      <a className="resource-link" href={resource.url} target="_blank" rel="noreferrer" aria-label={`Open ${resource.title}`}>
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
                      <p>{m.practice || resource?.practice || 'Complete a small practical task demonstrating this skill and request feedback.'}</p>
                      {m.proveSkill && (
                        <>
                          <strong style={{marginTop: '10px', display: 'block'}}>Prove your skill</strong>
                          <p>{m.proveSkill}</p>
                        </>
                      )}
                    </div>
                    
                    <div className="evidence-section">
                      <label className="field">
                        <span>Evidence / Project URL</span>
                        <input type="url" placeholder="https://github.com/..." value={m.evidenceUrl || ''} onChange={e => updateMilestone(m.id, { evidenceUrl: e.target.value })} />
                      </label>
                      <label className="field">
                        <span>Personal Notes</span>
                        <textarea rows={2} placeholder="What I learned, what I struggled with..." value={m.notes || ''} onChange={e => updateMilestone(m.id, { notes: e.target.value })} />
                      </label>
                    </div>

                    <CheckField
                      label="I completed the practice task"
                      checked={isCompleted}
                      onChange={v =>
                        updateMilestone(m.id, {
                          done: v,
                          state: v ? 'Demonstrated' : 'Not started'
                        })
                      }
                    />

                  </div>
                </article>
              );
            })}
          </div>

          {plan.interviewPrep && (
            <div className="interview-prep space-top">
              <div className="interview-prep-header">
                <div className="prep-header-content">
                  <span className="eyebrow">CAREER READINESS &amp; PREPARATION</span>
                  <h2>Interview &amp; Application Prep</h2>
                  <p>Role-specific technical questions, behavioral preparation, and checklist requirements.</p>
                </div>
                <div className="prep-header-badge" aria-hidden="true">
                  <FileText size={20}/>
                </div>
              </div>

              <div className="prep-grid">
                <div className="prep-card">
                  <div className="prep-card-header">
                    <div className="prep-card-title-group">
                      <div className="prep-card-icon blue" aria-hidden="true">
                        <Code2 size={18} />
                      </div>
                      <div>
                        <h3>Technical Questions</h3>
                        <small className="muted">Role-specific knowledge &amp; problem solving</small>
                      </div>
                    </div>
                    <span className="prep-count-badge">
                      {plan.interviewPrep.technical.length} questions
                    </span>
                  </div>
                  <div className="question-list">
                    {plan.interviewPrep.technical.map((q, i) => (
                      <QuestionBlock key={i} q={q} index={i} />
                    ))}
                  </div>
                </div>

                <div className="prep-card">
                  <div className="prep-card-header">
                    <div className="prep-card-title-group">
                      <div className="prep-card-icon peach" aria-hidden="true">
                        <MessagesSquare size={18} />
                      </div>
                      <div>
                        <h3>Behavioral Questions</h3>
                        <small className="muted">STAR-format communication &amp; teamwork</small>
                      </div>
                    </div>
                    <span className="prep-count-badge">
                      {plan.interviewPrep.behavioral.length} questions
                    </span>
                  </div>
                  <div className="question-list">
                    {plan.interviewPrep.behavioral.map((q, i) => (
                      <QuestionBlock key={i} q={q} index={i} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="prep-grid space-top">
                <div className="prep-card">
                  <div className="prep-card-header">
                    <div className="prep-card-title-group">
                      <div className="prep-card-icon green" aria-hidden="true">
                        <FileCheck size={18} />
                      </div>
                      <div>
                        <h3>Resume Checklist</h3>
                        <small className="muted">Essential items for ATS and technical reviews</small>
                      </div>
                    </div>
                    <span className="prep-count-badge">
                      {plan.interviewPrep.resumeChecklist.filter((_, i) => checkedItems[`resume-${i}`]).length} / {plan.interviewPrep.resumeChecklist.length} checked
                    </span>
                  </div>
                  <div className="checklist-items-container">
                    {plan.interviewPrep.resumeChecklist.map((c, i) => {
                      const key = `resume-${i}`;
                      const isChecked = Boolean(checkedItems[key]);
                      return (
                        <label
                          key={key}
                          className={`checklist-item-row ${isChecked ? 'completed' : ''}`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleCheck(key)}
                          />
                          <span className="checklist-item-text">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="prep-card">
                  <div className="prep-card-header">
                    <div className="prep-card-title-group">
                      <div className="prep-card-icon peach" aria-hidden="true">
                        <Send size={18} />
                      </div>
                      <div>
                        <h3>Application Checklist</h3>
                        <small className="muted">Submission readiness &amp; follow-up process</small>
                      </div>
                    </div>
                    <span className="prep-count-badge">
                      {plan.interviewPrep.applicationChecklist.filter((_, i) => checkedItems[`app-${i}`]).length} / {plan.interviewPrep.applicationChecklist.length} checked
                    </span>
                  </div>
                  <div className="checklist-items-container">
                    {plan.interviewPrep.applicationChecklist.map((c, i) => {
                      const key = `app-${i}`;
                      const isChecked = Boolean(checkedItems[key]);
                      return (
                        <label
                          key={key}
                          className={`checklist-item-row ${isChecked ? 'completed' : ''}`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleCheck(key)}
                          />
                          <span className="checklist-item-text">{c}</span>
                        </label>
                      );
                    })}
                  </div>
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

      <section className="resource-library">
        <div className="section-heading">
          <div>
            <h2>Your learning bookshelf</h2>
            <p>Free resources. Useful practice. No paid API required.</p>
          </div>
          <span className="catalogue-count">{resources.length} resources</span>
        </div>
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
        <div className="resource-grid">
          {list.map(r => (
            <article className="resource-card" key={r.id}>
              <div className="resource-top">
                <span className="resource-icon">{r.format === 'Video' ? <Video size={21}/> : (r.format === 'Textbook' ? <Library size={21}/> : <BookOpen size={21}/>)}</span>
                <span className="free-badge">{r.access}</span>
              </div>
              <small>{r.provider}</small>
              <h3>{r.title}</h3>
              <div className="tags">
                {r.skills.slice(0, 2).map(s => <span key={s}>{s}</span>)}
              </div>
              <div className="card-footer">
                <span>{r.format} · {r.language}</span>
                <a className="text-button" href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.title}`}>Open <ArrowUpRight size={17}/></a>
              </div>
            </article>
          ))}
        </div>
        {!list.length && <Empty title="No resources found" text="Try a broader skill or another format."/>}
        <p className="small-text muted space-top">Links may lead to resource collections. Free learning does not imply a free certificate. Provider access may change.</p>
      </section>
    </>
  );
}
