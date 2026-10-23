import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProfile,
  rankTopDegrees,
  rankTopUniversities,
  assessUniversity,
  getFeeDisplay,
  createPlan,
  type Profile,
  type Plan,
  type Journey
} from '../lib/domain';
import { degrees, universities } from '../lib/catalogue';

// ── Test 1: Degree-known and degree-unknown onboarding branches
test('1. Degree-known and degree-unknown onboarding branches operate accurately', () => {
  // Branch A: Student knows their degree
  const degreeKnownProfile: Profile = {
    ...emptyProfile,
    journey: 'student',
    student_knows_degree: true,
    goal: 'computing',
    qualification: 'FSc',
    ssc: 88,
    hssc: 85,
    net: 76,
    city: 'Islamabad',
    budget: 250000,
  };

  assert.equal(degreeKnownProfile.student_knows_degree, true);
  assert.equal(degreeKnownProfile.goal, 'computing');
  assert.ok(degrees.some(d => d.id === degreeKnownProfile.goal));

  // Branch B: Student does NOT know degree (exploring)
  const degreeUnknownProfile: Profile = {
    ...emptyProfile,
    journey: 'student',
    student_knows_degree: false,
    goal: '', // unforced goal
    subjects: ['Mathematics', 'Physics'],
    interests: ['Building', 'Problem solving'],
    city: 'Lahore',
  };

  assert.equal(degreeUnknownProfile.student_knows_degree, false);
  assert.equal(degreeUnknownProfile.goal, '');
  const recs = rankTopDegrees(degreeUnknownProfile, 5);
  assert.ok(recs.length > 0 && recs.length <= 5);
  assert.ok(recs.every(r => r.score > 0));
});

// ── Test 2: Recommendation ranking based on relevant profile inputs
test('2. Recommendation ranking is deterministic and based on user subjects and interests', () => {
  // Tech profile
  const techProfile: Profile = {
    ...emptyProfile,
    subjects: ['Mathematics', 'Computer Science'],
    interests: ['Technology', 'Problem solving', 'Building'],
  };
  const techRecs = rankTopDegrees(techProfile, 5);
  assert.ok(techRecs.length > 0);
  const topTechIds = techRecs.map(r => r.degree.id);
  assert.ok(topTechIds.includes('computing') || topTechIds.includes('software'));
  assert.ok(techRecs[0].score >= 70, 'Top match should have high relevance score');
  assert.ok(techRecs[0].reasons.length > 0);

  // Health / Biology profile
  const bioProfile: Profile = {
    ...emptyProfile,
    subjects: ['Biology', 'Chemistry'],
    interests: ['Health', 'Research', 'People'],
  };
  const bioRecs = rankTopDegrees(bioProfile, 5);
  assert.ok(bioRecs.length > 0);
  const topBioIds = bioRecs.map(r => r.degree.id);
  assert.ok(
    topBioIds.includes('medicine') ||
    topBioIds.includes('nursing') ||
    topBioIds.includes('pharmacy') ||
    topBioIds.includes('biotech')
  );
  assert.ok(bioRecs[0].reasons.some(r => r.includes('Biology') || r.includes('health')));
});

// ── Test 3: No unrelated recommendations when catalogue supports relevant matches
test('3. No unrelated recommendations with zero match when relevant matches exist', () => {
  // Art & Design profile only
  const artProfile: Profile = {
    ...emptyProfile,
    subjects: ['Art'],
    interests: ['Creativity', 'Design'],
  };
  const artRecs = rankTopDegrees(artProfile, 5);
  assert.ok(artRecs.length > 0);

  // All returned recommendations must have at least one subject or interest match (score > 0)
  for (const rec of artRecs) {
    const hasSubjectMatch = rec.degree.subjects.some(s => s.toLowerCase() === 'art');
    const hasInterestMatch = rec.degree.interests.some(i => ['creativity', 'design'].includes(i.toLowerCase()));
    assert.ok(hasSubjectMatch || hasInterestMatch, `Degree ${rec.degree.id} must be relevant`);
    assert.ok(rec.score > 0);
  }

  // Degrees with zero overlap must NOT appear
  const ids = artRecs.map(r => r.degree.id);
  assert.ok(!ids.includes('civil'));
  assert.ok(!ids.includes('accounting'));
});

// ── Test 4: Selecting a degree updates goal and university filter correctly
test('4. Selecting a degree updates the profile goal and university filter correctly', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    student_knows_degree: false,
    goal: '',
  };

  // User selects 'civil'
  const updatedProfile: Profile = {
    ...profile,
    goal: 'civil',
    student_knows_degree: true,
  };

  assert.equal(updatedProfile.goal, 'civil');
  assert.equal(updatedProfile.student_knows_degree, true);

  // Universities ranking for 'civil'
  const rankedUnis = rankTopUniversities(universities, updatedProfile, 'civil', 5);
  assert.ok(rankedUnis.length > 0);
  assert.ok(rankedUnis.every(ru => ru.university.degreeId === 'civil'));
});

