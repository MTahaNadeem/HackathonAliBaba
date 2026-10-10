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
} from 'lucide-react';
import { qualifications, interestOptions, skillNames, sourceLinks } from '@/lib/catalogue';
import { type Profile } from '@/lib/domain';
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
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  cloud: boolean;
  busy: boolean;
  email?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onChangePassword?: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState('');
  const [cvLoading, setCvLoading] = useState(false);
  const [cvStatus, setCvStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function change<K extends keyof Profile>(k: K, v: Profile[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function toggle(k: 'interests' | 'skills' | 'subjects', v: string) {
    change(k, draft[k].includes(v) ? draft[k].filter((x) => x !== v) : [...draft[k], v]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = profileSchema.safeParse(draft);
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
              onChange={(v) => change('stage', v)}
            />
            <Choice
              label="School / college qualification"
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
              <span>City</span>
              <input
                maxLength={60}
                value={draft.city}
                onChange={(e) => change('city', e.target.value)}
                placeholder="e.g. Lahore"
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
              <h2>Make it work for your life</h2>
              <p>Practical constraints matter as much as ambition.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Semester education budget (PKR)</span>
              <input
                type="number"
                min={0}
                max={10000000}
                value={draft.budget ?? ''}
                onChange={(e) =>
                  change('budget', e.target.value === '' ? null : Number(e.target.value))
                }
                placeholder="e.g. 250000"
              />
              <small>Tuition and mandatory semester charges. Living costs are separate.</small>
            </label>
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
            label="I can consider universities outside my city"
            checked={draft.relocate}
            onChange={(v) => change('relocate', v)}
          />
        </section>

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

        <section className="form-section">
          <div className="form-section-heading">
            <span>05</span>
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
            <span>06</span>
            <div>
              <h2>Career & Evidence</h2>
              <p>Upload a resume to auto-fill skills, experience, projects & certifications.</p>
            </div>
          </div>

          <div className="resume-dropzone-container">
            {/* Helper text clearly positioned above the dropzone */}
            <div className="resume-dropzone-helper">
              <FileText size={18} style={{ flexShrink: 0 }} />
              <span>Upload a PDF or Word to extract your profile automatically.</span>
            </div>

            {/* Styled dashed-border dropzone box */}
            <div
              className={`resume-dropzone ${isDragging ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''} ${cvLoading ? 'loading' : ''}`}
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
                  <h3 className="resume-dropzone-primary">Upload your resume</h3>
                  <p className="resume-dropzone-secondary">PDF or Word, up to 5MB</p>
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
            {busy ? 'Saving…' : cloud ? 'Save my profile' : 'Use these preferences'}
          </button>
        </div>
      </form>
    </>
  );
}
