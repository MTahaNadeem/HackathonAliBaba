'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  BriefcaseBusiness,
  Sparkles,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Check,
  BookOpen,
  Target,
  RefreshCw,
  X,
  Zap,
  Clock,
  DollarSign,
  BarChart3,
  UserCheck,
  LoaderCircle,
  Edit,
} from 'lucide-react';
import { type Profile } from '@/lib/domain';
import type { CareerRecommendation, CareerRecommendationsResult } from '@/lib/ai/career-engine';

interface CareerDashboardProps {
  profile: Profile;
  onStartPlan: (goal: string, skills: string[]) => void;
  onEditProfile: () => void;
  go: (view: string) => void;
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f1" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: `${size / 2}px ${size / 2}px`,
          fontSize: size > 60 ? 16 : 13,
          fontWeight: 700,
          fill: color,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {score}%
      </text>
    </svg>
  );
}

function SkillGapBadge({ label, type }: { label: string; type: 'have' | 'gap' | 'next' }) {
  const styles: Record<string, React.CSSProperties> = {
    have: { background: '#e8f5ee', color: '#3a7a5c', border: '1px solid #c4ddd0' },
    gap: { background: '#fff5e0', color: '#92600a', border: '1px solid #fcd88c' },
    next: { background: '#edf3fc', color: '#275abf', border: '1px solid #c7d9f5' },
  };
  const icons = { have: <Check size={11} />, gap: <AlertCircle size={11} />, next: <ArrowRight size={11} /> };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        ...styles[type],
      }}
    >
      {icons[type]}
      {label}
    </span>
  );
}

function CareerCard({
  rec,
  rank,
  onSelect,
  selected,
}: {
  rec: CareerRecommendation;
  rank: number;
  onSelect: () => void;
  selected: boolean;
}) {
  const isTopPick = rank === 1;

  return (
    <button
      className={`career-card ${selected ? 'career-card-active' : ''} ${isTopPick ? 'career-card-top' : ''}`}
      onClick={onSelect}
    >
      <div className="career-card-inner">
        <div className="career-card-rank">
          {isTopPick ? (
            <span className="career-top-badge">
              <Sparkles size={11} />
              Top Match
            </span>
          ) : (
            <span className="career-rank-num">#{rank}</span>
          )}
        </div>

        <div className="career-card-main">
          <div className="career-card-header-row">
            <div>
              <h3 className="career-card-title">{rec.title}</h3>
              <span className="career-card-field">{rec.field}</span>
            </div>
            <ScoreRing score={rec.matchScore} size={60} />
          </div>

          <p className="career-card-desc">{rec.description}</p>

          {rec.strengths.length > 0 && (
            <div className="career-card-skills">
              {rec.strengths.slice(0, 3).map(s => (
                <SkillGapBadge key={s} label={s} type="have" />
              ))}
              {rec.skillGaps.slice(0, 2).map(g => (
                <SkillGapBadge key={g} label={g} type="gap" />
              ))}
            </div>
          )}

          {rec.salaryRange && (
            <div className="career-salary-row">
              <DollarSign size={13} />
              <span>{rec.salaryRange}</span>
            </div>
          )}
        </div>

        <ChevronRight size={16} className="career-card-arrow" />
      </div>
    </button>
  );
}