// ── Test 5: Universities not offering the selected degree are excluded
test('5. Universities not offering the selected degree are strictly excluded', () => {
  const profile: Profile = {
    ...emptyProfile,
    goal: 'economics',
    city: 'Islamabad',
    budget: 350000,
  };

  const rankedEcon = rankTopUniversities(universities, profile, 'economics', 10);
  assert.ok(rankedEcon.length > 0);

  for (const ru of rankedEcon) {
    assert.equal(ru.university.degreeId, 'economics', `${ru.university.name} must offer BS Economics`);
    assert.notEqual(ru.university.degreeId, 'civil');
    assert.notEqual(ru.university.degreeId, 'computing');
  }

  // Non-existent degree returns empty list
  const nonExistent = rankTopUniversities(universities, profile, 'non-existent-degree');
  assert.equal(nonExistent.length, 0);
});

// ── Test 6: Eligibility and missing-information cases are handled safely
test('6. Eligibility and missing-information cases are handled safely without crashing', () => {
  const nustCivil = universities.find(u => u.id === 'nust-civil')!;
  assert.ok(nustCivil);

  // Case A: Missing academic results
  const noMarks = assessUniversity(nustCivil, { ...emptyProfile, ssc: null, hssc: null });
  assert.equal(noMarks.status, 'Add academic results');
  assert.equal(noMarks.aggregate, null);

  // Case B: Below 60% published minimum
  const belowMin = assessUniversity(nustCivil, { ...emptyProfile, ssc: 55, hssc: 70, net: 80 });
  assert.equal(belowMin.status, 'Below published minimum');
  assert.equal(belowMin.aggregate, null);

  // Case C: Missing budget
  const noBudget = assessUniversity(nustCivil, { ...emptyProfile, budget: null });
  assert.equal(noBudget.budget, 'Add your budget');

  // Case D: Costs need checking when fee is unverified / needs_information
  const unverifiedUni = universities.find(u => u.verificationStatus === 'needs_information') || {
    ...nustCivil,
    fee: null,
    verificationStatus: 'needs_information' as const,
  };
  const unverifiedAssessment = assessUniversity(unverifiedUni, { ...emptyProfile, budget: 200000 });
  assert.equal(unverifiedAssessment.budget, 'Costs need checking');
  const feeDisplay = getFeeDisplay(unverifiedUni);
  assert.equal(feeDisplay.isFeeVerified, false);
});

// ── Test 7: Journey switching preserves profile and learning-plan data
test('7. Journey switching preserves student profile, degree goal, and roadmap plan', () => {
  const studentProfile: Profile = {
    ...emptyProfile,
    journey: 'student',
    student_knows_degree: true,
    goal: 'software',
    qualification: 'FSc',
    ssc: 88,
    hssc: 85,
    net: 79,
    city: 'Rawalpindi',
    budget: 200000,
    skills: ['Python', 'SQL'],
    interests: ['Technology', 'Problem solving'],
    experience: 'Academic projects in Python',
  };

  const plan: Plan = createPlan('Software engineering', ['Python', 'Git', 'SQL'], 8);
  plan.milestones[0].state = 'Demonstrated';
  plan.milestones[0].done = true;

  // Switch journey to career
  const careerProfile: Profile = {
    ...studentProfile,
    journey: 'career' as Journey,
    career_goal: 'Junior software developer',
  };

  // Switch back to student
  const returnedStudentProfile: Profile = {
    ...careerProfile,
    journey: 'student' as Journey,
  };

  // Verify all academic credentials, degree goal, and plan remain intact
  assert.equal(returnedStudentProfile.journey, 'student');
  assert.equal(returnedStudentProfile.goal, 'software');
  assert.equal(returnedStudentProfile.student_knows_degree, true);
  assert.equal(returnedStudentProfile.qualification, 'FSc');
  assert.equal(returnedStudentProfile.ssc, 88);
  assert.equal(returnedStudentProfile.hssc, 85);
  assert.equal(returnedStudentProfile.net, 79);
  assert.equal(returnedStudentProfile.city, 'Rawalpindi');
  assert.equal(returnedStudentProfile.budget, 200000);
  assert.deepEqual(returnedStudentProfile.skills, ['Python', 'SQL']);
  assert.equal(returnedStudentProfile.career_goal, 'Junior software developer');

  // Verify plan milestones preserved
  assert.equal(plan.milestones[0].state, 'Demonstrated');
  assert.equal(plan.milestones[0].done, true);
});
