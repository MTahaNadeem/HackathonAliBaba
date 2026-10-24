'use client';
import { useState, useRef } from 'react';
import {
  BriefcaseBusiness,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Upload,
  FileText,
  X,
  MapPin,
  Clock,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { interestOptions, skillNames, qualifications } from '@/lib/catalogue';
import { type Profile } from '@/lib/domain';

const majorCities = [
  'Islamabad',
  'Lahore',
  'Karachi',
  'Rawalpindi',
  'Peshawar',
  'Faisalabad',
  'Multan',
  'Quetta',
  'Other / Remote',
];

const experienceLevels = [
  { id: 'student', label: 'Student', desc: 'Currently studying' },
  { id: 'fresh', label: 'Fresh Graduate', desc: '0–1 year experience' },
  { id: 'junior', label: 'Junior', desc: '1–3 years experience' },
  { id: 'mid', label: 'Mid-Level', desc: '3–6 years experience' },
  { id: 'senior', label: 'Senior', desc: '6+ years experience' },
];

const careerInterests = [
  'Technology',
  'Data & Analytics',
  'Design & UX',
  'Business & Management',
  'Marketing & Growth',
  'Finance & Accounting',
  'Healthcare',
  'Education',
  'Engineering',
  'Research',
  'Entrepreneurship',
  'Cybersecurity',
  'DevOps & Cloud',
  'AI & Machine Learning',
  'Content & Writing',
  'Sales',
];

const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;
type SkillLevel = (typeof skillLevels)[number];

interface SkillEntry {
  skill: string;
  level: SkillLevel;
}

interface CareerOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onSaveProfile: (updated: Profile) => Promise<void> | void;
}

const STEPS = ['About You', 'Skills', 'Interests & Goals', 'Preferences'] as const;

