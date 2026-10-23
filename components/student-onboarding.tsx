'use client';
import { useState } from 'react';
import {
  GraduationCap,
  Compass,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Search,
  MapPin,
  Coins,
  BookOpen
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { degrees, qualifications, interestOptions, type Degree } from '@/lib/catalogue';
import { type Profile } from '@/lib/domain';

const commonSubjects = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Economics',
  'Business',
  'Accounting',
  'English',
  'Art',
  'History',
  'Islamic Studies'
];

const majorCities = [
  'Islamabad',
  'Lahore',
  'Karachi',
  'Rawalpindi',
  'Peshawar',
  'Faisalabad',
  'Multan',
  'Quetta',
  'Other / Remote'
];

interface StudentOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onSaveProfile: (updated: Profile) => Promise<void> | void;
  onDegreeSelectedAndFindUnis: (degreeId: string, updated: Profile) => void;
  onCompletedExploreDegrees: (updated: Profile) => void;
}

export default function StudentOnboarding({
  open,
  onOpenChange,
  profile,
  onSaveProfile,
  onDegreeSelectedAndFindUnis,
  onCompletedExploreDegrees,
}: StudentOnboardingProps) {
  // Step 1: Branch question (null = undecided), 2A = Degree Known, 2B = Degree Unknown
  const [knowsDegree, setKnowsDegree] = useState<boolean | null>(
    typeof profile.student_knows_degree === 'boolean' ? profile.student_knows_degree : null
  );

  // Branch A: Degree Known state
  const [selectedDegreeId, setSelectedDegreeId] = useState<string>(profile.goal || 'computing');
  const [degreeSearch, setDegreeSearch] = useState('');
  const [qualification, setQualification] = useState(profile.qualification || 'FSc');
  const [ssc, setSsc] = useState<string>(profile.ssc ? String(profile.ssc) : '');
  const [hssc, setHssc] = useState<string>(profile.hssc ? String(profile.hssc) : '');
  const [net, setNet] = useState<string>(profile.net ? String(profile.net) : '');
  const [equivalence, setEquivalence] = useState<boolean>(profile.equivalence || false);
  const [city, setCity] = useState(profile.city || 'Islamabad');
  const [budget, setBudget] = useState<string>(
    typeof profile.budget === 'number' && profile.budget > 0 ? String(profile.budget) : '200000'
  );

  // Branch B: Degree Unknown state
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    profile.subjects && profile.subjects.length > 0 ? profile.subjects : ['Mathematics', 'Physics']
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    profile.interests && profile.interests.length > 0
      ? profile.interests
      : ['Problem solving', 'Technology']
  );

  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const toggleInterest = (item: string) => {
    setSelectedInterests(prev =>
      prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]
    );
  };

  const filteredDegrees = degrees.filter(d =>
    `${d.name} ${d.field} ${d.description}`.toLowerCase().includes(degreeSearch.toLowerCase())
  );

  // Handle Branch A completion
  const handleFinishKnownDegree = async () => {
    const parsedBudget = Number(budget);
    const parsedSsc = ssc ? Number(ssc) : null;
    const parsedHssc = hssc ? Number(hssc) : null;
    const parsedNet = net ? Number(net) : null;

    const updatedProfile: Profile = {
      ...profile,
      journey: 'student',
      student_knows_degree: true,
      goal: selectedDegreeId,
      qualification,
      ssc: parsedSsc,
      hssc: parsedHssc,
      net: parsedNet,
      equivalence,
      city,
      budget: !isNaN(parsedBudget) && parsedBudget > 0 ? parsedBudget : null,
    };

    await onSaveProfile(updatedProfile);
    onOpenChange(false);
    onDegreeSelectedAndFindUnis(selectedDegreeId, updatedProfile);
  };

  // Handle Branch B completion
  const handleFinishUnknownDegree = async () => {
    const parsedBudget = Number(budget);

    const updatedProfile: Profile = {
      ...profile,
      journey: 'student',
      student_knows_degree: false,
      subjects: selectedSubjects,
      interests: selectedInterests,
      city: city || profile.city || 'Islamabad',
      budget: !isNaN(parsedBudget) && parsedBudget > 0 ? parsedBudget : (profile.budget || null),
    };

    await onSaveProfile(updatedProfile);
    onOpenChange(false);
    onCompletedExploreDegrees(updatedProfile);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="coursecompass-dialog wide" style={{ maxWidth: '820px' }}>
        {knowsDegree === null ? (
          /* STEP 1: Branching Question */
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: '#eff6ff', borderRadius: '20px', color: '#2563eb', fontSize: '12px', fontWeight: 600, marginBottom: '12px' }}>
              <GraduationCap size={15} />
              <span>STUDENT ONBOARDING</span>
            </div>
            <DialogTitle className="dialog-title" style={{ fontSize: '28px', marginBottom: '8px', color: 'var(--midnight)' }}>
              Do you already know which degree you want to study?
            </DialogTitle>
            <DialogDescription style={{ fontSize: '15px', color: 'var(--secondary)', marginBottom: '26px' }}>
              CourseCompass AI personalizes your path based on where you are right now. Choose your starting point:
            </DialogDescription>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', margin: '20px 0 10px' }}>
              {/* Option Yes */}
              <button
                type="button"
                onClick={() => setKnowsDegree(true)}
                style={{
                  textAlign: 'left',
                  background: '#ffffff',
                  border: '2px solid #e2e8f1',
                  borderRadius: '18px',
                  padding: '24px 22px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3264d6';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(50, 100, 214, 0.09)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e2e8f1';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#eef4fd', color: '#275abf', display: 'grid', placeItems: 'center' }}>
                  <GraduationCap size={24} />
                </div>
                <div>
                  <strong style={{ fontSize: '18px', color: 'var(--midnight)', display: 'block', marginBottom: '6px' }}>
                    Yes, I have a degree in mind
                  </strong>
                  <p style={{ fontSize: '13.5px', color: 'var(--secondary)', lineHeight: 1.6, margin: 0 }}>
                    I already know my target discipline (e.g. BS Computer Science, MBBS, Civil Engineering) and want to find eligible Pakistani universities and calculate my merit.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#3264d6', fontSize: '13px', fontWeight: 600 }}>
                  <span>Choose degree &amp; find universities</span>
                  <ArrowRight size={15} />
                </div>
              </button>

              {/* Option No */}
              <button
                type="button"
                onClick={() => setKnowsDegree(false)}
                style={{
                  textAlign: 'left',
                  background: '#ffffff',
                  border: '2px solid #e2e8f1',
                  borderRadius: '18px',
                  padding: '24px 22px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3ab07a';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(58, 176, 122, 0.09)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e2e8f1';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#ecfdf5', color: '#10b981', display: 'grid', placeItems: 'center' }}>
                  <Compass size={24} />
                </div>
                <div>
                  <strong style={{ fontSize: '18px', color: 'var(--midnight)', display: 'block', marginBottom: '6px' }}>
                    No, help me explore degree paths
                  </strong>
                  <p style={{ fontSize: '13.5px', color: 'var(--secondary)', lineHeight: 1.6, margin: 0 }}>
                    I am still deciding. Recommend the Top 5 degree paths based on my high school subjects, strengths, and personal interests.
                  </p>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
                  <span>Explore personalized degree matches</span>
                  <ArrowRight size={15} />
                </div>
              </button>
            </div>
          </div>
        ) : knowsDegree === true ? (
          /* STEP 2A: Degree Known Flow */
          <div>
            <button
              type="button"
              onClick={() => setKnowsDegree(null)}
              className="text-button"
              style={{ fontSize: '13px', marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Back to choice
            </button>
            <DialogTitle className="dialog-title" style={{ fontSize: '24px', marginBottom: '6px' }}>
              Select your degree &amp; check eligibility
            </DialogTitle>
            <DialogDescription style={{ fontSize: '14px', color: 'var(--secondary)', marginBottom: '20px' }}>
              Pick your target degree from the verified Pakistani catalogue, and provide your academic marks to compute verified merit cutoffs.
            </DialogDescription>

            {/* 1. Target Degree Selector */}
            <div className="field" style={{ marginBottom: '18px' }}>
              <span style={{ fontWeight: 600 }}>Target Degree</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                <div className="search-field" style={{ flex: 1, minHeight: '42px' }}>
                  <Search size={16} />
                  <input
                    placeholder="Search 33 verified degrees (e.g. Computer Science, Economics, Civil)..."
                    value={degreeSearch}
                    onChange={e => setDegreeSearch(e.target.value)}
                    style={{ minHeight: '40px' }}
                  />
                </div>
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', padding: '6px' }}>
                {filteredDegrees.map(d => {
                  const isSelected = selectedDegreeId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDegreeId(d.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 0,
                        background: isSelected ? '#eff6ff' : 'transparent',
                        color: isSelected ? '#1e40af' : 'var(--foreground)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '13.5px',
                      }}
                    >
                      <div>
                        <strong>{d.name}</strong>
                        <span style={{ fontSize: '11.5px', color: 'var(--secondary)', marginLeft: '8px' }}>
                          ({d.field})
                        </span>
                      </div>
                      {isSelected && <Check size={16} style={{ color: '#2563eb' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Academic Info Grid */}
            <div className="form-grid" style={{ gap: '14px', marginBottom: '16px' }}>
              <label className="field">
                <span>Current Qualification</span>
                <select
                  value={qualification}
                  onChange={e => setQualification(e.target.value)}
                  className="coursecompass-select"
                  style={{ minHeight: '42px', borderRadius: '8px' }}
                >
                  {qualifications.map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Preferred Study City</span>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="coursecompass-select"
                  style={{ minHeight: '42px', borderRadius: '8px' }}
                >
                  {majorCities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid three" style={{ gap: '12px', marginBottom: '16px' }}>
              <label className="field">
                <span>SSC / Matric (%)</span>
                <input
                  type="number"
                  placeholder="e.g. 85"
                  min="0"
                  max="100"
                  value={ssc}
                  onChange={e => setSsc(e.target.value)}
                  style={{ minHeight: '42px' }}
                />
              </label>

              <label className="field">
                <span>HSSC / FSc (%)</span>
                <input
                  type="number"
                  placeholder="e.g. 82"
                  min="0"
                  max="100"
                  value={hssc}
                  onChange={e => setHssc(e.target.value)}
                  style={{ minHeight: '42px' }}
                />
              </label>

              <label className="field">
                <span>NET / Test Score (%)</span>
                <input
                  type="number"
                  placeholder="e.g. 75"
                  min="0"
                  max="100"
                  value={net}
                  onChange={e => setNet(e.target.value)}
                  style={{ minHeight: '42px' }}
                />
              </label>
            </div>

            <div className="form-grid" style={{ gap: '14px', marginBottom: '20px' }}>
              <label className="field">
                <span>Budget per Semester (PKR)</span>
                <input
                  type="number"
                  placeholder="e.g. 200000"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  style={{ minHeight: '42px' }}
                />
              </label>

              {(qualification === 'A-levels' || qualification === 'Other equivalent') && (
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                  <label className="check-field" style={{ fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={equivalence}
                      onChange={e => setEquivalence(e.target.checked)}
                    />
                    <span>I have official IBCC equivalence certificates</span>
                  </label>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="button" className="button outline" onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button dark"
                onClick={handleFinishKnownDegree}
                disabled={!selectedDegreeId}
              >
                Find Eligible Universities <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* STEP 2B: Degree Unknown Flow */
          <div>
            <button
              type="button"
              onClick={() => setKnowsDegree(null)}
              className="text-button"
              style={{ fontSize: '13px', marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Back to choice
            </button>
            <DialogTitle className="dialog-title" style={{ fontSize: '24px', marginBottom: '6px' }}>
              Discover your best-fit degree paths
            </DialogTitle>
            <DialogDescription style={{ fontSize: '14px', color: 'var(--secondary)', marginBottom: '18px' }}>
              Select your academic subjects and what you genuinely enjoy. We will calculate explainable match percentages across 33 degrees.
            </DialogDescription>

            {/* 1. Academic Subjects */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px', color: 'var(--foreground)' }}>
                1. Your High-School / College Subjects
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {commonSubjects.map(s => {
                  const active = selectedSubjects.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSubject(s)}
                      className={`chip ${active ? 'selected' : ''}`}
                      style={{ minHeight: '34px', padding: '6px 12px', fontSize: '12.5px' }}
                    >
                      {active && <Check size={13} style={{ marginRight: '4px' }} />}
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Personal Interests */}
            <div style={{ marginBottom: '18px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px', color: 'var(--foreground)' }}>
                2. What do you naturally enjoy doing?
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {interestOptions.map(i => {
                  const active = selectedInterests.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleInterest(i)}
                      className={`chip ${active ? 'selected' : ''}`}
                      style={{ minHeight: '34px', padding: '6px 12px', fontSize: '12.5px' }}
                    >
                      {active && <Check size={13} style={{ marginRight: '4px' }} />}
                      <span>{i}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Location & Budget */}
            <div className="form-grid" style={{ gap: '14px', marginBottom: '20px' }}>
              <label className="field">
                <span>Preferred City</span>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="coursecompass-select"
                  style={{ minHeight: '42px', borderRadius: '8px' }}
                >
                  {majorCities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Approximate Semester Budget (PKR)</span>
                <input
                  type="number"
                  placeholder="e.g. 200000"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  style={{ minHeight: '42px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="button" className="button outline" onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button dark"
                onClick={handleFinishUnknownDegree}
                disabled={selectedSubjects.length === 0 && selectedInterests.length === 0}
              >
                Generate Top 5 Degree Matches <Sparkles size={16} />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
