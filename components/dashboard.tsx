import type {RecommendationResult} from '@/lib/ai/recommendation-engine';
import {useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {
  ArrowUpRight,
  ArrowRight,
  Compass,
  GraduationCap,
  BriefcaseBusiness,
  Sparkles,
  Check,
  Route,
  Clock3,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  SlidersHorizontal,
  Info,
  MapPin,
  RefreshCw,
  CheckCircle,
  Coins,
  BookOpen,
  Scale
} from 'lucide-react';
import {degrees, universities as catalogueUniversities, type Degree, type University, type VerificationStatus} from '@/lib/catalogue';
import {assessUniversity, calculateUniversityFit, emptyProfile, rankTopDegrees, rankTopUniversities, type Profile, type Plan} from '@/lib/domain';
import {Progress} from '@/components/ui/progress';
import UniversityCompareDialog from '@/components/university-compare-dialog';

// ── SVG Radial Progress Ring
function ProgressRing({
  pct, size = 148, stroke = 12, label, sublabel,
  color = '#3264d6', trackColor = '#e2e8f1', emptyState = false,
}: {
  pct: number; size?: number; stroke?: number; label: string;
  sublabel?: string; color?: string; trackColor?: string; emptyState?: boolean;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const safeOffset = circ - (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  const cx = size / 2;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${pct}% roadmap completion`} role="img" style={{display: 'block'}}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {!emptyState && pct > 0 && (
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={safeOffset}
            transform={`rotate(-90 ${cx} ${cx})`}
            style={{transition: 'stroke-dashoffset 0.65s cubic-bezier(.16,1,.3,1)'}}
          />
        )}
        <text x={cx} y={cx - (sublabel ? 10 : 0)} textAnchor="middle" dominantBaseline="middle"
          fontSize={emptyState ? '18' : '28'} fontWeight="700"
          fontFamily="'Plus Jakarta Sans', sans-serif" fill={emptyState ? '#8097b2' : '#142d52'}>
          {emptyState ? 'No plan' : label}
        </text>
        {sublabel && !emptyState && (
          <text x={cx} y={cx + 18} textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fontWeight="500" fill="#657b98" fontFamily="'DM Sans', sans-serif">
            {sublabel}
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Compact stat block with optional progress bar
function StatBlock({value, label, sub, numerator, denominator, accent = '#3264d6'}: {
  value: string; label: string; sub?: string; numerator?: number; denominator?: number; accent?: string;
}) {
  const hasBar = typeof numerator === 'number' && typeof denominator === 'number' && denominator > 0;
  const barPct = hasBar ? Math.min(100, Math.round((numerator! / denominator!) * 100)) : 0;
  return (
    <div className="db-stat-block">
      <span className="db-stat-label">{label}</span>
      <strong className="db-stat-value">{value}</strong>
      {sub && <span className="db-stat-sub">{sub}</span>}
      {hasBar && (
        <div className="db-stat-bar-track">
          <div className="db-stat-bar-fill" style={{width: `${barPct}%`, background: accent}} />
        </div>
      )}
    </div>
  );
}

// ── Status pill (reuses existing verification-badge CSS)
function StatusPill({status}: {status: VerificationStatus | undefined}) {
  if (status === 'live_refreshed') return <span className="verification-badge live-refreshed" style={{fontSize: '10px', padding: '3px 7px'}}><RefreshCw size={10} />Live</span>;
  if (status === 'stale') return <span className="verification-badge stale" style={{fontSize: '10px', padding: '3px 7px'}}><AlertCircle size={10} />Stale</span>;
  if (status === 'needs_information') return <span className="verification-badge needs-info" style={{fontSize: '10px', padding: '3px 7px'}}><HelpCircle size={10} />Check</span>;
  return <span className="verification-badge manual-snapshot" style={{fontSize: '10px', padding: '3px 7px'}}><CheckCircle size={10} />Verified</span>;
}

export interface DashboardProps {
  go: (id: string) => void;
  onChat: () => void;
  session?: Session | null;
  profile?: Profile;
  plan?: Plan | null;
  onStartPlan?: (goal: string, skills: string[]) => void;
  onSignIn?: () => void;
  onStartStudentOnboarding?: () => void;
  onSelectDegree?: (degreeId: string) => void;
  liveUniversities?: University[];
  recommendations?: RecommendationResult;
}

export default function Dashboard({
  go,
  onChat,
  session,
  profile = emptyProfile,
  plan = null,
  onStartPlan,
  onSignIn,
  onStartStudentOnboarding,
  onSelectDegree,
  liveUniversities,
  recommendations
}: DashboardProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [compareBaseUni, setCompareBaseUni] = useState<University | null>(null);
  const [compareTargetUni, setCompareTargetUni] = useState<University | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  // Personalized view active if signed in OR user has started configuring their student profile
  const isPersonalized = Boolean(
    session ||
    profile.student_knows_degree !== undefined ||
    profile.goal ||
    (profile.subjects && profile.subjects.length > 0) ||
    (profile.interests && profile.interests.length > 0) ||
    profile.city ||
    profile.name
  );

  if (isPersonalized && !showGuide) {
    const goal = degrees.find(d => d.id === profile.goal);
    const sourceUnis = liveUniversities && liveUniversities.length > 0 ? liveUniversities : catalogueUniversities;
    const rankedUnis = goal ? rankTopUniversities(sourceUnis, profile, goal.id, 5) : [];
    const topDegrees = recommendations?.source === 'groq' && recommendations.kind === 'degrees' ? recommendations.degreeRecommendations.slice(0, 5) : rankTopDegrees(profile, 5);

    const isMilestoneDone = (m: any) => Boolean(m.done || m.state === 'Demonstrated');
    const completed = plan?.milestones.filter(isMilestoneDone).length ?? 0;
    const total = plan?.milestones.length ?? 0;
    const ringPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const hasPlan = Boolean(plan && total > 0);
    const nextMilestone = plan?.milestones.find(m => !isMilestoneDone(m));
    const displayName = profile.name?.trim();
    const cityFilter = profile.relocate ? null : profile.city || null;

    // Secondary programme finder list (strictly matches chosen direction if selected, or city)
    const sideUnis = sourceUnis
      .filter(u => {
        if (cityFilter && u.city !== cityFilter) return false;
        if (goal) {
          const progDeg = degrees.find(d => d.id === u.degreeId);
          if (progDeg?.field !== goal.field) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (goal) {
          if (a.degreeId === goal.id && b.degreeId !== goal.id) return -1;
          if (b.degreeId === goal.id && a.degreeId !== goal.id) return 1;
        }
        const fitA = calculateUniversityFit(a, profile).fitPercentage;
        const fitB = calculateUniversityFit(b, profile).fitPercentage;
        return fitB - fitA;
      })
      .slice(0, 5);

    return (
      <div className="personalized-dashboard" aria-label="Personalized Dashboard">

        {/* Personalized Header */}
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR WORKSPACE</div>
            <h1>{displayName ? `Welcome back, ${displayName}!` : 'Welcome back!'}</h1>
            <p>
              {goal
                ? `Your target degree path is ${goal.name} (${goal.field}). Below are your verified university recommendations.`
                : 'Pick up where you left off and take your next step forward.'}
            </p>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
            <span className="catalogue-count">
              {session?.user?.email || (profile.name ? `${profile.name} · Student` : 'Guest workspace')}
            </span>
            {onStartStudentOnboarding && (
              <button
                className="button outline"
                onClick={onStartStudentOnboarding}
                style={{minHeight: '34px', padding: '6px 12px', fontSize: '12.5px'}}
                title="Retake student onboarding questionnaire"
              >
                <SlidersHorizontal size={14} />Retake questionnaire
              </button>
            )}
            <button
              className="button outline"
              onClick={() => setShowGuide(true)}
              style={{minHeight: '34px', padding: '6px 12px', fontSize: '12.5px'}}
              title="Browse platform exploration guide"
            >
              <Compass size={14} />Exploration guide
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PRIMARY FOCUS: CASE A — STUDENT HAS SELECTED A DEGREE               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {goal && (
          <section className="dashboard-recommendations-section" aria-labelledby="top-unis-heading">
            {/* Master Your Degree Entry Point Banner */}
            <div className="master-degree-banner">
              <div className="master-degree-info">
                <span className="subtle-pill" style={{background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', border: '1px solid rgba(147, 197, 253, 0.3)', marginBottom: '8px', display: 'inline-flex'}}>
                  MASTER YOUR DEGREE
                </span>
                <h3>
                  <BookOpen size={19} style={{color: '#60a5fa'}} /> Master Your Degree in {goal.name}
                </h3>
                <p>
                  Bridge campus coursework with high-demand industry skills. Access structured learning roadmaps, verified free resources, and practical portfolio tasks.
                </p>
                <div className="master-degree-chips">
                  {goal.skills.slice(0, 4).map(skill => (
                    <span key={skill} className="master-degree-chip">{skill}</span>
                  ))}
                  <span className="master-degree-chip" style={{background: 'rgba(59, 130, 246, 0.25)', color: '#bfdbfe'}}>
                    Specialized Roadmap
                  </span>
                </div>
              </div>
              <div className="master-degree-action">
                <button
                  type="button"
                  className="button"
                  onClick={() => onStartPlan ? onStartPlan(goal.name, goal.skills) : go('learning')}
                  title={`Start or continue learning roadmap for ${goal.name}`}
                >
                  {hasPlan ? 'Resume Learning Roadmap' : 'Master Your Degree'} <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* University Recommendations Header */}
            <div className="dashboard-recommendations-header">
              <div>
                <div className="dashboard-recommendations-title">
                  <GraduationCap size={22} style={{color: '#2563eb'}} />
                  <h2 id="top-unis-heading">Top Universities for {goal.name}</h2>
                </div>
                <p>
                  Ranked using verified admission rules for your {profile.qualification || 'school'} qualification
                  {cityFilter ? ` in ${cityFilter}` : ''} and semester budget.
                </p>
              </div>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                {onStartStudentOnboarding && (
                  <button
                    type="button"
                    className="text-button"
                    style={{fontSize: '12.5px', color: '#2563eb'}}
                    onClick={onStartStudentOnboarding}
                  >
                    Change degree
                  </button>
                )}
                <button
                  type="button"
                  className="button outline"
                  style={{minHeight: '34px', padding: '6px 12px', fontSize: '12.5px'}}
                  onClick={() => go('universities')}
                >
                  Explore all in University Finder <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* University Recommendations Grid */}
            {rankedUnis.length === 0 ? (
              <div style={{background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '32px 24px', textAlign: 'center'}}>
                <GraduationCap size={36} style={{color: '#94a3b8', margin: '0 auto 12px', display: 'block'}} />
                <h3 style={{fontSize: '16px', fontWeight: 700, color: 'var(--midnight)', margin: '0 0 6px'}}>
                  No direct university match found {cityFilter ? `in ${cityFilter}` : ''}
                </h3>
                <p style={{fontSize: '13.5px', color: 'var(--secondary)', maxWidth: '480px', margin: '0 auto 18px', lineHeight: 1.5}}>
                  No verified Pakistani institutions offering {goal.name} were found matching your current city filter. You can allow relocation or explore other campus locations.
                </p>
                <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'}}>
                  <button className="button dark" onClick={() => go('universities')}>
                    Browse all campuses in University Finder <ArrowRight size={14} />
                  </button>
                  <button className="button outline" onClick={() => go('profile')}>
                    Update city / budget
                  </button>
                </div>
              </div>
            ) : (
              <div className="uni-rec-grid">
                {rankedUnis.map((item, index) => {
                  const u = item.university;
                  const a = item.assessment;
                  const fee = item.tuitionDisplay;

                  return (
                    <article key={u.id} className="uni-rec-card">
                      <div className="uni-rec-card-header">
                        <div className="uni-rec-identity">
                          <div className="uni-rec-logo">{u.short}</div>
                          <div className="uni-rec-names">
                            <h3 className="uni-rec-name">{u.name}</h3>
                            <span className="uni-rec-city"><MapPin size={11} />{u.city}</span>
                          </div>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                          {index === 0 && (
                            <span
                              className={`degree-score-pill ${item.fitPercentage >= 70 ? 'high' : ''}`}
                              style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}
                            >
                              #1 Best Fit · {item.fitPercentage}%
                            </span>
                          )}
                          {index === 1 && (
                            <span
                              className={`degree-score-pill ${item.fitPercentage >= 70 ? 'high' : ''}`}
                              style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}
                            >
                              #2 Fit · {item.fitPercentage}%
                            </span>
                          )}
                          <StatusPill status={u.verificationStatus} />
                        </div>
                      </div>

                      <span className="uni-rec-programme">{u.programme}</span>

                      <div className="uni-rec-badges-row">
                        {a.status === 'Academic minimum met' && (
                          <span className="eligibility-pill met"><Check size={11} /> Academic minimum met</span>
                        )}
                        {a.status === 'Subject route needs review' && (
                          <span className="eligibility-pill review"><AlertCircle size={11} /> Subject route review</span>
                        )}
                        {a.status === 'Check current admissions' && (
                          <span className="eligibility-pill check"><HelpCircle size={11} /> Check current admissions</span>
                        )}
                        {a.status === 'Below published minimum' && (
                          <span className="eligibility-pill below"><AlertCircle size={11} /> Below published minimum</span>
                        )}

                        <span className={`db-uni-budget ${a.budget === 'Within semester budget' ? 'budget-ok' : (a.budget === 'Add your budget' || a.budget === 'Costs need checking') ? 'budget-neutral' : 'budget-high'}`}>
                          {a.budget}
                        </span>

                        <span className="uni-tuition-pill" title="Verified semester tuition">
                          <Coins size={12} style={{color: '#64748b'}} />
                          {fee.tuition}
                        </span>
                      </div>

                      <ul className="uni-rec-reasons" aria-label="Why this university matches">
                        {item.matchReasons.map((reason, idx) => (
                          <li key={idx}>
                            <Check size={12} />
                            <span>{reason}</span>
                          </li>
                        ))}
                        {a.detail && (
                          <li>
                            <Info size={12} style={{color: '#3b82f6'}} />
                            <span>{a.detail}</span>
                          </li>
                        )}
                      </ul>

                      <div className="uni-rec-actions">
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noreferrer"
                          className="button dark"
                          title={`Open official admission portal & application form for ${u.name}`}
                        >
                          View Campus Details <ArrowUpRight size={14} />
                        </a>
                        <button
                          type="button"
                          className="button outline"
                          onClick={() => {
                            setCompareBaseUni(u);
                            const candidates = rankedUnis
                              .map(r => r.university)
                              .filter(other => other.id !== u.id);
                            const fallbackCandidates = sourceUnis
                              .filter(other => other.id !== u.id && (goal ? other.degreeId === goal.id : true));
                            const list = candidates.length > 0 ? candidates : fallbackCandidates;
                            setCompareTargetUni(list[0] || null);
                            setCompareDialogOpen(true);
                          }}
                          title={`Compare ${u.name} with another university`}
                        >
                          <Scale size={14} /> Compare
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PRIMARY FOCUS: CASE B — STUDENT HAS NOT SELECTED A DEGREE          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {!goal && topDegrees.length > 0 && (
          <section className="dashboard-recommendations-section" aria-labelledby="top-degrees-heading">
            <div className="dashboard-recommendations-header">
              <div>
                <div className="dashboard-recommendations-title">
                  <Sparkles size={22} style={{color: '#2563eb'}} />
                  <h2 id="top-degrees-heading">Top 5 Degree Paths for You</h2>
                </div>
                <p>
                  {recommendations?.source === 'groq' && recommendations.kind === 'degrees' ? 'Groq-personalized suggestions with baseline-weighted match estimates, not admission or success probabilities.' : 'Deterministic match estimates based on your high-school subjects and interests.'} Select any degree to explore eligible Pakistani universities.
                </p>
              </div>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                {onStartStudentOnboarding && (
                  <button
                    type="button"
                    className="text-button"
                    style={{fontSize: '12.5px', color: '#2563eb'}}
                    onClick={onStartStudentOnboarding}
                  >
                    Retake questionnaire
                  </button>
                )}
                <button
                  type="button"
                  className="button outline"
                  style={{minHeight: '34px', padding: '6px 12px', fontSize: '12.5px'}}
                  onClick={() => go('explore')}
                >
                  Explore all 33 degrees <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Preliminary notice if student hasn't entered subjects or interests */}
            {topDegrees[0]?.isPreliminary && (
              <div className="preliminary-banner">
                <div className="preliminary-banner-text">
                  <AlertCircle size={16} />
                  <span>
                    <strong>Preliminary recommendations:</strong> We are displaying general disciplines. Complete your subjects and interests to see accurate match percentages.
                  </span>
                </div>
                {onStartStudentOnboarding && (
                  <button
                    type="button"
                    className="button outline"
                    style={{minHeight: '30px', padding: '4px 10px', fontSize: '12px'}}
                    onClick={onStartStudentOnboarding}
                  >
                    Answer questionnaire <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )}

            <div className="degree-rec-grid">
              {topDegrees.map(rec => {
                const isSelected = profile.goal === rec.degree.id;
                return (
                  <article key={rec.degree.id} className="degree-rec-card">
                    <div className="degree-rec-header">
                      <span className="degree-rec-field">{rec.degree.field}</span>
                      <span className={`degree-score-pill ${rec.score >= 70 ? 'high' : ''}`}>
                        {rec.score}% Match
                      </span>
                    </div>
                    <h3>{rec.degree.name}</h3>
                    <p className="degree-rec-tagline">{rec.degree.tagline}</p>

                    {/* Connected capabilities and skills */}
                    <div className="degree-skills-chips" aria-label="Key skills in this degree">
                      {rec.degree.skills.slice(0, 4).map(skill => (
                        <span key={skill} className="degree-skill-chip">{skill}</span>
                      ))}
                    </div>

                    <ul className="degree-rec-reasons">
                      {rec.reasons.map((r, i) => (
                        <li key={i}>
                          <Check size={13} />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className={`button ${isSelected ? 'mint' : 'dark'}`}
                      onClick={() => {
                        if (onSelectDegree) {
                          onSelectDegree(rec.degree.id);
                        } else {
                          go('universities');
                        }
                      }}
                      title={`Select ${rec.degree.name} and explore eligible campuses`}
                    >
                      {isSelected ? 'Degree Selected · View Campuses' : 'Select Degree'} <ArrowRight size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECONDARY: ROADMAP PROGRESS & PROGRAMME FINDER                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className="db-progress-grid">

          {/* LEFT: Roadmap progress ring card */}
          <section className="db-ring-card form-section" aria-labelledby="ring-heading">
            <div className="form-section-heading">
              <span>01</span>
              <div>
                <h2 id="ring-heading">Roadmap progress</h2>
                <p>{hasPlan ? 'Based on your active learning roadmap milestones.' : 'Create a roadmap to start tracking your progress here.'}</p>
              </div>
            </div>
            <div className="db-ring-body">
              <div className="db-ring-center">
                <ProgressRing
                  pct={ringPct} size={160} stroke={13}
                  label={`${ringPct}%`}
                  sublabel={hasPlan ? `${completed}/${total} steps` : undefined}
                  color={ringPct === 100 ? '#3ab07a' : '#3264d6'}
                  emptyState={!hasPlan}
                />
                <div style={{textAlign: 'center', marginTop: '12px'}}>
                  <strong style={{fontSize: '14px', color: 'var(--midnight)', display: 'block'}}>
                    {hasPlan ? plan!.title : 'No active roadmap'}
                  </strong>
                  {hasPlan ? (
                    <span style={{fontSize: '12px', color: 'var(--secondary)'}}>
                      {ringPct === 100 ? 'All steps complete!' : `${total - completed} step${total - completed !== 1 ? 's' : ''} remaining`}
                    </span>
                  ) : (
                    <span style={{fontSize: '12px', color: 'var(--secondary)'}}>
                      {goal ? 'Ready to build your plan' : 'Choose a direction first'}
                    </span>
                  )}
                </div>
              </div>
              <div className="db-stats-col">
                <StatBlock
                  label="ROADMAP MILESTONES"
                  value={hasPlan ? `${completed} / ${total}` : '—'}
                  sub={hasPlan ? `${ringPct}% complete` : 'No plan yet'}
                  numerator={hasPlan ? completed : undefined}
                  denominator={hasPlan ? total : undefined}
                  accent="#3264d6"
                />
                <StatBlock
                  label="SKILLS REPORTED"
                  value={String(profile.skills.length)}
                  sub={profile.skills.length > 0 ? profile.skills.slice(0, 2).join(', ') : 'Add in My Profile'}
                />
                <StatBlock
                  label="HOURS / WEEK"
                  value={`${profile.hours}h`}
                  sub={hasPlan && plan?.hoursPerWeek ? `Plan: ${plan.hoursPerWeek}h / week` : 'Your weekly commitment'}
                />
                <StatBlock
                  label="CHOSEN DIRECTION"
                  value={goal ? goal.name : '—'}
                  sub={goal ? goal.field : 'Explore degrees to choose'}
                />
              </div>
            </div>
            <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '20px', borderTop: '1px solid var(--border)', marginTop: '20px'}}>
              {hasPlan ? (
                <button className="button dark" onClick={() => go('learning')}>Resume roadmap <Route size={16} /></button>
              ) : goal ? (
                <button className="button dark" onClick={() => onStartPlan ? onStartPlan(goal.name, goal.skills) : go('learning')}>Build learning plan <ArrowRight size={16} /></button>
              ) : (
                <button className="button dark" onClick={() => go('explore')}>Explore degree paths <Compass size={16} /></button>
              )}
              <button className="button outline" onClick={() => go('profile')}><SlidersHorizontal size={16} />Update profile</button>
            </div>
          </section>

          {/* RIGHT: Programme finder card */}
          <section className="db-uni-card form-section" aria-labelledby="uni-list-heading">
            <div className="form-section-heading">
              <span>02</span>
              <div>
                <h2 id="uni-list-heading">{cityFilter ? `Programmes in ${cityFilter}` : 'Programme finder'}</h2>
                <p>
                  {goal
                    ? `Matched to your ${goal.name} direction${cityFilter ? ` in ${cityFilter}` : ''}.`
                    : cityFilter
                    ? 'Verified programmes near you with real status badges.'
                    : 'Set your city in profile to filter by location.'}
                </p>
              </div>
            </div>
            {sideUnis.length === 0 ? (
              <div style={{padding: '20px 0', textAlign: 'center'}}>
                <GraduationCap size={32} style={{color: '#9cb2ca', margin: '0 auto 12px', display: 'block'}} />
                <p style={{fontSize: '14px', color: 'var(--secondary)', margin: '0 0 14px'}}>
                  {goal
                    ? `No ${goal.name.toLowerCase()} programmes found${cityFilter ? ` in ${cityFilter}` : ''}. Update your city or explore degree paths.`
                    : 'No programmes found in your city. Update your city in My Profile.'}
                </p>
                <button className="button outline" onClick={() => go('profile')}>Update preferences</button>
              </div>
            ) : (
              <ul className="db-uni-list" role="list" style={{listStyle: 'none', margin: 0, padding: 0}}>
                {sideUnis.map((u, index) => {
                  const a = assessUniversity(u, profile);
                  const fit = calculateUniversityFit(u, profile);
                  return (
                    <li key={u.id} className="db-uni-item">
                      <div className="db-uni-logo">{u.short}</div>
                      <div className="db-uni-info">
                        <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px'}}>
                          <div style={{minWidth: 0}}>
                            <span className="db-uni-prog">{u.programme}</span>
                            <span className="db-uni-name">{u.name}</span>
                            <span className="db-uni-city"><MapPin size={10} />{u.city}</span>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                            {index === 0 && (
                              <span className={`degree-score-pill ${fit.fitPercentage >= 70 ? 'high' : ''}`} style={{fontSize: '9.5px', padding: '1px 6px', borderRadius: '8px'}}>
                                #1 Fit · {fit.fitPercentage}%
                              </span>
                            )}
                            {index === 1 && (
                              <span className={`degree-score-pill ${fit.fitPercentage >= 70 ? 'high' : ''}`} style={{fontSize: '9.5px', padding: '1px 6px', borderRadius: '8px'}}>
                                #2 Fit · {fit.fitPercentage}%
                              </span>
                            )}
                            <StatusPill status={u.verificationStatus} />
                          </div>
                        </div>
                        <span className={`db-uni-budget ${a.budget === 'Within semester budget' ? 'budget-ok' : (a.budget === 'Add your budget' || a.budget === 'Costs need checking') ? 'budget-neutral' : 'budget-high'}`}>{a.budget}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <button className="button outline" style={{width: '100%', marginTop: '16px'}} onClick={() => go('universities')}>View all universities <ArrowUpRight size={16} /></button>
          </section>
        </div>

        {/* Up-next milestone */}
        {nextMilestone && (
          <section className="form-section db-next-card" aria-labelledby="next-heading" style={{marginTop: '22px'}}>
            <div className="form-section-heading">
              <span><Clock3 size={17} style={{color: '#3264d6'}} /></span>
              <div>
                <h2 id="next-heading">Up next on your roadmap</h2>
                <p>Your nearest incomplete learning step.</p>
              </div>
            </div>
            <div className="db-next-body">
              <div style={{flex: 1}}>
                <div className="eyebrow" style={{marginBottom: '6px'}}>STEP {completed + 1} · {nextMilestone.skill}</div>
                <h3 style={{fontSize: '18px', letterSpacing: '-0.4px', color: 'var(--midnight)', marginBottom: '10px'}}>{nextMilestone.title}</h3>
                <div className="practice-task">
                  <strong>Make it practical</strong>
                  <p>{nextMilestone.practice}</p>
                </div>
              </div>
              <div className="db-next-meta">
                <span className="time-pill"><Clock3 size={13} />{nextMilestone.hours ?? 4}h estimated</span>
                <button className="button dark" onClick={() => go('learning')}>Open roadmap <ArrowRight size={16} /></button>
              </div>
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section className="next-actions" aria-labelledby="quick-actions-heading" style={{marginTop: '34px'}}>
          <div className="section-heading" style={{marginBottom: '22px'}}>
            <div><h2 id="quick-actions-heading">Quick actions</h2><p>Jump directly to active features in your workspace.</p></div>
            <span className="subtle-pill">EXPLORATION SHORTCUTS</span>
          </div>
          <div className="action-grid">
            <button className="action-card" onClick={() => go('universities')}><div className="action-symbol blue"><GraduationCap size={25} /></div><h3>Find university programs</h3><p>Campuses, programs, and verified semester tuition.</p><div className="card-footer"><span>Explore campuses</span><ArrowUpRight size={19} /></div></button>
            <button className="action-card" onClick={() => go('universities')}><div className="action-symbol green"><ShieldCheck size={25} /></div><h3>Check admission eligibility</h3><p>Review academic criteria and calculate NET aggregate.</p><div className="card-footer"><span>Check eligibility</span><ArrowUpRight size={19} /></div></button>
            <button className="action-card" onClick={() => go('jobs')}><div className="action-symbol peach"><BriefcaseBusiness size={25} /></div><h3>Explore career options</h3><p>Browse role briefs and typical industry requirements.</p><div className="card-footer"><span>Browse roles</span><ArrowUpRight size={19} /></div></button>
            <button className="action-card" onClick={() => go('jobs')}><div className="action-symbol blue"><FileText size={25} /></div><h3>Analyze a target job</h3><p>Paste a job description to discover your skill gaps.</p><div className="card-footer"><span>Decode job</span><ArrowUpRight size={19} /></div></button>
            <button className="action-card" onClick={() => go('learning')}><div className="action-symbol green"><Route size={25} /></div><h3>View my roadmap</h3><p>Track practical milestones and access free resources.</p><div className="card-footer"><span>Open roadmap</span><ArrowUpRight size={19} /></div></button>
            <button className="action-card" onClick={() => go('profile')}><div className="action-symbol peach"><SlidersHorizontal size={25} /></div><h3>Edit my profile</h3><p>Update qualification, marks, budget, and skills.</p><div className="card-footer"><span>Manage settings</span><ArrowUpRight size={19} /></div></button>
          </div>
        </section>

        {/* Career companion CTA */}
        <section className="adviser-card" aria-labelledby="adviser-heading" style={{marginTop: '36px', width: '100%'}}>
          <div className="adviser-symbol"><Sparkles size={26} /></div>
          <span className="eyebrow">MEET YOUR CAREER COMPANION</span>
          <h2 id="adviser-heading">Big questions.<br />A little guidance.</h2>
          <p>Degrees, skills, or that "what next?" feeling. Let's work through it together.</p>
          <button className="button dark" onClick={onChat} style={{minWidth: '220px'}}>Ask CourseCompass AI <Sparkles size={17} /></button>
        </section>

        {/* Side-by-side University Comparison Dialog */}
        <UniversityCompareDialog
          open={compareDialogOpen}
          onOpenChange={setCompareDialogOpen}
          baseUni={compareBaseUni}
          targetUni={compareTargetUni}
          onSelectTargetUni={setCompareTargetUni}
          availableUnis={goal ? sourceUnis.filter(u => u.degreeId === goal.id) : sourceUnis}
          profile={profile}
        />
      </div>
    );
  }

  // Guest homepage
  return (
    <>
      {session && showGuide && (
        <div className="inline-note" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
          <span>You are viewing the platform exploration guide.</span>
          <button className="button dark" onClick={() => setShowGuide(false)} style={{minHeight: '36px', padding: '8px 14px'}}>
            Return to my personalized dashboard <ArrowRight size={15} />
          </button>
        </div>
      )}
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-content">
          <div className="hero-brand-badge">
            <span className="brand-dot-pulse" aria-hidden="true" />
            <span className="hero-brand-name">CourseCompass AI</span>
            <span className="hero-brand-sep" aria-hidden="true">·</span>
            <span className="hero-brand-tagline">Guided education &amp; career navigator</span>
          </div>
          <h1 id="hero-title" className="hero-heading">Your future, with a <span>clearer direction.</span></h1>
          <p className="hero-subtext">Whether you&apos;re choosing a university or preparing for your next job, start with where you are.</p>
        </div>
        <div className="hero-action">
          <button className="button outline" onClick={() => onStartStudentOnboarding ? onStartStudentOnboarding() : go('profile')}>Personalise my path <ArrowUpRight size={17} /></button>
        </div>
      </section>
      <section className="journey-decision-section" aria-label="Choose your journey">
        <div className="journey-decision-grid">
          <article className="primary-journey-card student-card">
            <div className="journey-card-header">
              <div className="journey-icon-wrap student" aria-hidden="true"><GraduationCap size={26} /></div>
              <span className="journey-badge student">Academic Pathway</span>
            </div>
            <h2>I&apos;m a Student</h2>
            <p className="journey-desc">Find universities and degrees that match your marks, subjects, interests, and budget.</p>
            <ul className="journey-highlights" aria-label="Student journey features">
              <li className="journey-highlight-item"><Check size={16} aria-hidden="true" /><span>Degree &amp; discipline matching for your subjects</span></li>
              <li className="journey-highlight-item"><Check size={16} aria-hidden="true" /><span>Admission eligibility, entry tests &amp; merit criteria</span></li>
              <li className="journey-highlight-item"><Check size={16} aria-hidden="true" /><span>Verified university fees &amp; semester budget checks</span></li>
            </ul>
            <div className="journey-card-footer"><button className="button journey-cta-btn student" onClick={() => onStartStudentOnboarding ? onStartStudentOnboarding() : go('explore')} aria-label="Explore My Options - Student journey"><span>Explore My Options</span><ArrowRight size={17} /></button></div>
          </article>
          <article className="primary-journey-card career-card">
            <div className="journey-card-header">
              <div className="journey-icon-wrap career" aria-hidden="true"><BriefcaseBusiness size={25} /></div>
              <span className="journey-badge career">Career Roadmap</span>
            </div>
            <h2>I&apos;m Building My Career</h2>
            <p className="journey-desc">Discover the skills, courses, and projects you need for your target job.</p>
            <ul className="journey-highlights" aria-label="Career journey features">
              <li className="journey-highlight-item"><Check size={16} aria-hidden="true" /><span>Target role briefs &amp; in-demand skill requirements</span></li>
              <li className="journey-highlight-item"><Check size={16} aria-hidden="true" /><span>Job description skill-gap analyzer with your profile</span></li>
              <li className="journey-highlight-item"><Check size={16} aria-hidden="true" /><span>Step-by-step practical learning roadmaps with free resources</span></li>
            </ul>
            <div className="journey-card-footer"><button className="button journey-cta-btn career" onClick={() => go('jobs')} aria-label="Build My Career Path - Career journey"><span>Build My Career Path</span><ArrowRight size={17} /></button></div>
          </article>
        </div>
      </section>
      <section className="next-actions" aria-labelledby="toolkit-heading">
        <div className="section-heading">
          <div><h2 id="toolkit-heading">A few ways forward</h2><p>You&apos;re allowed to explore more than one possibility.</p></div>
          <span className="subtle-pill">YOUR EXPLORATION TOOLKIT</span>
        </div>
        <div className="action-grid">
          {[
            {label: 'Discover your degree', text: 'From arts to engineering. Find a field that fits how you think.', icon: Compass, id: 'explore', color: 'blue', meta: 'Explore possibilities'},
            {label: 'Find your university', text: 'Your ambitions, your city, your budget. Bring them together.', icon: GraduationCap, id: 'universities', color: 'green', meta: 'Explore campuses'},
            {label: 'Turn gaps into goals', text: 'Bring a job description. Leave with a practical learning plan.', icon: BriefcaseBusiness, id: 'jobs', color: 'peach', meta: 'Understand your skills'}
          ].map(a => (
            <button className="action-card" key={a.id} onClick={() => go(a.id)}>
              <div className={`action-symbol ${a.color}`}><a.icon size={25} /></div>
              <h3>{a.label}</h3>
              <p>{a.text}</p>
              <div className="card-footer"><span>{a.meta}</span><ArrowUpRight size={19} /></div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}