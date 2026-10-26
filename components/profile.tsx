'use client';

import { useState, useRef } from 'react';
import {
  Save,
  ArrowRight,
  Check,
  UserRound,
  Info,
  LogOut,
  Loader2,
  FileText,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { qualifications, interestOptions, skillNames, sourceLinks, degrees } from '@/lib/catalogue';
import { type Profile, isProfileComplete } from '@/lib/domain';
import { profileSchema } from '@/lib/validation';
import { Choice, CheckField } from './fields';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ProfileView({
  profile,
  onSave,
  cloud,
  busy,
  email = '',
  onSignIn,
  onSignOut,
  onChangePassword,
  requiresOnboarding = false,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  cloud: boolean;
  busy: boolean;
  email?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onChangePassword?: () => void;
  requiresOnboarding?: boolean;
}) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState('');
  const [cvLoading, setCvLoading] = useState(false);
  const [cvStatus, setCvStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGraduate = draft.stage === 'Graduate / job seeker';

  function change<K extends keyof Profile>(k: K, v: Profile[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function toggle(k: 'interests' | 'skills' | 'subjects', v: string) {
    change(k, draft[k].includes(v) ? draft[k].filter((x) => x !== v) : [...draft[k], v]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.qualification?.trim()) {
      setError('Please select your school / college qualification.');
      return;
    }
    if (!isGraduate && draft.goal?.trim() && !degrees.some((d) => d.id === draft.goal)) {
      setError('Please select a valid degree path or leave it blank to let our model recommend.');
      return;
    }
    if (!draft.city?.trim()) {
      setError('Please enter your city to filter local options.');
      return;
    }
    if (!isGraduate && (typeof draft.budget !== 'number' || isNaN(draft.budget) || draft.budget <= 0)) {
      setError('Please enter a valid semester budget (greater than PKR 0).');
      return;
    }

    const hasCv = Boolean(
      selectedFile ||
      (draft.resumeText && draft.resumeText.trim().length > 0) ||
      (draft.extractedSkills && draft.extractedSkills.trim().length > 0)
    );

    if (isGraduate && !hasCv) {
      setError('Please upload your CV / resume. A CV is mandatory for the Graduate Career path.');
      return;
    }

    const toSave: Profile = {
      ...draft,
      journey: isGraduate ? 'career' : (draft.journey || 'student'),
      student_knows_degree: draft.goal ? true : (draft.student_knows_degree ?? false),
      budget: isGraduate ? null : draft.budget,
      ssc: isGraduate ? null : draft.ssc,
      hssc: isGraduate ? null : draft.hssc,
      net: isGraduate ? null : draft.net,
    };
    const p = profileSchema.safeParse(toSave);
    if (!p.success) {
      setError(p.error.issues[0]?.message || 'Check your fields.');
      return;
    }
    setError('');
    onSave(p.data);
  }

  const foreign = ['A-levels', 'Other equivalent'].includes(draft.qualification);

  async function processCvFile(file: File) {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCvStatus('❌ File exceeds the 5MB size limit. Please choose a smaller file.');
      return;
    }

    setSelectedFile({
      name: file.name,
      size: formatFileSize(file.size),
    });

    setCvLoading(true);
    setCvStatus('Extracting your CV data with AI...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/profile/extract', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        setCvStatus('❌ ' + ((err as any).error || 'CV extraction failed. Try again.'));
        setCvLoading(false);
        return;
      }

      const data = (await res.json()) as any;
      setDraft((d) => {
        const newSkills = (data.skills || []).join(', ');
        return {
          ...d,
          experience: data.experience || d.experience,
          projects: data.projects || d.projects,
          certifications: data.certifications || d.certifications,
          links: data.links || d.links,
          resumeText: data.resumeText || d.resumeText,
          extractedSkills: newSkills || d.extractedSkills,
          skills: Array.from(new Set([...d.skills, ...(data.skills || []).filter((s: string) => skillNames.includes(s))])),
        };
      });

      setCvStatus('✅ CV extracted! Skills, experience, projects & certifications populated below.');
      setCvLoading(false);
    } catch (err) {
      setCvStatus('❌ Network error. Please try again.');
      setCvLoading(false);
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processCvFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCvFile(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setCvStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE STARTING POINT IS YOU</div>
          <h1>
            A little about <span>your world.</span>
          </h1>
          <p>Your answers shape the options. You can change them anytime.</p>
        </div>
        <span className="catalogue-count">
          {cloud ? 'Account profile' : 'Guest profile · session only'}
        </span>
      </div>

      {(requiresOnboarding || (cloud && !isProfileComplete(profile))) && (
        <div
          className="onboarding-notice inline-note"
          role="alert"
          style={{
            marginBottom: '24px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            padding: '16px 20px',
            borderRadius: '14px',
            display: 'flex',
            gap: '14px',
            alignItems: 'center',
          }}
        >
          <Sparkles size={24} style={{ color: '#2563eb', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#1e3a8a', fontSize: '15px', display: 'block', marginBottom: '2px' }}>
              Complete a few details to personalize your experience
            </strong>
            <span style={{ color: '#3b82f6', fontSize: '13px' }}>
              {isGraduate ? (
                <>
                  Please set your <strong>qualification</strong>, <strong>city</strong>, and upload your <strong>CV / resume</strong> below to unlock tailored career recommendations.
                </>
              ) : (
                <>
                  Please set your <strong>qualification</strong>, <strong>city</strong>, and <strong>semester budget</strong> below to unlock tailored recommendations. You can also specify a <strong>chosen direction</strong> or leave it open to let our model decide.
                </>
              )}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="profile-form">
        <section className="form-section">
          <div className="form-section-heading">
            <span>00</span>
            <div>
              <h2>Your account</h2>
              <p>
                {cloud
                  ? 'Signed in. Change your password or leave whenever you need to.'
                  : 'Sign in to keep this profile across visits.'}
              </p>
            </div>
          </div>
          {cloud ? (
            <div className="account-row">
              <div className="field">
                <span>Email</span>
                <strong className="account-email">{email || 'Signed in'}</strong>
              </div>
              <div className="account-actions">
                <button type="button" className="button outline" onClick={onChangePassword}>
                  Change password
                </button>
                <button type="button" className="button dark" onClick={onSignOut}>
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="account-row">
              <p className="muted">Guest changes last for this session only.</p>
              <button type="button" className="button blue" onClick={onSignIn}>
                Sign in or create account
              </button>
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>Where you are now</h2>
              <p>Every education route has a place here.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>
                What should we call you? <small>(optional)</small>
              </span>
              <input
                maxLength={60}
                value={draft.name}
                onChange={(e) => change('name', e.target.value)}
                placeholder="Your first name"
              />
            </label>
            <Choice
              label="I'm currently…"
              value={draft.stage}
              options={['Choosing a degree', 'Undergraduate', 'Graduate / job seeker']}
              onChange={(v) => {
                change('stage', v);
                if (v === 'Graduate / job seeker') {
                  change('journey', 'career');
                } else {
                  change('journey', 'student');
                }
              }}
            />
            <Choice
              label="School / college qualification *"
              value={draft.qualification}
              options={[...qualifications]}
              onChange={(v) => {
                setDraft((d) => ({
                  ...d,
                  qualification: v,
                  equivalence: false,
                  ssc: null,
                  hssc: null,
                  net: null,
                }));
              }}
            />
            <label className="field">
              <span>
                {isGraduate ? 'Target direction / Field of interest' : 'Chosen direction / Field of interest'} <small style={{ color: '#64748b', fontWeight: 400 }}>(Optional — leave blank to let our model recommend)</small>
              </span>
              <select
                aria-label={isGraduate ? 'Target direction / field of interest' : 'Chosen direction / field of interest'}
                className="coursecompass-select"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: '#fff',
                  fontSize: '14px',
                  color: draft.goal ? '#142d52' : '#8097b2',
                  height: '42px',
                }}
                value={draft.goal || ''}
                onChange={(e) => change('goal', e.target.value)}
              >
                <option value="">{isGraduate ? 'Leave unselected to let our model recommend career paths…' : 'Leave unselected to let our model recommend degree paths…'}</option>
                {['Technology', 'Engineering', 'Business', 'Social sciences', 'Arts & design', 'Sciences', 'Health', 'Humanities'].map((f) => {
                  const degsInField = degrees.filter((d) => d.field === f);
                  if (!degsInField.length) return null;
                  return (
                    <optgroup key={f} label={`── ${f} ──`}>
                      {degsInField.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.field}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
            <label className="field">
              <span>
                City <small style={{ color: '#2563eb', fontWeight: 600 }}>*</small>
              </span>
              <input
                maxLength={60}
                value={draft.city}
                onChange={(e) => change('city', e.target.value)}
                placeholder="e.g. Lahore, Rawalpindi, Islamabad"
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Subjects you studied</span>
            <div className="selection-chips">
              {[
                'Mathematics',
                'Physics',
                'Chemistry',
                'Biology',
                'Computer Science',
                'Economics',
                'Business',
                'English',
                'Art',
                'History',
                'Accounting',
              ].map((s) => (
                <button
                  type="button"
                  key={s}
                  aria-pressed={draft.subjects.includes(s)}
                  className={`chip ${draft.subjects.includes(s) ? 'selected' : ''}`}
                  onClick={() => toggle('subjects', s)}
                >
                  {draft.subjects.includes(s) && <Check size={13} />} {s}
                </button>
              ))}
            </div>
          </label>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2>What catches your curiosity?</h2>
              <p>Choose a few things you genuinely enjoy doing.</p>
            </div>
          </div>
          <div className="selection-chips large">
            {interestOptions.map((s) => (
              <button
                type="button"
                key={s}
                aria-pressed={draft.interests.includes(s)}
                className={`chip ${draft.interests.includes(s) ? 'selected' : ''}`}
                onClick={() => toggle('interests', s)}
              >
                {draft.interests.includes(s) && <Check size={14} />} {s}
              </button>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <span>03</span>
            <div>
              <h2>{isGraduate ? 'Time & Flexibility' : 'Make it work for your life'}</h2>
              <p>{isGraduate ? 'Set your learning availability and relocation preferences.' : 'Practical constraints matter as much as ambition.'}</p>
            </div>
          </div>
          <div className="form-grid">
            {!isGraduate && (
              <label className="field">
                <span>
                  Semester education budget (PKR) <small style={{ color: '#2563eb', fontWeight: 600 }}>*</small>
                </span>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={draft.budget ?? ''}
                  onChange={(e) =>
                    change('budget', e.target.value === '' ? null : Number(e.target.value))
                  }
                  placeholder="e.g. 200000"
                  required={!isGraduate}
                />
                <small>Tuition and mandatory semester charges. Living costs are separate.</small>
              </label>
            )}
            <label className="field">
              <span>Weekly learning time (hours)</span>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={draft.hours}
                onChange={(e) => change('hours', Number(e.target.value))}
              />
            </label>
          </div>
          <CheckField
            label={isGraduate ? 'I can consider opportunities outside my city' : 'I can consider universities outside my city'}
            checked={draft.relocate}
            onChange={(v) => change('relocate', v)}
          />
        </section>

        {!isGraduate && (
          <section className="form-section">
            <div className="form-section-heading">
              <span>04</span>
              <div>
                <h2>
                  Academic results <small>Optional</small>
                </h2>
                <p>Used for source-backed university checks, never sent to the adviser.</p>
              </div>
            </div>
            {foreign && (
              <div className="inline-note">
                <Info size={18} />
                <div>
                  Enter official IBCC equivalence percentages, not raw O/A-level grades.{' '}
                  <a href={sourceLinks.ibcc} target="_blank" rel="noreferrer">
                    Read IBCC guidance ↗
                  </a>
                </div>
              </div>
            )}
            {foreign && (
              <CheckField
                label="These percentages are from my official IBCC equivalence"
                checked={draft.equivalence}
                onChange={(v) => change('equivalence', v)}
              />
            )}
            <div className="form-grid three">
              {(
                [
                  {
                    key: 'ssc',
                    label: foreign ? 'SSC / O-level equivalence (%)' : 'SSC / Matric (%)',
                  },
                  {
                    key: 'hssc',
                    label: foreign
                      ? 'Completed HSSC / A-level equivalence (%)'
                      : 'Completed HSSC / Intermediate (%)',
                  },
                  { key: 'net', label: 'NET score as a percentage (%)' },
                ] as const
              ).map((f) => (
                <label className="field" key={f.key}>
                  <span>{f.label}</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={draft[f.key] ?? ''}
                    onChange={(e) =>
                      change(f.key, e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="Not available yet"
                  />
                </label>
              ))}
            </div>
            <p className="small-text muted">
              NET examples: 150 out of 200 = 75%. The calculator supports completed qualifications on the
              standard NET route. Other routes need official review.
            </p>
          </section>
        )}

        <section className="form-section">
          <div className="form-section-heading">
            <span>{isGraduate ? '04' : '05'}</span>
            <div>
              <h2>Skills you already use</h2>
              <p>Choose what you can do. These remain self-reported until evidenced.</p>
            </div>
          </div>
          <div className="selection-chips">
            {skillNames.map((s) => (
              <button
                type="button"
                key={s}
                aria-pressed={draft.skills.includes(s)}
                className={`chip ${draft.skills.includes(s) ? 'selected' : ''}`}
                onClick={() => toggle('skills', s)}
              >
                {draft.skills.includes(s) && <Check size={14} />} {s}
              </button>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-heading">
            <span>{isGraduate ? '05' : '06'}</span>
            <div>
              <h2>
                Career & Evidence{' '}
                {isGraduate && (
                  <span style={{ color: '#2563eb', fontSize: '0.82em', fontWeight: 600 }}>
                    (Mandatory for Career Path *)
                  </span>
                )}
              </h2>
              <p>
                {isGraduate
                  ? 'Upload your CV / resume (mandatory) to auto-fill skills, experience, projects & certifications.'
                  : 'Upload a resume to auto-fill skills, experience, projects & certifications.'}
              </p>
            </div>
          </div>

          <div className="resume-dropzone-container">
            {/* Helper text clearly positioned above the dropzone */}
            <div className={`resume-dropzone-helper ${isGraduate ? 'mandatory' : ''}`}>
              <FileText size={18} style={{ flexShrink: 0 }} />
              <span>
                {isGraduate
                  ? 'Upload your CV or resume (PDF or Word) to unlock your career recommendations. * Mandatory'
                  : 'Upload a PDF or Word to extract your profile automatically.'}
              </span>
            </div>

            {/* Styled dashed-border dropzone box */}
            <div
              className={`resume-dropzone ${isDragging ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''} ${cvLoading ? 'loading' : ''} ${isGraduate && !selectedFile && !draft.resumeText && !draft.extractedSkills ? 'mandatory' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!cvLoading) fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !cvLoading) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload resume dropzone"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.txt"
                disabled={cvLoading}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {selectedFile ? (
                <>
                  <div className="resume-dropzone-icon">
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="resume-selected-info">
                    <FileText size={18} style={{ color: '#275abf', flexShrink: 0 }} />
                    <span className="resume-filename">{selectedFile.name}</span>
                    <span className="resume-filesize">({selectedFile.size})</span>
                  </div>
                  <p className="resume-dropzone-secondary">
                    Resume file loaded · Click replace to upload another
                  </p>
                  <div className="resume-dropzone-actions">
                    <button
                      type="button"
                      className="button outline"
                      style={{ minHeight: '38px', padding: '8px 16px', fontSize: '13px' }}
                      onClick={handleReplaceClick}
                      disabled={cvLoading}
                    >
                      <RefreshCw size={14} /> Replace file
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      style={{ color: '#a03838', fontSize: '13px', minHeight: '38px' }}
                      onClick={handleRemoveFile}
                      disabled={cvLoading}
                    >
                      <X size={14} /> Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="resume-dropzone-icon">
                    <UploadCloud size={28} />
                  </div>
                  <h3 className="resume-dropzone-primary">
                    Upload your resume {isGraduate && <span style={{ color: '#e11d48' }}>*</span>}
                  </h3>
                  <p className="resume-dropzone-secondary">
                    {isGraduate ? 'Mandatory for graduates · PDF or Word, up to 5MB' : 'PDF or Word, up to 5MB'}
                  </p>
                  <div className="resume-dropzone-actions">
                    <button
                      type="button"
                      className="button outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={cvLoading}
                    >
                      Choose file
                    </button>
                  </div>
                </>
              )}
            </div>

            {cvLoading && (
              <div className="resume-status-badge loading">
                <Loader2 size={16} className="spin" />
                <span>Analyzing your CV with AI...</span>
              </div>
            )}

            {!cvLoading && cvStatus && (
              <div
                className={`resume-status-badge ${cvStatus.startsWith('❌') ? 'error' : 'success'}`}
              >
                {cvStatus.startsWith('❌') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                <span>{cvStatus.replace(/^[✅❌]\s*/, '')}</span>
              </div>
            )}
          </div>

          {draft.extractedSkills && (
            <>
              <p
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  margin: '1rem 0 0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.6,
                }}
              >
                Skills extracted from CV
              </p>
              <div className="selection-chips">
                {draft.extractedSkills
                  .split(/[,\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => (
                    <span
                      key={s}
                      className="chip selected"
                      style={{
                        cursor: 'default',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: '1.5px solid var(--accent)',
                      }}
                    >
                      <Check size={13} /> {s}
                    </span>
                  ))}
              </div>
            </>
          )}

          <div className="form-grid">
            <label className="field">
              <span>Experience</span>
              <textarea
                rows={4}
                maxLength={10000}
                value={draft.experience}
                onChange={(e) => change('experience', e.target.value)}
                placeholder="Work history, internships..."
              />
            </label>
            <label className="field">
              <span>Projects</span>
              <textarea
                rows={4}
                maxLength={10000}
                value={draft.projects}
                onChange={(e) => change('projects', e.target.value)}
                placeholder="Academic or personal projects..."
              />
            </label>
            <label className="field">
              <span>Certifications</span>
              <textarea
                rows={3}
                maxLength={10000}
                value={draft.certifications}
                onChange={(e) => change('certifications', e.target.value)}
                placeholder="Certifications, online courses..."
              />
            </label>
            <label className="field">
              <span>Links</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={draft.links}
                onChange={(e) => change('links', e.target.value)}
                placeholder="LinkedIn, GitHub, Portfolio URLs..."
              />
            </label>
          </div>
        </section>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <div className="form-save">
          <p>
            {cloud
              ? 'Saved securely to your account.'
              : 'Guest changes last for this session. Sign in to save across visits.'}
          </p>
          <button className="button blue" disabled={busy} type="submit">
            <Save size={17} />
            {busy
              ? 'Saving…'
              : isGraduate
                ? (cloud ? 'Save profile & open Career Path' : 'Save & open Career Path')
                : (cloud ? 'Save my profile' : 'Use these preferences')}
          </button>
        </div>
      </form>
    </>
  );
}
