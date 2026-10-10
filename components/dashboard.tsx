import {ArrowUpRight,ArrowRight,Compass,GraduationCap,BriefcaseBusiness,Sparkles,Layers3,Check} from 'lucide-react';

interface DashboardProps {
  go: (id: string) => void;
  onChat: () => void;
}

export default function Dashboard({go, onChat}: DashboardProps) {
  return (
    <>
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