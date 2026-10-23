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
  Target,
  RefreshCw,
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

function ResourceIconBadge({ type }: { type: LessonResource['resourceType'] }) {
  const styles: Record<string, { bg: string; color: string; icon: typeof BookOpen }> = {
    video: { bg: '#fee2e2', color: '#dc2626', icon: Video },
    documentation: { bg: '#f3e8ff', color: '#9333ea', icon: Library },
    exercise: { bg: '#dcfce7', color: '#16a34a', icon: Code2 },
    article: { bg: '#e0f2fe', color: '#0284c7', icon: FileText },
    course: { bg: '#dbeafe', color: '#2563eb', icon: BookOpen }
  };
  const config = styles[type] || styles.course;
  const IconComponent = config.icon;

  return (
    <div
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: config.bg,
        color: config.color,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }}
    >
      <IconComponent size={18} />
    </div>
  );
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
                  style={{
                    background: '#ffffff',
                    border: isModComplete ? '1px solid #86efac' : '1px solid #e2e8f0',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    marginBottom: '20px',
                    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)'
                  }}
                >
                  <summary
                    style={{
                      padding: '24px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '18px',
                      cursor: 'pointer',
                      listStyle: 'none'
                    }}
                  >
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        background: isModComplete ? '#ecfdf5' : '#eff6ff',
                        color: isModComplete ? '#059669' : '#2563eb',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        fontWeight: 700,
                        fontSize: '14px'
                      }}
                    >
                      {isModComplete ? <Check size={22} /> : String(modIdx + 1).padStart(2, '0')}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          color: isModComplete ? '#059669' : '#2563eb',
                          display: 'block',
                          marginBottom: '3px'
                        }}
                      >
                        MODULE {modIdx + 1} · {isModComplete ? 'COMPLETED' : `${modDone}/${modTotal} COMPLETED`}
                      </span>
                      <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.4px' }}>
                        {mod.title}
                      </h3>
                      <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                        {mod.description}
                      </p>

                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Clock3 size={13} style={{ color: '#3b82f6' }} />
                          {mod.estimatedDuration}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <BookOpen size={13} style={{ color: '#10b981' }} />
                          {modDone} of {modTotal} lessons finished
                        </span>
                        <span style={{ fontWeight: 600, color: isModComplete ? '#059669' : '#1e293b' }}>
                          {modPercent}% module progress
                        </span>
                      </div>

                      <Progress value={modPercent} className="plan-bar" style={{ height: '6px', maxWidth: '400px' }} />
                    </div>

                    <ChevronDown className="curriculum-chevron" size={20} style={{ color: '#64748b', marginTop: '12px' }} />
                  </summary>

                  <div
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      padding: '24px',
                      background: '#f8fafc'
                    }}
                  >
                    {mod.learningObjectives && mod.learningObjectives.length > 0 && (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          marginBottom: '20px'
                        }}
                      >
                        <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                          Key Learning Objectives:
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: '#475569', lineHeight: 1.7 }}>
                          {mod.learningObjectives.map((obj, oi) => (
                            <li key={oi} style={{ marginBottom: '4px' }}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Lessons inside this module */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {mod.lessons.map((lesson, lesIdx) => {
                        const isLessonDone = Boolean(lesson.done);
                        return (
                          <article
                            key={lesson.id || `${mod.id}-les-${lesIdx}`}
                            style={{
                              background: isLessonDone ? '#f8fdfa' : '#ffffff',
                              border: isLessonDone ? '1px solid #86efac' : '1px solid #e2e8f0',
                              borderRadius: '16px',
                              padding: '22px 24px',
                              boxShadow: isLessonDone
                                ? '0 2px 8px rgba(16, 185, 129, 0.08)'
                                : '0 2px 8px rgba(15, 23, 42, 0.04)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {/* Header row: Title + Meta vs Completion button */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '16px',
                                marginBottom: '14px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span
                                    style={{
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      padding: '3px 9px',
                                      borderRadius: '6px',
                                      fontWeight: 650,
                                      fontSize: '11.5px',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    Lesson {modIdx + 1}.{lesIdx + 1}
                                  </span>
                                  <span
                                    style={{
                                      background: '#f1f5f9',
                                      color: '#475569',
                                      padding: '3px 9px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Clock3 size={12} />
                                    {lesson.estimatedDuration}
                                  </span>
                                  {isLessonDone && (
                                    <span
                                      style={{
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        border: '1px solid #a7f3d0',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '11.5px',
                                        fontWeight: 650,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Check size={12} /> Done
                                    </span>
                                  )}
                                </div>
                                <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.4 }}>
                                  {lesson.title}
                                </h4>
                              </div>

                              {/* Interactive Completion Toggle Button */}
                              <button
                                type="button"
                                onClick={() => toggleLesson(mod.id, lesson.id)}
                                aria-label={isLessonDone ? `Mark lesson ${lesson.title} as incomplete` : `Mark lesson ${lesson.title} as complete`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '9px 18px',
                                  borderRadius: '10px',
                                  fontSize: '13px',
                                  fontWeight: 650,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  transition: 'all 0.18s ease',
                                  background: isLessonDone ? '#10b981' : '#ffffff',
                                  color: isLessonDone ? '#ffffff' : '#334155',
                                  border: isLessonDone ? '1px solid #059669' : '1px solid #cbd5e1',
                                  boxShadow: isLessonDone
                                    ? '0 2px 8px rgba(16, 185, 129, 0.28)'
                                    : '0 1px 3px rgba(0, 0, 0, 0.05)'
                                }}
                              >
                                <Check size={15} style={{ strokeWidth: 2.5 }} />
                                {isLessonDone ? 'Completed' : 'Mark as complete'}
                              </button>
                            </div>

                            {/* Learning Objective Box */}
                            <div
                              style={{
                                background: '#f8fafc',
                                borderLeft: '4px solid #3b82f6',
                                borderRadius: '0 10px 10px 0',
                                padding: '12px 16px',
                                marginBottom: '14px',
                                fontSize: '13.5px',
                                lineHeight: 1.6,
                                color: '#334155'
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.8px',
                                  color: '#1d4ed8',
                                  marginBottom: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <Target size={13} /> Learning Objective
                              </div>
                              <span style={{ display: 'block' }}>{lesson.learningObjective}</span>
                            </div>

                            {/* Verified Learning Resources for this lesson */}
                            {lesson.resources && lesson.resources.length > 0 && (
                              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.8px',
                                    color: '#64748b',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  <BookOpen size={12} /> Curated Learning Material
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {lesson.resources.map((res, ri) => (
                                    <a
                                      key={ri}
                                      href={res.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '14px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        background: '#ffffff',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        transition: 'all 0.18s ease'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                        <ResourceIconBadge type={res.resourceType} />
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                          <strong style={{ fontSize: '14px', color: '#0f172a', fontWeight: 650, lineHeight: 1.4 }}>
                                            {res.title}
                                          </strong>
                                          <small style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                            {res.provider} · <span style={{ fontWeight: 600, color: '#3b82f6' }}>{res.resourceType.toUpperCase()}</span>
                                          </small>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                        {res.verified ? (
                                          <span
                                            style={{
                                              background: '#ecfdf5',
                                              color: '#059669',
                                              border: '1px solid #a7f3d0',
                                              fontSize: '11px',
                                              fontWeight: 650,
                                              padding: '3px 8px',
                                              borderRadius: '6px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px'
                                            }}
                                          >
                                            <Check size={11} /> Verified Resource
                                          </span>
                                        ) : (
                                          <span
                                            style={{
                                              background: '#f8fafc',
                                              color: '#64748b',
                                              border: '1px solid #e2e8f0',
                                              fontSize: '11px',
                                              padding: '3px 8px',
                                              borderRadius: '6px'
                                            }}
                                          >
                                            Reference Link
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12.5px',
                                            fontWeight: 650,
                                            color: '#2563eb',
                                            background: '#eff6ff',
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #dbeafe'
                                          }}
                                        >
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
                              <div
                                style={{
                                  background: '#fffbeb',
                                  border: '1px solid #fef3c7',
                                  borderLeft: '4px solid #f59e0b',
                                  borderRadius: '0 10px 10px 0',
                                  padding: '12px 16px',
                                  marginTop: '14px',
                                  fontSize: '13px',
                                  lineHeight: 1.6,
                                  color: '#92400e'
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.8px',
                                    color: '#b45309',
                                    marginBottom: '3px'
                                  }}
                                >
                                  <Code2 size={14} /> Practical Exercise
                                </div>
                                <p style={{ margin: 0, color: '#78350f', fontSize: '13.5px' }}>{lesson.practiceTask}</p>
                              </div>
                            )}

                            {/* Personal Notes */}
                            <div style={{ marginTop: '14px' }}>
                              <details
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  padding: '10px 14px'
                                }}
                              >
                                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={13} /> Personal notes &amp; project reflections
                                </summary>
                                <textarea
                                  rows={2}
                                  placeholder="Record key takeaways, implementation roadblocks, or project links..."
                                  value={lesson.notes || ''}
                                  onChange={e => updateLessonNotes(mod.id, lesson.id, e.target.value)}
                                  style={{
                                    marginTop: '8px',
                                    width: '100%',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    fontSize: '13px',
                                    color: '#1e293b',
                                    background: '#ffffff',
                                    resize: 'vertical',
                                    lineHeight: 1.6
                                  }}
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