function CareerDetail({
  rec,
  onBuildRoadmap,
  onClose,
  profile,
}: {
  rec: CareerRecommendation;
  onBuildRoadmap: (rec: CareerRecommendation) => void;
  onClose: () => void;
  profile: Profile;
}) {
  return (
    <div className="career-detail">
      <div className="career-detail-header">
        <div>
          <div className="career-detail-field">{rec.field}</div>
          <h2 className="career-detail-title">{rec.title}</h2>
          <p className="career-detail-desc">{rec.description}</p>
        </div>
        <div className="career-detail-score-wrap">
          <ScoreRing score={rec.matchScore} size={88} />
          <span className="career-detail-score-label">Match</span>
        </div>
      </div>

      {rec.whyItFits && (
        <div className="career-why-box">
          <Sparkles size={16} />
          <div>
            <strong>Why it fits you</strong>
            <p>{rec.whyItFits}</p>
          </div>
        </div>
      )}

      <div className="career-detail-grid">
        {rec.strengths.length > 0 && (
          <div className="career-detail-section">
            <h3>
              <UserCheck size={15} />
              You already have
            </h3>
            <div className="career-tag-list">
              {rec.strengths.map(s => (
                <SkillGapBadge key={s} label={s} type="have" />
              ))}
            </div>
          </div>
        )}

        {rec.skillGaps.length > 0 && (
          <div className="career-detail-section">
            <h3>
              <TrendingUp size={15} />
              Skill gaps to close
            </h3>
            <div className="career-tag-list">
              {rec.skillGaps.map(g => (
                <SkillGapBadge key={g} label={g} type="gap" />
              ))}
            </div>
          </div>
        )}
      </div>

      {rec.nextSteps.length > 0 && (
        <div className="career-next-steps">
          <h3>
            <Target size={15} />
            Your next steps
          </h3>
          <ol className="career-steps-list">
            {rec.nextSteps.map((step, i) => (
              <li key={i} className="career-step-item">
                <span className="career-step-num">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(rec.salaryRange || rec.growthOutlook) && (
        <div className="career-meta-row">
          {rec.salaryRange && (
            <div className="career-meta-item">
              <DollarSign size={15} />
              <div>
                <small>Salary Range</small>
                <strong>{rec.salaryRange}</strong>
              </div>
            </div>
          )}
          {rec.growthOutlook && (
            <div className="career-meta-item">
              <BarChart3 size={15} />
              <div>
                <small>Market Outlook</small>
                <strong>{rec.growthOutlook}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="career-detail-actions">
        <button
          className="button blue"
          onClick={() => onBuildRoadmap(rec)}
          style={{ flex: 1 }}
        >
          <BookOpen size={16} />
          Build My Roadmap for {rec.title}
          <ArrowRight size={16} />
        </button>
        <button className="button outline" onClick={onClose}>
          <X size={15} />
          Back
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#8a9cb8', marginTop: 12, textAlign: 'center' }}>
        Skill matching is based on your self-reported profile. Verify requirements directly with employers.
      </p>
    </div>
  );
}

export default function CareerDashboard({
  profile,
  onStartPlan,
  onEditProfile,
  go,
}: CareerDashboardProps) {
  const [result, setResult] = useState<CareerRecommendationsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CareerRecommendation | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const profileKey = JSON.stringify({
    skills: profile.skills,
    interests: profile.interests,
    experience: profile.experience?.slice(0, 50),
    extractedSkills: profile.extractedSkills?.slice(0, 50),
    career_goal: profile.career_goal,
    specialization: profile.specialization,
    qualification: profile.qualification,
  });

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/career/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journey: 'career',
          stage: profile.stage,
          qualification: profile.qualification,
          subjects: profile.subjects,
          interests: profile.interests,
          skills: profile.skills,
          extractedSkills: profile.extractedSkills,
          experience: profile.experience,
          projects: profile.projects,
          certifications: profile.certifications,
          city: profile.city,
          hours: profile.hours,
          career_goal: profile.career_goal,
          specialization: profile.specialization,
          goal: profile.goal,
        }),
      });
      if (!r.ok) throw new Error('Could not load career recommendations.');
      const data = await r.json() as CareerRecommendationsResult;
      setResult(data);
      setHasLoaded(true);
    } catch {
      setError('Career recommendations could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!hasLoaded) {
      void loadRecommendations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBuildRoadmap(rec: CareerRecommendation) {
    const skillsToLearn = [
      ...rec.skillGaps,
      ...(profile.skills || []).slice(0, 3),
    ].filter(Boolean);
    onStartPlan(rec.title, skillsToLearn);
  }

  const hasSkills = (profile.skills?.length ?? 0) > 0;
  const hasInterests = (profile.interests?.length ?? 0) > 0;
  const isProfileReady = hasSkills || hasInterests;

  return (
    <div className="career-dashboard">
      {/* Hero */}
      <div className="career-hero">
        <div className="career-hero-content">
          <div className="eyebrow">YOUR CAREER COMPASS</div>
          <h1 className="career-hero-title">
            Your career,<br />
            <span>personalized.</span>
          </h1>
          <p className="career-hero-sub">
            AI-matched career paths based on your real skills, background, and goals.
            {profile.city && ` Tailored for someone in ${profile.city}.`}
          </p>
        </div>

        <div className="career-hero-stats">
          <div className="career-stat">
            <Zap size={18} />
            <div>
              <strong>{profile.skills?.length ?? 0}</strong>
              <span>Skills</span>
            </div>
          </div>
          <div className="career-stat">
            <Target size={18} />
            <div>
              <strong>{profile.interests?.length ?? 0}</strong>
              <span>Interests</span>
            </div>
          </div>
          {profile.hours && (
            <div className="career-stat">
              <Clock size={18} />
              <div>
                <strong>{profile.hours}h</strong>
                <span>Per week</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isProfileReady && (
        <div className="career-setup-prompt">
          <BriefcaseBusiness size={22} />
          <div>
            <strong>Complete your career profile to get personalized matches</strong>
            <p>Add your skills, interests, and experience level to unlock AI-powered career recommendations.</p>
          </div>
          <button className="button blue" onClick={onEditProfile}>
            <Edit size={15} />
            Set Up Career Profile
          </button>
        </div>
      )}

      {isProfileReady && (
        <>
          {/* Profile summary strip */}
          {profile.career_goal && (
            <div className="career-goal-strip">
              <Target size={15} />
              <span>
                Career goal: <strong>{profile.career_goal}</strong>
                {profile.specialization && <> · Specialization: <strong>{profile.specialization}</strong></>}
              </span>
              <button className="text-button" onClick={onEditProfile} style={{ marginLeft: 'auto', fontSize: 12 }}>
                <Edit size={12} /> Edit
              </button>
            </div>
          )}

          {/* Main content */}
          {selected ? (
            <CareerDetail
              rec={selected}
              onBuildRoadmap={handleBuildRoadmap}
              onClose={() => setSelected(null)}
              profile={profile}
            />
          ) : (
            <div className="career-matches-section">
              <div className="section-heading">
                <div>
                  <h2>Your Top Career Matches</h2>
                  {result?.source === 'groq' && (
                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      <Sparkles size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      Personalized by Groq AI · Match scores reflect your profile
                    </p>
                  )}
                  {result?.source === 'deterministic' && (
                    <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      Based on your declared skills and interests
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="button outline"
                    onClick={() => { setHasLoaded(false); void loadRecommendations(); }}
                    disabled={loading}
                    title="Regenerate recommendations"
                  >
                    <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    {loading ? 'Loading…' : 'Refresh'}
                  </button>
                  <button className="button outline" onClick={onEditProfile}>
                    <Edit size={15} />
                    Edit Profile
                  </button>
                </div>
              </div>

              {loading && (
                <div className="career-loading">
                  <LoaderCircle size={32} className="spin" />
                  <div>
                    <strong>Analyzing your profile…</strong>
                    <p>Finding your best career matches with Groq AI</p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="career-error">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Could not load recommendations</strong>
                    <p>{error}</p>
                  </div>
                  <button className="button outline" onClick={() => void loadRecommendations()}>
                    Retry
                  </button>
                </div>
              )}

              {result && !loading && (
                <>
                  {result.profileSummary && (
                    <div className="career-profile-summary">
                      <Sparkles size={14} />
                      <p>{result.profileSummary}</p>
                    </div>
                  )}

                  <div className="career-cards-list">
                    {result.recommendations.map((rec, i) => (
                      <CareerCard
                        key={rec.id}
                        rec={rec}
                        rank={i + 1}
                        selected={selected === rec}
                        onSelect={() => setSelected(rec)}
                      />
                    ))}
                  </div>

                  <div className="career-cta-strip">
                    <div>
                      <strong>Ready to build skills?</strong>
                      <p>Click any career above to see your personalized roadmap.</p>
                    </div>
                    <button className="button dark" onClick={() => go('jobs')}>
                      Explore All Roles
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
