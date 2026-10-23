'use client';
import {useState} from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Check,
  Compass,
  Scale,
  Lightbulb,
  GraduationCap,
  BriefcaseBusiness,
  Sparkles
} from 'lucide-react';
import {degrees, type Degree} from '@/lib/catalogue';
import {recommend, rankTopDegrees, type Profile} from '@/lib/domain';
import {Dialog, DialogContent, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {CheckField, Empty} from './fields';

interface ExploreProps {
  profile: Profile;
  onGoal: (d: Degree) => void;
  go?: (id: string) => void;
}

export default function Explore({profile, onGoal, go}: ExploreProps) {
  const goalDegree = degrees.find(d => d.id === profile.goal);
  const [prioritizePersonalized, setPrioritizePersonalized] = useState(Boolean(goalDegree));
  const [query, setQuery] = useState('');
  const [field, setField] = useState('All fields');
  const [detail, setDetail] = useState<Degree | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const rankedRecs = rankTopDegrees(profile, 33);
  const scoreMap = new Map(rankedRecs.map(r => [r.degree.id, r.score]));

  const getScore = (d: Degree) => {
    if (scoreMap.has(d.id)) return scoreMap.get(d.id)!;
    const userSubjects = Array.isArray(profile.subjects) ? profile.subjects : [];
    const userInterests = Array.isArray(profile.interests) ? profile.interests : [];
    const userSkills = Array.isArray(profile.skills) ? profile.skills : [];
    const subjectMatches = d.subjects.filter(s =>
      userSubjects.some(us => us.toLowerCase() === s.toLowerCase())
    );
    const interestMatches = d.interests.filter(i =>
      userInterests.some(ui => ui.toLowerCase() === i.toLowerCase())
    );
    const skillMatches = d.skills.filter(sk =>
      userSkills.some(usk => usk.toLowerCase() === sk.toLowerCase())
    );
    const maxPossible = d.subjects.length * 3 + d.interests.length * 2;
    const rawScore = subjectMatches.length * 3 + interestMatches.length * 2 + Math.min(skillMatches.length, 2);
    if (rawScore > 0 && maxPossible > 0) {
      return Math.min(98, Math.max(30, Math.round((rawScore / maxPossible) * 100)));
    }
    return 50;
  };

  const list = recommend(profile)
    .filter(
      d =>
        (field === 'All fields' || d.field === field) &&
        `${d.name} ${d.description} ${d.roles.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      if (prioritizePersonalized && goalDegree && field === 'All fields') {
        const aExact = a.id === goalDegree.id;
        const bExact = b.id === goalDegree.id;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        const aField = a.field === goalDegree.field;
        const bField = b.field === goalDegree.field;
        if (aField && !bField) return -1;
        if (bField && !aField) return 1;
      }
      return 0;
    });

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">DISCOVERY HUB</div>
          <h1>
            Discover your <span>possibilities.</span>
          </h1>
          <p>Explore degrees, university options, and career opportunities all in one place.</p>
        </div>
        <span className="catalogue-count">{degrees.length} degree paths</span>
      </div>

      {/* Discovery Hub Entry Points */}
      {go && (
        <div className="explore-hub-row action-grid" aria-label="Discovery pathways">
          <button
            type="button"
            className="hub-entry-card action-card active"
            onClick={() => {
              setField('All fields');
              setQuery('');
              go('explore');
            }}
          >
            <div className="action-symbol blue">
              <Compass size={24} />
            </div>
            <h3>Explore Degrees</h3>
            <p>Matching disciplines &amp; trial projects</p>
            <div className="card-footer">
              <span>Explore degrees</span>
              <ArrowUpRight size={17} />
            </div>
          </button>

          <button
            type="button"
            className="hub-entry-card action-card"
            onClick={() => go('universities')}
          >
            <div className="action-symbol green">
              <GraduationCap size={24} />
            </div>
            <h3>Education &amp; Campuses</h3>
            <p>Universities, eligibility &amp; fees</p>
            <div className="card-footer">
              <span>Explore campuses</span>
              <ArrowUpRight size={17} />
            </div>
          </button>

          <button
            type="button"
            className="hub-entry-card action-card"
            onClick={() => go('jobs')}
          >
            <div className="action-symbol peach">
              <BriefcaseBusiness size={24} />
            </div>
            <h3>Careers &amp; Target Roles</h3>
            <p>Role briefs &amp; skill gap analysis</p>
            <div className="card-footer">
              <span>Explore careers</span>
              <ArrowUpRight size={17} />
            </div>
          </button>
        </div>
      )}

      <div className="filter-row">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search degrees"
            placeholder="Search a degree, interest, or career…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <button
          className="button outline"
          disabled={compare.length < 2}
          onClick={() => setComparing(true)}
        >
          <Scale size={17} />
          Compare ({compare.length}/3)
        </button>
      </div>

      {prioritizePersonalized && goalDegree && (
        <div
          className="active-filter-banner"
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#1e3a8a' }}>
              Prioritizing degree paths for your chosen direction:{' '}
              <strong>
                {goalDegree.name} ({goalDegree.field})
              </strong>
            </span>
          </div>
          <button
            className="text-button"
            style={{
              fontSize: '13px',
              color: '#2563eb',
              textDecoration: 'underline',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setPrioritizePersonalized(false)}
          >
            Standard ranking
          </button>
        </div>
      )}
      {!prioritizePersonalized && goalDegree && (
        <div
          className="active-filter-banner"
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Showing degrees in standard recommendation order.
          </span>
          <button
            className="text-button"
            style={{
              fontSize: '13px',
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

      <div className="filter-chips" aria-label="Filter by discipline">
        {['All fields', ...new Set(degrees.map(d => d.field))].map(f => (
          <button
            className={`chip ${field === f ? 'selected' : ''}`}
            key={f}
            onClick={() => setField(f)}
            aria-pressed={field === f}
          >
            {f}
          </button>
        ))}
      </div>

      {profile.interests.length > 0 && (
        <div className="inline-note">
          <Compass size={18} />
          Ordered by your selected interests and subjects. These are paths to investigate, not aptitude-test results.
        </div>
      )}

      <div className="degree-grid">
        {list.map((d, index) => {
          const score = getScore(d);
          const showPercentage = index < 5;

          return (
            <article className="degree-card" key={d.id}>
              <div className={`degree-banner ${d.color}`}>
                <span>{d.field}</span>
                {showPercentage && (
                  <span
                    className={`degree-score-pill ${score >= 70 ? 'high' : ''}`}
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      fontSize: '11.5px',
                      padding: '3px 9px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.92)',
                      boxShadow: '0 2px 6px rgba(20, 45, 82, 0.08)',
                    }}
                  >
                    {score}% Match
                  </span>
                )}
                <Compass size={34} />
                <span className="degree-monogram">
                  {d.name
                    .split(' ')
                    .map(s => s[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
              </div>
              <div className="degree-body">
              <h2>{d.name}</h2>
              <p className="degree-tagline">{d.tagline}</p>
              <div className="tags">
                {d.interests.slice(0, 3).map(t => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              {d.reasons.length > 0 && (
                <p className="match-reason">
                  <Check size={14} />
                  {d.reasons[0]}
                </p>
              )}
              <div className="degree-bottom">
                <button className="text-button" onClick={() => setDetail(d)}>
                  Explore this path <ArrowUpRight size={17} />
                </button>
                <CheckField
                  label="Compare"
                  checked={compare.includes(d.id)}
                  onChange={v =>
                    setCompare(old =>
                      v ? (old.length < 3 ? [...old, d.id] : old) : old.filter(x => x !== d.id)
                    )
                  }
                />
              </div>
            </div>
          </article>
        );
      })}
      </div>

      {!list.length && (
        <Empty
          title="A different search might help"
          text="Try a broader subject or choose All fields."
          action="Clear filters"
          onAction={() => {
            setQuery('');
            setField('All fields');
          }}
        />
      )}

      <Dialog
        open={!!detail}
        onOpenChange={open => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="coursecompass-dialog">
          {detail && (
            <>
              <span className="eyebrow">{detail.field}</span>
              <DialogTitle className="dialog-title">{detail.name}</DialogTitle>
              <DialogDescription>{detail.description}</DialogDescription>
              <div className="detail-columns">
                <div>
                  <h3>What you’ll work with</h3>
                  <div className="tags">
                    {detail.skills.map(s => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Careers to investigate</h3>
                  <ul>
                    {detail.roles.map(r => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="try-panel">
                <Lightbulb size={23} />
                <div>
                  <strong>Try the field before you choose it</strong>
                  <p>{detail.trial}</p>
                </div>
              </div>
              <p className="muted small-text">
                Subject requirements vary by university. Check programme eligibility in Universities.
              </p>
              <button
                className="button blue"
                onClick={() => {
                  onGoal(detail);
                  setDetail(null);
                }}
              >
                Make this my direction <ArrowRight size={18} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="coursecompass-dialog wide">
          <DialogTitle className="dialog-title">Different paths, side by side</DialogTitle>
          <DialogDescription>
            Compare the work itself. There’s room to change your mind.
          </DialogDescription>
          <div className="comparison-grid">
            {degrees
              .filter(d => compare.includes(d.id))
              .map(d => (
                <section key={d.id}>
                  <h3>{d.name}</h3>
                  <p>{d.description}</p>
                  <strong>Useful subjects</strong>
                  <p>{d.subjects.join(', ')}</p>
                  <strong>Sample career</strong>
                  <p>{d.roles[0]}</p>
                  <strong>A small first experiment</strong>
                  <p>{d.trial}</p>
                  <button
                    className="button dark"
                    onClick={() => {
                      onGoal(d);
                      setComparing(false);
                    }}
                  >
                    Choose this direction
                  </button>
                </section>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
