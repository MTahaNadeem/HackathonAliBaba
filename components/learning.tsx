'use client';
import { useState, useMemo } from 'react';
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
  Flag,
  FileText,
  Code2,
  MessagesSquare,
  FileCheck,
  Send,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Sparkles,
  ExternalLink,
  Target,
  RefreshCw,
  Compass,
  GraduationCap
} from 'lucide-react';
import { resources, degrees } from '@/lib/catalogue';
import {
  exportPlan,
  synthesizeCurriculumIfMissing,
  type Plan,
  type Profile,
  type CurriculumModule,
  type Lesson,
  type LessonResource,
  type MilestoneState
} from '@/lib/domain';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty } from './fields';

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

function ResourceIcon({ type }: { type: LessonResource['resourceType'] }) {
  switch (type) {
    case 'video':
      return <Video size={16} />;
    case 'documentation':
      return <Library size={16} />;
    case 'exercise':
      return <Code2 size={16} />;
    case 'article':
      return <FileText size={16} />;
    case 'course':
    default:
      return <BookOpen size={16} />;
  }
}

export default function Learning({
  plan,
  profile,
  onUpdate,
  onCreate,
  go
}: {
  plan: Plan | null;
  profile: Profile;
  onUpdate: (p: Plan) => void;
  onCreate: (goal: string, skills: string[]) => void;
  go: (id: string) => void;
}) {
  const [format, setFormat] = useState('All formats');
  const [search, setSearch] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  function toggleCheck(key: string) {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Ensure active plan always has modules and assessment
  const activePlan = useMemo(() => {
    if (!plan) return null;
    return synthesizeCurriculumIfMissing(plan);
  }, [plan]);

  // Aggregate progress statistics across all modules and lessons
  const { totalLessons, completedLessons, overallPercent, totalModules, completedModules } = useMemo(() => {
    if (!activePlan) {
      return { totalLessons: 0, completedLessons: 0, overallPercent: 0, totalModules: 0, completedModules: 0 };
    }
    const mods = activePlan.modules || [];
    const all = mods.flatMap(m => m.lessons);
    const tot = all.length || activePlan.milestones.length || 0;
    const comp = all.length
      ? all.filter(l => Boolean(l.done)).length
      : activePlan.milestones.filter(m => m.state === 'Demonstrated' || Boolean(m.done)).length;
    const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
    const compMods = mods.filter(m => m.lessons.length > 0 && m.lessons.every(l => l.done)).length;

    return {
      totalLessons: tot,
      completedLessons: comp,
      overallPercent: pct,
      totalModules: mods.length,
      completedModules: compMods
    };
  }, [activePlan]);

  const goalDegree = degrees.find(d => d.id === profile.goal);
  const catalogueList = resources.filter(
    r =>
      (format === 'All formats' || r.format === format) &&
      `${r.title} ${r.skills.join(' ')} ${r.provider}`.toLowerCase().includes(search.toLowerCase())
  );

  function download() {
    if (!activePlan) return;
    const blob = new Blob([exportPlan(activePlan)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePlan.goal.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-learning-roadmap.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Interactive Lesson Completion Handler
  function toggleLesson(moduleId: string, lessonId: string) {
    if (!activePlan) return;
    const currentModules = activePlan.modules || [];
    const updatedModules: CurriculumModule[] = currentModules.map(m => {
      if (m.id !== moduleId) return m;
      return {
        ...m,
        lessons: m.lessons.map(l => {
          if (l.id !== lessonId) return l;
          return { ...l, done: !l.done };
        })
      };
    });

    // Synchronize milestones so legacy views and tests stay accurate
    const updatedPlan: Plan = {
      ...activePlan,
      modules: updatedModules,
      milestones: activePlan.milestones.map((m, idx) => {
        const correspondingMod = updatedModules[idx % updatedModules.length];
        const isModDone =
          Boolean(correspondingMod && correspondingMod.lessons.length > 0 && correspondingMod.lessons.every(l => l.done));
        return {
          ...m,
          done: isModDone || m.done,
          state: isModDone ? ('Demonstrated' as MilestoneState) : m.state
        };
      })
    };

    onUpdate(updatedPlan);
  }

  function updateLessonNotes(moduleId: string, lessonId: string, notesText: string) {
    if (!activePlan) return;
    const updatedModules: CurriculumModule[] = (activePlan.modules || []).map(m => {
      if (m.id !== moduleId) return m;
      return {
        ...m,
        lessons: m.lessons.map(l => {
          if (l.id !== lessonId) return l;
          return { ...l, notes: notesText };
        })
      };
    });
    onUpdate({ ...activePlan, modules: updatedModules });
  }

  return (
    <div className="learning-workspace">
      {/* Top Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">AI-GENERATED LEARNING PLATFORM</div>
          <h1>
            Your <span>Learning Roadmap.</span>
          </h1>
          <p>
            Structured academic and practical curriculum personalized for your academic background, degree goals, and career aspirations.
          </p>
        </div>
        {activePlan && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="button outline" onClick={download} title="Export full roadmap with lessons and resources to Markdown">
              <Download size={16} />
              Export Roadmap
            </button>
            <button
              className="button dark"
              onClick={() => onCreate(activePlan.goal, profile.skills)}
              title="Regenerate curriculum for this goal"
            >
              <RefreshCw size={15} />
              Regenerate
            </button>
          </div>
        )}
      </div>

      {activePlan ? (
        <>
          {/* Main Plan Overview Banner */}
          <section className="learning-overview">
            <div className="learning-overview-copy">
              <span className="learning-source">
                <Sparkles size={13} style={{ display: 'inline', marginRight: '5px', verticalAlign: '-1px' }} />
                {activePlan.assessment?.providerNotice ||
                  (activePlan.source === 'qwen'
                    ? 'Personalized by Alibaba Cloud Qwen'
                    : 'Deterministic Guided Syllabus')}
              </span>
              <h2>{activePlan.title}</h2>
              <p>{activePlan.description || 'Guided multi-stage curriculum designed to build demonstrable competence from foundational theory to capstone portfolio implementation.'}</p>
              <div className="learning-facts">
                <span>
                  <GraduationCap size={14} />
                  Goal: <strong>{activePlan.subject || activePlan.goal}</strong>
                </span>
                <span>
                  <Clock3 size={14} />
                  Duration: <strong>{activePlan.estimatedDuration || `${(profile.hours || 10) * 12}h`}</strong>
                </span>
                <span>
                  <Layers size={14} />
                  Curriculum: <strong>{totalModules} Modules · {totalLessons} Lessons</strong>
                </span>
              </div>
            </div>

            <div className="learning-overall-progress">
              <small>PROGRESS</small>
              <strong>{overallPercent}%</strong>
              <span>
                {completedLessons} of {totalLessons} lessons completed
              </span>
              <b>
                <CheckCircle2 size={15} />
                {completedModules} of {totalModules} modules finished
              </b>
              <Progress value={overallPercent} className="plan-bar" />
            </div>
          </section>

          {/* Initial Personalized Assessment Card */}
          {activePlan.assessment && (
            <section className="learning-assessment space-top">
              <div>
                <span className="eyebrow">LEARNING ASSESSMENT</span>
                <h2>What You Will Learn</h2>
                <p>{activePlan.assessment.whatYouWillLearn}</p>
                <div style={{ marginTop: '14px' }}>
                  <h3>Why This Sequence?</h3>
                  <p>{activePlan.assessment.whyIncluded}</p>
                </div>
              </div>

              <div>
                <span className="eyebrow">PEDAGOGICAL STRUCTURE</span>
                <h3>Expected Progression</h3>
                <p>{activePlan.assessment.expectedSequence}</p>
                <h3>Estimated Commitment</h3>
                <p>
                  {activePlan.assessment.estimatedTotalDuration} (~{profile.hours || 10} hours/week recommended)
                </p>
              </div>

              <div>
                <span className="eyebrow">MAJOR MILESTONES</span>
                <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '13px', color: '#475569', lineHeight: '1.8' }}>
                  {activePlan.assessment.majorMilestones.map((ms, mi) => (
                    <li key={mi} style={{ marginBottom: '6px' }}>
                      <strong>{ms}</strong>
                    </li>
                  ))}
                </ul>
                {activePlan.assessment.skillGapsIdentified && activePlan.assessment.skillGapsIdentified.length > 0 && (
                  <div style={{ marginTop: '14px' }}>
                    <small style={{ fontWeight: 600, color: '#b45309', display: 'block', textTransform: 'uppercase', fontSize: '11px' }}>
                      Target Skill Gaps
                    </small>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {activePlan.assessment.skillGapsIdentified.join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Curriculum Overview & Module List */}
          <div className="learning-section-heading">
            <div>
              <h2>Curriculum Modules</h2>
              <p>Work step-by-step through modules. Expand each section to inspect lessons, access verified links, and record completion.</p>
            </div>
            <span>
              {completedLessons} / {totalLessons} Total Lessons Completed
            </span>
          </div>

          <div className="curriculum-modules">
            {(activePlan.modules || []).map((mod, modIdx) => {
              const modTotal = mod.lessons.length;
              const modDone = mod.lessons.filter(l => Boolean(l.done)).length;
              const modPercent = modTotal > 0 ? Math.round((modDone / modTotal) * 100) : 0;
              const isModComplete = modTotal > 0 && modDone === modTotal;

              return (
                <details
                  className={`curriculum-module ${isModComplete ? 'is-complete' : ''}`}
                  key={mod.id || `mod-${modIdx}`}
                  open={modIdx === 0 || (!isModComplete && modDone > 0)}
                >
                  <summary>
                    <div className="curriculum-module-number">
                      {isModComplete ? <Check size={20} /> : String(modIdx + 1).padStart(2, '0')}
                    </div>

                    <div className="curriculum-module-heading">
                      <span className="eyebrow" style={{ color: isModComplete ? '#059669' : '#3b82f6' }}>
                        MODULE {modIdx + 1} · {isModComplete ? 'COMPLETED' : `${modDone}/${modTotal} COMPLETED`}
                      </span>
                      <h3>{mod.title}</h3>
                      <p>{mod.description}</p>

                      <div className="curriculum-module-meta">
                        <span>
                          <Clock3 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                          {mod.estimatedDuration}
                        </span>
                        <span>
                          <BookOpen size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                          {modDone} of {modTotal} lessons finished
                        </span>
                        <span>{modPercent}% module progress</span>
                      </div>

                      <Progress value={modPercent} className="plan-bar" style={{ height: '5px', maxWidth: '380px' }} />
                    </div>

                    <ChevronDown className="curriculum-chevron" size={20} />
                  </summary>

                  <div className="curriculum-module-body">
                    {mod.learningObjectives && mod.learningObjectives.length > 0 && (
                      <div className="curriculum-objectives">
                        <strong>Key Learning Objectives:</strong>
                        <ul>
                          {mod.learningObjectives.map((obj, oi) => (
                            <li key={oi}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Lessons inside this module */}
                    <div className="curriculum-lessons">
                      {mod.lessons.map((lesson, lesIdx) => {
                        const isLessonDone = Boolean(lesson.done);
                        return (
                          <article
                            className={`curriculum-lesson ${isLessonDone ? 'is-complete' : ''}`}
                            key={lesson.id || `${mod.id}-les-${lesIdx}`}
                          >
                            <div className="lesson-header-row">
                              <div className="lesson-title-group">
                                <div className="lesson-meta-chips">
                                  <span className="lesson-pill number">
                                    Lesson {modIdx + 1}.{lesIdx + 1}
                                  </span>
                                  <span className="lesson-pill">
                                    <Clock3 size={11} />
                                    {lesson.estimatedDuration}
                                  </span>
                                  {isLessonDone && (
                                    <span className="verified-tag">
                                      <Check size={11} style={{ display: 'inline', marginRight: '2px' }} />
                                      Done
                                    </span>
                                  )}
                                </div>
                                <h4>{lesson.title}</h4>
                              </div>

                              <button
                                type="button"
                                className={`lesson-complete-toggle ${isLessonDone ? 'completed' : 'pending'}`}
                                onClick={() => toggleLesson(mod.id, lesson.id)}
                                aria-label={isLessonDone ? `Mark lesson ${lesson.title} as incomplete` : `Mark lesson ${lesson.title} as complete`}
                              >
                                <Check size={14} />
                                {isLessonDone ? 'Completed' : 'Mark as complete'}
                              </button>
                            </div>

                            <div className="lesson-objective-box">
                              <strong>Learning Objective</strong>
                              {lesson.learningObjective}
                            </div>

                            {/* Verified Learning Resources for this lesson */}
                            {lesson.resources && lesson.resources.length > 0 && (
                              <div className="lesson-resources-container">
                                <span className="resource-label">Curated Lesson Material</span>
                                <div className="lesson-resources-list">
                                  {lesson.resources.map((res, ri) => (
                                    <a
                                      key={ri}
                                      href={res.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="lesson-resource-row"
                                    >
                                      <div className="lesson-resource-left">
                                        <div className={`lesson-resource-icon ${res.resourceType}`}>
                                          <ResourceIcon type={res.resourceType} />
                                        </div>
                                        <div className="lesson-resource-info">
                                          <strong>{res.title}</strong>
                                          <small>
                                            {res.provider} · {res.resourceType.toUpperCase()}
                                          </small>
                                        </div>
                                      </div>

                                      <div className="lesson-resource-right">
                                        {res.verified ? (
                                          <span className="verified-tag">Verified Resource</span>
                                        ) : (
                                          <span className="unverified-tag">Reference Link</span>
                                        )}
                                        <span className="open-link-cta">
                                          Open <ArrowUpRight size={14} />
                                        </span>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Hands-on practice task */}
                            {lesson.practiceTask && (
                              <div className="lesson-practice-card">
                                <div className="lesson-practice-card-header">
                                  <Code2 size={14} />
                                  Practical Exercise
                                </div>
                                <p style={{ margin: 0 }}>{lesson.practiceTask}</p>
                              </div>
                            )}

                            {/* Personal Notes */}
                            <div className="lesson-notes-area">
                              <details>
                                <summary>Personal notes &amp; project reflections</summary>
                                <textarea
                                  rows={2}
                                  placeholder="Record key takeaways, implementation roadblocks, or project links..."
                                  value={lesson.notes || ''}
                                  onChange={e => updateLessonNotes(mod.id, lesson.id, e.target.value)}
                                />
                              </details>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          {/* Interview & Career Prep Section (Retained for 100% backward compatibility & career readiness) */}
          {activePlan.interviewPrep && (
            <div className="interview-prep space-top">
              <div className="interview-prep-header">
                <div className="prep-header-content">
                  <span className="eyebrow">CAREER READINESS &amp; PREPARATION</span>
                  <h2>Interview &amp; Application Prep</h2>
                  <p>Role-specific technical questions, behavioral preparation, and checklist requirements.</p>
                </div>
                <div className="prep-header-badge" aria-hidden="true">
                  <FileText size={20} />
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
                    <span className="prep-count-badge">{activePlan.interviewPrep.technical.length} questions</span>
                  </div>
                  <div className="question-list">
                    {activePlan.interviewPrep.technical.map((q, i) => (
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
                    <span className="prep-count-badge">{activePlan.interviewPrep.behavioral.length} questions</span>
                  </div>
                  <div className="question-list">
                    {activePlan.interviewPrep.behavioral.map((q, i) => (
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
                      {activePlan.interviewPrep.resumeChecklist.filter((_, i) => checkedItems[`resume-${i}`]).length} /{' '}
                      {activePlan.interviewPrep.resumeChecklist.length} checked
                    </span>
                  </div>
                  <div className="checklist-items-container">
                    {activePlan.interviewPrep.resumeChecklist.map((c, i) => {
                      const key = `resume-${i}`;
                      const isChecked = Boolean(checkedItems[key]);
                      return (
                        <label key={key} className={`checklist-item-row ${isChecked ? 'completed' : ''}`}>
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleCheck(key)} />
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
                      {activePlan.interviewPrep.applicationChecklist.filter((_, i) => checkedItems[`app-${i}`]).length} /{' '}
                      {activePlan.interviewPrep.applicationChecklist.length} checked
                    </span>
                  </div>
                  <div className="checklist-items-container">
                    {activePlan.interviewPrep.applicationChecklist.map((c, i) => {
                      const key = `app-${i}`;
                      const isChecked = Boolean(checkedItems[key]);
                      return (
                        <label key={key} className={`checklist-item-row ${isChecked ? 'completed' : ''}`}>
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleCheck(key)} />
                          <span className="checklist-item-text">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="plan-footnote" style={{ marginTop: '24px' }}>
            Time estimates are planning suggestions based on your weekly study hours. Lesson completion is self-reported
            and structured for personal competency tracking.
          </p>
        </>
      ) : (
        /* Empty State */
        <div className="no-plan">
          <span className="action-symbol green">
            <Flag size={27} />
          </span>
          <div>
            <h2>Your personalized learning roadmap is waiting.</h2>
            <p>
              {goalDegree
                ? `Generate a comprehensive academic curriculum for ${goalDegree.name}.`
                : 'Choose a degree direction or analyze a job description to generate an AI-powered curriculum.'}
            </p>
          </div>
          <button
            className="button dark"
            onClick={() => (goalDegree ? onCreate(goalDegree.name, goalDegree.skills) : go('explore'))}
          >
            {goalDegree ? 'Create My Learning Roadmap' : 'Explore Degree Directions'}
            <ArrowRight size={17} />
          </button>
        </div>
      )}

      {/* Free Learning Bookshelf Catalogue */}
      <section className="resource-library space-top">
        <div className="section-heading">
          <div>
            <h2>Your learning bookshelf</h2>
            <p>Free open-access textbooks, interactive lessons, and video courses.</p>
          </div>
          <span className="catalogue-count">{resources.length} verified resources</span>
        </div>

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

        <div className="resource-grid">
          {catalogueList.map(r => (
            <article className="resource-card" key={r.id}>
              <div className="resource-top">
                <span className="resource-icon">
                  {r.format === 'Video' ? (
                    <Video size={21} />
                  ) : r.format === 'Textbook' ? (
                    <Library size={21} />
                  ) : (
                    <BookOpen size={21} />
                  )}
                </span>
                <span className="free-badge">{r.access}</span>
              </div>
              <small>{r.provider}</small>
              <h3>{r.title}</h3>
              <div className="tags">
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
              </div>
            </article>
          ))}
        </div>
        {!catalogueList.length && <Empty title="No resources found" text="Try a broader skill or another format." />}
        <p className="small-text muted space-top">
          Links lead to accredited university courseware and open educational repositories. Provider terms and syllabus
          versions apply.
        </p>
      </section>
    </div>
  );
}