export default function CareerOnboarding({
  open,
  onOpenChange,
  profile,
  onSaveProfile,
}: CareerOnboardingProps) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 0: Basic Info
  const [name, setName] = useState(profile.name || '');
  const [city, setCity] = useState(profile.city || 'Islamabad');
  const [qualification, setQualification] = useState(profile.qualification || 'BS/B.E.');
  const [experienceLevel, setExperienceLevel] = useState(profile.stage || 'fresh');
  const [experienceText, setExperienceText] = useState(profile.experience || '');
  const [projects, setProjects] = useState(profile.projects || '');
  const [certifications, setCertifications] = useState(profile.certifications || '');

  // Step 1: Skills with levels
  const [skillEntries, setSkillEntries] = useState<SkillEntry[]>(() => {
    const existing = profile.skills || [];
    return existing.slice(0, 12).map(s => ({ skill: s, level: 'Intermediate' as SkillLevel }));
  });
  const [skillSearch, setSkillSearch] = useState('');

  // Step 2: Interests & Goal
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile.interests || []);
  const [careerGoal, setCareerGoal] = useState(profile.career_goal || '');
  const [specialization, setSpecialization] = useState(profile.specialization || '');

  // Step 3: Preferences
  const [hours, setHours] = useState(profile.hours || 10);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvExtracted, setCvExtracted] = useState(profile.extractedSkills || '');
  const [cvUploading, setCvUploading] = useState(false);
  const [cvError, setCvError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const totalSteps = STEPS.length;

  function toggleInterest(i: string) {
    setSelectedInterests(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 8 ? [...prev, i] : prev
    );
  }

  function toggleSkill(skill: string) {
    setSkillEntries(prev => {
      const exists = prev.find(e => e.skill === skill);
      if (exists) return prev.filter(e => e.skill !== skill);
      if (prev.length >= 15) return prev;
      return [...prev, { skill, level: 'Intermediate' }];
    });
  }

  function setSkillLevel(skill: string, level: SkillLevel) {
    setSkillEntries(prev => prev.map(e => e.skill === skill ? { ...e, level } : e));
  }

  const filteredSkills = skillNames.filter(s =>
    s.toLowerCase().includes(skillSearch.toLowerCase()) &&
    !skillEntries.find(e => e.skill === s)
  );

  async function handleCVUpload(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCvError('File must be under 5 MB.');
      return;
    }
    setCvFile(file);
    setCvUploading(true);
    setCvError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch('/api/career/cv', { method: 'POST', body: formData });
      if (!r.ok) throw new Error('Upload failed');
      const data = await r.json() as { extractedSkills?: string; error?: string };
      if (data.extractedSkills) setCvExtracted(data.extractedSkills);
    } catch {
      // CV upload is optional, keep going
      setCvError('CV text could not be extracted automatically. You can add skills manually.');
    } finally {
      setCvUploading(false);
    }
  }

  async function handleFinish() {
    setBusy(true);
    try {
      const updated: Profile = {
        ...profile,
        name: name.trim() || profile.name,
        city,
        qualification: qualification as Profile['qualification'],
        stage: experienceLevel as Profile['stage'],
        experience: experienceText,
        projects,
        certifications,
        skills: skillEntries.map(e => e.skill) as Profile['skills'],
        interests: selectedInterests as Profile['interests'],
        career_goal: careerGoal,
        specialization,
        hours,
        extractedSkills: cvExtracted,
        journey: 'career',
        // Career users don't need degree-specific fields
        budget: profile.budget ?? 0,
        goal: profile.goal || '',
        student_knows_degree: false,
      };
      await onSaveProfile(updated);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const canProceed = [
    city.trim().length > 0 && qualification.length > 0,
    skillEntries.length > 0,
    selectedInterests.length > 0,
    true, // step 3 is optional (CV)
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="coursecompass-dialog career-onboarding-dialog">
        <div className="co-header">
          <div className="co-icon">
            <BriefcaseBusiness size={26} />
          </div>
          <div>
            <DialogTitle className="dialog-title">Build Your Career Profile</DialogTitle>
            <DialogDescription style={{ fontSize: 14, color: '#7590b0', marginTop: 4 }}>
              Step {step + 1} of {totalSteps} — {STEPS[step]}
            </DialogDescription>
          </div>
        </div>

        {/* Progress bar */}
        <div className="co-progress-bar">
          <div
            className="co-progress-fill"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="co-body">
          {/* ── Step 0: About You ─────────────────────────────────── */}
          {step === 0 && (
            <div className="co-step">
              <h2 className="co-step-title">Tell us about yourself</h2>
              <p className="co-step-desc">
                We'll use this to personalize your career recommendations.
              </p>

              <div className="co-field">
                <label className="co-label">Your name <span className="co-opt">(optional)</span></label>
                <input
                  className="co-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ahmed"
                  maxLength={60}
                />
              </div>

              <div className="co-field">
                <label className="co-label">Highest qualification</label>
                <div className="co-chip-grid">
                  {['FSc', 'A-levels', 'BS/B.E.', 'MS/M.E.', 'MBA', 'PhD', 'Diploma', 'O-levels', 'Matric', 'Other equivalent'].map(q => (
                    <button
                      key={q}
                      type="button"
                      className={`chip ${qualification === q ? 'selected' : ''}`}
                      onClick={() => setQualification(q)}
                    >
                      {qualification === q && <Check size={12} />}
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="co-field">
                <label className="co-label">Current experience level</label>
                <div className="co-exp-grid">
                  {experienceLevels.map(e => (
                    <button
                      key={e.id}
                      type="button"
                      className={`co-exp-card ${experienceLevel === e.id ? 'selected' : ''}`}
                      onClick={() => setExperienceLevel(e.id)}
                    >
                      {experienceLevel === e.id && <span className="co-exp-check"><Check size={12} /></span>}
                      <strong>{e.label}</strong>
                      <span>{e.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="co-field">
                <label className="co-label">City <span className="co-req">*</span></label>
                <div className="co-chip-grid">
                  {majorCities.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`chip ${city === c ? 'selected' : ''}`}
                      onClick={() => setCity(c)}
                    >
                      {city === c && <Check size={12} />}
                      <MapPin size={11} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="co-field">
                <label className="co-label">Work experience summary <span className="co-opt">(optional)</span></label>
                <textarea
                  className="co-textarea"
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. 2 years at TechCorp as a Junior Developer, worked on React projects..."
                  value={experienceText}
                  onChange={e => setExperienceText(e.target.value)}
                />
              </div>

              <div className="co-row-2">
                <div className="co-field">
                  <label className="co-label">Projects <span className="co-opt">(optional)</span></label>
                  <textarea
                    className="co-textarea"
                    rows={2}
                    maxLength={400}
                    placeholder="e.g. Built a React e-commerce site, contributed to open-source..."
                    value={projects}
                    onChange={e => setProjects(e.target.value)}
                  />
                </div>
                <div className="co-field">
                  <label className="co-label">Certifications <span className="co-opt">(optional)</span></label>
                  <textarea
                    className="co-textarea"
                    rows={2}
                    maxLength={300}
                    placeholder="e.g. Google Analytics, AWS Cloud Practitioner..."
                    value={certifications}
                    onChange={e => setCertifications(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Skills ────────────────────────────────────── */}
          {step === 1 && (
            <div className="co-step">
              <h2 className="co-step-title">What skills do you have?</h2>
              <p className="co-step-desc">
                Select your skills and rate your proficiency level. This helps us find your genuine career matches.
              </p>

              <label className="search-field" style={{ marginBottom: 16 }}>
                <Zap size={17} />
                <input
                  placeholder="Search skills…"
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  aria-label="Search skills"
                />
              </label>

              <div className="co-chip-grid" style={{ marginBottom: 20 }}>
                {filteredSkills.slice(0, 30).map(s => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    onClick={() => toggleSkill(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {skillEntries.length > 0 && (
                <div className="co-skills-selected">
                  <p className="co-skills-label">
                    <TrendingUp size={14} />
                    Your selected skills ({skillEntries.length})
                  </p>
                  <div className="co-skill-rows">
                    {skillEntries.map(entry => (
                      <div key={entry.skill} className="co-skill-row">
                        <span className="co-skill-name">{entry.skill}</span>
                        <div className="co-level-pills">
                          {skillLevels.map(lvl => (
                            <button
                              key={lvl}
                              type="button"
                              className={`co-level-pill ${entry.level === lvl ? 'active' : ''}`}
                              onClick={() => setSkillLevel(entry.skill, lvl)}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                        <button
                          className="co-remove"
                          onClick={() => toggleSkill(entry.skill)}
                          aria-label={`Remove ${entry.skill}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skillEntries.length === 0 && (
                <div className="co-empty-notice">
                  <Zap size={18} />
                  <span>Select at least one skill to get personalized career matches.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Interests & Goals ─────────────────────────── */}
          {step === 2 && (
            <div className="co-step">
              <h2 className="co-step-title">Interests & Career Goals</h2>
              <p className="co-step-desc">
                Select up to 8 areas that genuinely interest you. Be honest — this shapes your recommendations.
              </p>

              <div className="co-field">
                <label className="co-label">Career fields you're drawn to ({selectedInterests.length}/8)</label>
                <div className="co-chip-grid">
                  {careerInterests.map(i => (
                    <button
                      key={i}
                      type="button"
                      className={`chip ${selectedInterests.includes(i) ? 'selected' : ''} ${selectedInterests.length >= 8 && !selectedInterests.includes(i) ? 'chip-disabled' : ''}`}
                      onClick={() => toggleInterest(i)}
                      disabled={selectedInterests.length >= 8 && !selectedInterests.includes(i)}
                    >
                      {selectedInterests.includes(i) && <Check size={12} />}
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div className="co-row-2">
                <div className="co-field">
                  <label className="co-label">
                    <Target size={14} />
                    Dream career or role <span className="co-opt">(optional)</span>
                  </label>
                  <input
                    className="co-input"
                    placeholder="e.g. Full Stack Developer, Data Scientist, Product Manager"
                    value={careerGoal}
                    onChange={e => setCareerGoal(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="co-field">
                  <label className="co-label">
                    Specialization hint <span className="co-opt">(optional)</span>
                  </label>
                  <input
                    className="co-input"
                    placeholder="e.g. Machine Learning, Mobile Apps, Finance Tech"
                    value={specialization}
                    onChange={e => setSpecialization(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Preferences + CV ──────────────────────────── */}
          {step === 3 && (
            <div className="co-step">
              <h2 className="co-step-title">Final Preferences</h2>
              <p className="co-step-desc">
                Almost done! Set your learning pace and optionally upload your CV for even better matches.
              </p>

              <div className="co-field">
                <label className="co-label">
                  <Clock size={14} />
                  Learning hours available per week: <strong>{hours}h</strong>
                </label>
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={hours}
                  onChange={e => setHours(Number(e.target.value))}
                  className="co-range"
                  aria-label="Hours per week"
                />
                <div className="co-range-labels">
                  <span>1h</span>
                  <span>10h</span>
                  <span>20h</span>
                  <span>40h</span>
                </div>
              </div>

              <div className="co-cv-section">
                <div className="co-cv-header">
                  <FileText size={20} />
                  <div>
                    <strong>Upload Your CV / Resume</strong>
                    <p>Optional — helps extract your skills and experience automatically</p>
                  </div>
                  <span className="co-opt-badge">Optional</span>
                </div>

                <div
                  className={`co-cv-drop ${cvFile ? 'has-file' : ''}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) void handleCVUpload(f);
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) void handleCVUpload(f); }}
                  />
                  {cvUploading ? (
                    <span className="co-cv-state">
                      <span className="spin" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #3264d6', borderTopColor: 'transparent', borderRadius: '50%' }} />
                      Extracting skills from your CV…
                    </span>
                  ) : cvFile ? (
                    <span className="co-cv-state success">
                      <Check size={18} />
                      {cvFile.name}
                      <button className="co-cv-remove" onClick={e => { e.stopPropagation(); setCvFile(null); setCvExtracted(''); }}>
                        <X size={14} /> Remove
                      </button>
                    </span>
                  ) : (
                    <span className="co-cv-state">
                      <Upload size={20} />
                      Drag & drop or click to upload
                      <small>PDF, DOCX, or TXT · max 5 MB</small>
                    </span>
                  )}
                </div>

                {cvError && <p className="co-cv-error">{cvError}</p>}

                {cvExtracted && (
                  <div className="co-cv-extracted">
                    <strong>Skills extracted from CV:</strong>
                    <p>{cvExtracted.slice(0, 300)}{cvExtracted.length > 300 ? '…' : ''}</p>
                  </div>
                )}

                <p className="co-privacy-note">
                  Your CV content is processed only for skill extraction. No raw text or personal details are stored or sent to AI models.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Navigation ───────────────────────────────────── */}
        <div className="co-footer">
          <button
            className="button outline"
            onClick={() => step === 0 ? onOpenChange(false) : setStep(s => s - 1)}
          >
            <ArrowLeft size={16} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="co-step-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`co-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
            ))}
          </div>

          {step < totalSteps - 1 ? (
            <button
              className="button blue"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed[step]}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="button blue"
              onClick={() => void handleFinish()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Saving…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Find My Career Matches
                </>
              )}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
