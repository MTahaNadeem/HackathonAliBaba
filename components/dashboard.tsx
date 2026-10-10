import {useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  GraduationCap,
  BriefcaseBusiness,
  Sparkles,
  Layers3,
  Check,
  Route,
  Clock3,
  UserRound,
  FileText,
  Search,
  BookOpen,
  Mail,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import {degrees, type Degree} from '@/lib/catalogue';
import {formatPKR, assessUniversity, emptyProfile, type Profile, type Plan} from '@/lib/domain';
import {Progress} from '@/components/ui/progress';

export interface DashboardProps {
  go: (id: string) => void;
  onChat: () => void;
  session?: Session | null;
  profile?: Profile;
  plan?: Plan | null;
  onStartPlan?: (goal: string, skills: string[]) => void;
  onSignIn?: () => void;
}

export default function Dashboard({
  go,
  onChat,
  session,
  profile = emptyProfile,
  plan = null,
  onStartPlan,
  onSignIn
}: DashboardProps) {
  const [showGuide, setShowGuide] = useState(false);

  // If user is signed in and has not toggled to view the exploration guide, show the Personalized Dashboard
  if (session && !showGuide) {
    const goal = degrees.find(d => d.id === profile.goal);
    const completed = plan?.milestones.filter(m => m.done).length || 0;
    const total = plan?.milestones.length || 0;
    const nextMilestone = plan?.milestones.find(m => !m.done);

    const hasAcademicMarks =
      typeof profile.ssc === 'number' &&
      typeof profile.hssc === 'number' &&
      !isNaN(profile.ssc) &&
      !isNaN(profile.hssc);

    const aggregate =
      hasAcademicMarks && typeof profile.net === 'number' && !isNaN(profile.net)
        ? Math.round((profile.ssc! * 0.1 + profile.hssc! * 0.15 + profile.net * 0.75) * 100) / 100
        : null;

    const displayName = profile.name?.trim();
    const hasAnyActivity = Boolean(plan || profile.skills.length > 0 || profile.interests.length > 0 || goal);

    return (
      <div className="personalized-dashboard" aria-label="Personalized Dashboard">
        {/* ── 1. Welcome Header Card ──────────────────────────────── */}
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR WORKSPACE</div>
            <h1>
              {displayName ? `Welcome back, ${displayName}!` : 'Welcome back!'}
            </h1>
            <p>Pick up where you left off and take your next step forward.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="catalogue-count">
              {session.user?.email || 'Account connected'}
            </span>
            <button
              className="button outline"
              onClick={() => setShowGuide(true)}
              title="Browse platform exploration guide"
            >
              <Compass size={16} />
              Exploration guide
            </button>
          </div>
        </div>

        {/* ── 2. Active Track Card ("Continue where you left off") ── */}
        <div style={{ marginBottom: '34px' }}>
          {plan ? (
            <section className="learning-plan" style={{ marginBottom: 0 }}>
              <div className="plan-header">
                <div>
                  <span className="light-label">Continue where you left off</span>
                  <h2>{plan.title}</h2>
                  <p>
                    <Clock3 size={15} />
                    {plan.hoursPerWeek} hours / week · approximately{' '}
                    {Math.ceil(plan.milestones.reduce((a, m) => a + m.hours, 0) / plan.hoursPerWeek)} weeks
                  </p>
                </div>
                <div className="plan-progress">
                  <strong>
                    {completed}
                    <span> / {total}</span>
                  </strong>
                  <span>{completed} of {total} steps completed</span>
                  <Progress value={total ? (completed / total) * 100 : 0} className="plan-bar" />
                </div>
              </div>

              {nextMilestone && (
                <div className="milestones" style={{ padding: '20px 32px' }}>
                  <article className="milestone" style={{ borderBottom: 'none', padding: '4px 0' }}>
                    <span className="milestone-number">
                      {completed + 1}
                    </span>
                    <div className="milestone-content">
                      <div className="milestone-title">
                        <div>
                          <span className="eyebrow">UP NEXT · {nextMilestone.skill}</span>
                          <h3>{nextMilestone.title}</h3>
                        </div>
                        <span className="time-pill">
                          <Clock3 size={13} />
                          {nextMilestone.hours}h estimated
                        </span>
                      </div>
                      <div className="practice-task">
                        <strong>Make it practical</strong>
                        <p>{nextMilestone.practice}</p>
                      </div>
                    </div>
                  </article>
                </div>
              )}

              <div
                className="journey-footer"
                style={{
                  background: 'var(--midnight)',
                  padding: '20px 32px',
                  borderTop: '1px solid #355073',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}
              >
                <button className="button mint" onClick={() => go('learning')}>
                  Resume my roadmap <ArrowRight size={17} />
                </button>
                <button
                  className="button outline"
                  style={{ background: 'transparent', color: '#fff', borderColor: '#4a6589' }}
                  onClick={() => go('jobs')}
                >
                  Check skill gaps <BriefcaseBusiness size={16} />
                </button>
              </div>
            </section>
          ) : goal ? (
            <div className="current-direction" style={{ margin: 0 }}>
              <span className="direction-icon">
                <Compass size={24} />
              </span>
              <div>
                <small>CONTINUE WHERE YOU LEFT OFF · YOUR CHOSEN DIRECTION</small>
                <strong>{goal.name}</strong>
                <span>
                  {goal.tagline || `Focusing on ${goal.field}. Ready to build your learning plan or find campuses.`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                <button
                  className="button dark"
                  onClick={() => (onStartPlan ? onStartPlan(goal.name, goal.skills) : go('learning'))}
                >
                  Build learning plan <ArrowRight size={17} />
                </button>
                <button className="button outline" onClick={() => go('universities')}>
                  Find universities <GraduationCap size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="no-plan" style={{ margin: 0 }}>
              <span className="action-symbol green">
                <Sparkles size={27} />
              </span>
              <div>
                <h2>Start shaping your next chapter</h2>
                <p>
                  You haven&apos;t chosen an academic direction or created a career roadmap yet. Begin by exploring degrees or analyzing a job brief.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
                <button className="button dark" onClick={() => go('explore')}>
                  Explore degree paths <Compass size={16} />
                </button>
                <button className="button outline" onClick={() => go('jobs')}>
                  Analyze a job brief <BriefcaseBusiness size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Two Pathway Cards Side by Side (Stacked on Mobile) ── */}
        <section className="journey-decision-section" aria-labelledby="pathways-heading">
          <div className="section-heading" style={{ marginBottom: '22px' }}>
            <div>
              <h2 id="pathways-heading">Your journey</h2>
              <p>Explore academic admissions and career roadmaps as distinct options.</p>
            </div>
            <span className="subtle-pill">TWO PATHWAYS</span>
          </div>

          <div className="journey-decision-grid">
            {/* Card 1: Academic Pathway */}
            <article className="primary-journey-card student-card">
              <div className="journey-card-header">
                <div className="journey-icon-wrap student" aria-hidden="true">
                  <GraduationCap size={26} />
                </div>
                <span className="journey-badge student">Academic Pathway</span>
              </div>
              <h2>Education Journey</h2>
              <p className="journey-desc">
                {goal ? `Targeting ${goal.name} in ${goal.field}.` : 'Degree direction, university admissions, and eligibility criteria.'}
              </p>

              <div
                className="university-facts"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  padding: '16px 0',
                  borderTop: '1px solid #edf1f7',
                  borderBottom: '1px solid #edf1f7',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <small>CHOSEN DIRECTION</small>
                  <strong>{goal ? goal.name : 'No degree selected yet'}</strong>
                  <span>{goal ? goal.field : 'Explore degrees to choose a field'}</span>
                </div>
                <div>
                  <small>QUALIFICATION &amp; SUBJECTS</small>
                  <strong>{profile.qualification}</strong>
                  <span>
                    {profile.subjects.length > 0
                      ? `${profile.subjects.slice(0, 3).join(', ')}${profile.subjects.length > 3 ? ` +${profile.subjects.length - 3} more` : ''}`
                      : 'No subjects recorded'}
                  </span>
                </div>
                <div>
                  <small>ADMISSION READINESS</small>
                  {hasAcademicMarks ? (
                    <>
                      <strong>SSC: {profile.ssc}% · HSSC: {profile.hssc}%</strong>
                      <span>
                        {aggregate !== null
                          ? `Standard NET Aggregate: ${aggregate}%`
                          : 'Add NET score in profile to estimate aggregate'}
                      </span>
                    </>
                  ) : (
                    <span>Add SSC &amp; HSSC results in profile to assess eligibility</span>
                  )}
                </div>
                <div>
                  <small>SEMESTER BUDGET</small>
                  <strong>
                    {typeof profile.budget === 'number' && !isNaN(profile.budget)
                      ? `${formatPKR(profile.budget)} / semester`
                      : 'Budget not set'}
                  </strong>
                  <span>Tuition and mandatory charges</span>
                </div>
              </div>

              <div className="journey-card-footer">
                <button
                  className="button journey-cta-btn student"
                  onClick={() => go('universities')}
                >
                  <span>Find University Programs</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </article>

            {/* Card 2: Career Roadmap */}
            <article className="primary-journey-card career-card">
              <div className="journey-card-header">
                <div className="journey-icon-wrap career" aria-hidden="true">
                  <BriefcaseBusiness size={25} />
                </div>
                <span className="journey-badge career">Career Roadmap</span>
              </div>
              <h2>Career Journey</h2>
              <p className="journey-desc">
                {plan ? plan.title : 'Target roles, recognized skill profile, and practical learning milestones.'}
              </p>

              <div
                className="university-facts"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  padding: '16px 0',
                  borderTop: '1px solid #edf1f7',
                  borderBottom: '1px solid #edf1f7',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <small>TARGET ROLE / GOAL</small>
                  <strong>
                    {plan
                      ? plan.goal
                      : profile.skills.length > 0
                      ? 'Target skill development'
                      : 'No target role set yet'}
                  </strong>
                  <span>{plan ? `${plan.hoursPerWeek} hrs/week active practice` : 'Paste a job description to target a role'}</span>
                </div>
                <div>
                  <small>SELF-REPORTED SKILLS</small>
                  <strong>{profile.skills.length} skills in profile</strong>
                  <div className="tags" style={{ marginTop: '6px' }}>
                    {profile.skills.length > 0 ? (
                      profile.skills.slice(0, 4).map(s => <span key={s}>{s}</span>)
                    ) : (
                      <span style={{ color: 'var(--secondary)' }}>No skills recorded yet</span>
                    )}
                  </div>
                </div>
                <div>
                  <small>ROADMAP COMPLETION</small>
                  {plan ? (
                    <>
                      <strong>{completed} of {total} milestones complete</strong>
                      <span>{total - completed > 0 ? `${total - completed} steps remaining` : 'All current steps completed'}</span>
                    </>
                  ) : (
                    <span>No active roadmap created yet</span>
                  )}
                </div>
                <div>
                  <small>WEEKLY COMMITMENT</small>
                  <strong>{profile.hours} hours / week</strong>
                  <span>Estimated study and practice time</span>
                </div>
              </div>

              <div className="journey-card-footer">
                <button
                  className="button journey-cta-btn career"
                  onClick={() => go('jobs')}
                >
                  <span>Explore Careers &amp; Analyze Job</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* ── 4. Quick Actions Grid ──────────────────────────────── */}
        <section className="next-actions" aria-labelledby="quick-actions-heading" style={{ marginTop: '36px' }}>
          <div className="section-heading">
            <div>
              <h2 id="quick-actions-heading">Quick actions</h2>
              <p>Jump directly to active features in your workspace.</p>
            </div>
            <span className="subtle-pill">EXPLORATION SHORTCUTS</span>
          </div>

          <div className="action-grid">
            <button className="action-card" onClick={() => go('universities')}>
              <div className="action-symbol blue">
                <GraduationCap size={25} />
              </div>
              <h3>Find university programs</h3>
              <p>Campuses, programs, and verified semester tuition.</p>
              <div className="card-footer">
                <span>Explore campuses</span>
                <ArrowUpRight size={19} />
              </div>
            </button>

            <button className="action-card" onClick={() => go('universities')}>
              <div className="action-symbol green">
                <ShieldCheck size={25} />
              </div>
              <h3>Check admission eligibility</h3>
              <p>Review academic criteria and calculate NET aggregate.</p>
              <div className="card-footer">
                <span>Check eligibility</span>
                <ArrowUpRight size={19} />
              </div>
            </button>

            <button className="action-card" onClick={() => go('jobs')}>
              <div className="action-symbol peach">
                <BriefcaseBusiness size={25} />
              </div>
              <h3>Explore career options</h3>
              <p>Browse role briefs and typical industry requirements.</p>
              <div className="card-footer">
                <span>Browse roles</span>
                <ArrowUpRight size={19} />
              </div>
            </button>

            <button className="action-card" onClick={() => go('jobs')}>
              <div className="action-symbol blue">
                <FileText size={25} />
              </div>
              <h3>Analyze a target job</h3>
              <p>Paste a job description to discover your skill gaps.</p>
              <div className="card-footer">
                <span>Decode job</span>
                <ArrowUpRight size={19} />
              </div>
            </button>

            <button className="action-card" onClick={() => go('learning')}>
              <div className="action-symbol green">
                <Route size={25} />
              </div>
              <h3>View my roadmap</h3>
              <p>Track practical milestones and access free resources.</p>
              <div className="card-footer">
                <span>Open roadmap</span>
                <ArrowUpRight size={19} />
              </div>
            </button>

            <button className="action-card" onClick={() => go('profile')}>
              <div className="action-symbol peach">
                <SlidersHorizontal size={25} />
              </div>
              <h3>Edit my profile</h3>
              <p>Update qualification, marks, budget, and skills.</p>
              <div className="card-footer">
                <span>Manage settings</span>
                <ArrowUpRight size={19} />
              </div>
            </button>
          </div>
        </section>

        {/* ── 5. Progress Overview Card ──────────────────────────── */}
        <section className="form-section" aria-labelledby="progress-heading" style={{ marginTop: '36px' }}>
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2 id="progress-heading">Progress overview</h2>
              <p>
                {hasAnyActivity
                  ? 'Metrics strictly derived from your actual saved account data.'
                  : 'No activity saved yet. Metrics will update as you choose goals, complete milestones, or log skills.'}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '18px'
            }}
          >
            <div
              style={{
                background: '#f6f9fc',
                padding: '20px 22px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#657b98', fontWeight: '700' }}>
                ROADMAP MILESTONES
              </span>
              <strong style={{ fontSize: '28px', color: 'var(--midnight)', margin: '4px 0 2px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {plan ? `${completed} / ${total}` : '0'}
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--secondary)' }}>
                {plan
                  ? `${total ? Math.round((completed / total) * 100) : 0}% completed`
                  : 'No active roadmap created'}
              </span>
            </div>

            <div
              style={{
                background: '#f6f9fc',
                padding: '20px 22px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#657b98', fontWeight: '700' }}>
                SKILLS REPORTED
              </span>
              <strong style={{ fontSize: '28px', color: 'var(--midnight)', margin: '4px 0 2px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {profile.skills.length}
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--secondary)' }}>
                {profile.skills.length > 0
                  ? profile.skills.slice(0, 3).join(', ')
                  : 'Add skills in My Profile'}
              </span>
            </div>

            <div
              style={{
                background: '#f6f9fc',
                padding: '20px 22px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#657b98', fontWeight: '700' }}>
                CURIOSITY INTERESTS
              </span>
              <strong style={{ fontSize: '28px', color: 'var(--midnight)', margin: '4px 0 2px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {profile.interests.length}
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--secondary)' }}>
                {profile.interests.length > 0
                  ? profile.interests.slice(0, 2).join(', ')
                  : 'Select interests in My Profile'}
              </span>
            </div>

            <div
              style={{
                background: '#f6f9fc',
                padding: '20px 22px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '11px', letterSpacing: '1px', color: '#657b98', fontWeight: '700' }}>
                CHOSEN DIRECTION
              </span>
              <strong
                style={{
                  fontSize: '20px',
                  color: 'var(--midnight)',
                  margin: '8px 0 2px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {goal ? goal.name : 'Not set'}
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--secondary)' }}>
                {goal ? goal.field : 'Explore degrees to choose a path'}
              </span>
            </div>
          </div>
        </section>

        {/* ── 6. Career Companion CTA Card ───────────────────────── */}
        <section
          className="adviser-card"
          aria-labelledby="adviser-heading"
          style={{ marginTop: '36px', width: '100%' }}
        >
          <div className="adviser-symbol">
            <Sparkles size={26} />
          </div>
          <span className="eyebrow">MEET YOUR CAREER COMPANION</span>
          <h2 id="adviser-heading">
            Big questions.<br />A little guidance.
          </h2>
          <p>Degrees, skills, or that “what next?” feeling. Let’s work through it together.</p>
          <button className="button dark" onClick={onChat} style={{ minWidth: '220px' }}>
            Ask CourseCompass AI <Sparkles size={17} />
          </button>
        </section>
      </div>
    );
  }

  // ── Guest Homepage / Public Landing Experience ─────────────────
  // (Also rendered when signed in if showGuide is true, or in test suites)
  return (
    <>
      {session && showGuide && (
        <div className="inline-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <span>You are viewing the platform exploration guide.</span>
          <button className="button dark" onClick={() => setShowGuide(false)} style={{ minHeight: '36px', padding: '8px 14px' }}>
            Return to my personalized dashboard <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* ── A. Refined Hero Section ────────────────────────────── */}
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-content">
          <div className="hero-brand-badge">
            <span className="brand-dot-pulse" aria-hidden="true" />
            <span className="hero-brand-name">CourseCompass AI</span>
            <span className="hero-brand-sep" aria-hidden="true">·</span>
            <span className="hero-brand-tagline">Guided education &amp; career navigator</span>
          </div>
          <h1 id="hero-title" className="hero-heading">
            Your future, with a <span>clearer direction.</span>
          </h1>
          <p className="hero-subtext">
            Whether you&apos;re choosing a university or preparing for your next job, start with where you are.
          </p>
        </div>
        <div className="hero-action">
          <button className="button outline" onClick={() => go('profile')}>
            Personalise my path <ArrowUpRight size={17} />
          </button>
        </div>
      </section>

      {/* ── B. Two Primary Journey Cards ──────────────────────── */}
      <section className="journey-decision-section" aria-label="Choose your journey">
        <div className="journey-decision-grid">
          {/* Card 1: I'm a Student */}
          <article className="primary-journey-card student-card">
            <div className="journey-card-header">
              <div className="journey-icon-wrap student" aria-hidden="true">
                <GraduationCap size={26} />
              </div>
              <span className="journey-badge student">Academic Pathway</span>
            </div>
            <h2>I&apos;m a Student</h2>
            <p className="journey-desc">
              Find universities and degrees that match your marks, subjects, interests, and budget.
            </p>
            <ul className="journey-highlights" aria-label="Student journey features">
              <li className="journey-highlight-item">
                <Check size={16} aria-hidden="true" />
                <span>Degree &amp; discipline matching for your subjects</span>
              </li>
              <li className="journey-highlight-item">
                <Check size={16} aria-hidden="true" />
                <span>Admission eligibility, entry tests &amp; merit criteria</span>
              </li>
              <li className="journey-highlight-item">
                <Check size={16} aria-hidden="true" />
                <span>Verified university fees &amp; semester budget checks</span>
              </li>
            </ul>
            <div className="journey-card-footer">
              <button
                className="button journey-cta-btn student"
                onClick={() => go('explore')}
                aria-label="Explore My Options - Student journey"
              >
                <span>Explore My Options</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </article>

          {/* Card 2: I'm Building My Career */}
          <article className="primary-journey-card career-card">
            <div className="journey-card-header">
              <div className="journey-icon-wrap career" aria-hidden="true">
                <BriefcaseBusiness size={25} />
              </div>
              <span className="journey-badge career">Career Roadmap</span>
            </div>
            <h2>I&apos;m Building My Career</h2>
            <p className="journey-desc">
              Discover the skills, courses, and projects you need for your target job.
            </p>
            <ul className="journey-highlights" aria-label="Career journey features">
              <li className="journey-highlight-item">
                <Check size={16} aria-hidden="true" />
                <span>Target role briefs &amp; in-demand skill requirements</span>
              </li>
              <li className="journey-highlight-item">
                <Check size={16} aria-hidden="true" />
                <span>Job description skill-gap analyzer with your profile</span>
              </li>
              <li className="journey-highlight-item">
                <Check size={16} aria-hidden="true" />
                <span>Step-by-step practical learning roadmaps with free resources</span>
              </li>
            </ul>
            <div className="journey-card-footer">
              <button
                className="button journey-cta-btn career"
                onClick={() => go('jobs')}
                aria-label="Build My Career Path - Career journey"
              >
                <span>Build My Career Path</span>
                <ArrowRight size={17} />
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* ── C. Connected Path & Career Companion ──────────────── */}
      <div className="dashboard-grid">
        <section className="journey-panel" aria-labelledby="path-heading">
          <div className="panel-top">
            <span className="light-label"><span className="status-dot" />YOUR PERSONAL PATH</span>
            <span className="chapter">Chapter 01 / Explore</span>
          </div>
          <h2 id="path-heading">You don’t need every answer.<br />Just your <em>next step.</em></h2>
          <p>Connect what you enjoy with what you could become.</p>
          <div className="path-map">
            <div className="path-node">
              <span className="node-symbol"><GraduationCap size={25} /></span>
              <small>DISCOVER</small>
              <strong>A degree you love</strong>
            </div>
            <div className="path-link"><span /><ArrowRight size={16} /><span /></div>
            <div className="path-node">
              <span className="node-symbol"><BriefcaseBusiness size={24} /></span>
              <small>ENVISION</small>
              <strong>Work that fits you</strong>
            </div>
            <div className="path-link"><span /><ArrowRight size={16} /><span /></div>
            <div className="path-node next">
              <span className="node-symbol"><Layers3 size={24} /></span>
              <small>BUILD</small>
              <strong>Skills to get there</strong>
            </div>
          </div>
          <div className="journey-footer">
            <button className="button mint" onClick={() => go('explore')}>
              Find my starting point <ArrowRight size={18} />
            </button>
            <span>At your pace. On your terms.</span>
          </div>
        </section>

        <section className="adviser-card" aria-labelledby="adviser-heading">
          <div className="adviser-symbol"><Sparkles size={26} /></div>
          <span className="eyebrow">MEET YOUR CAREER COMPANION</span>
          <h2 id="adviser-heading">Big questions.<br />A little guidance.</h2>
          <p>Degrees, skills, or that “what next?” feeling. Let’s work through it together.</p>
          <button className="chat-prompt" onClick={onChat}>
            “I’m not sure what to study.”<ArrowUpRight size={17} />
          </button>
          <button className="button dark full" onClick={onChat}>
            Let’s find your direction <Sparkles size={17} />
          </button>
          <small>Made for your journey, wherever it starts.</small>
        </section>
      </div>

      {/* ── D. Exploration Toolkit ────────────────────────────── */}
      <section className="next-actions" aria-labelledby="toolkit-heading">
        <div className="section-heading">
          <div>
            <h2 id="toolkit-heading">A few ways forward</h2>
            <p>You’re allowed to explore more than one possibility.</p>
          </div>
          <span className="subtle-pill">YOUR EXPLORATION TOOLKIT</span>
        </div>
        <div className="action-grid">
          {[
            {label:'Discover your degree',text:'From arts to engineering. Find a field that fits how you think.',icon:Compass,id:'explore',color:'blue',meta:'Explore possibilities'},
            {label:'Find your university',text:'Your ambitions, your city, your budget. Bring them together.',icon:GraduationCap,id:'universities',color:'green',meta:'Explore campuses'},
            {label:'Turn gaps into goals',text:'Bring a job description. Leave with a practical learning plan.',icon:BriefcaseBusiness,id:'jobs',color:'peach',meta:'Understand your skills'}
          ].map(a => (
            <button className="action-card" key={a.id} onClick={() => go(a.id)}>
              <div className={`action-symbol ${a.color}`}><a.icon size={25} /></div>
              <h3>{a.label}</h3>
              <p>{a.text}</p>
              <div className="card-footer">
                <span>{a.meta}</span>
                <ArrowUpRight size={19} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}