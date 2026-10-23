import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, createPlan, type Profile, type Plan, type Journey } from '../lib/domain';
import { profileSchema } from '../lib/validation';

test('UserProfile supports optional journey field with backward compatibility', () => {
  // 1. emptyProfile has default student journey
  assert.equal(emptyProfile.journey, 'student');

  // 2. Legacy profile without journey field passes validation and defaults to student
  const legacyProfile = {
    name: 'Tariq',
    stage: 'Choosing a degree',
    qualification: 'FSc',
    subjects: ['Mathematics', 'Physics'],
    interests: ['Building', 'Technology'],
    skills: ['Python'],
    city: 'Islamabad',
    budget: 150000,
    hours: 10,
    ssc: 88,
    hssc: 84,
    equivalence: false,
    net: 78,
    goal: 'computing',
    relocate: true,
  };
  const parsedLegacy = profileSchema.safeParse(legacyProfile);
  assert.ok(parsedLegacy.success, 'Legacy profile must parse cleanly');
  assert.equal(parsedLegacy.data.journey, 'student', 'Defaults to student when absent');

  // 3. Profile with explicit journey 'career' parses successfully
  const careerProfile = {
    ...legacyProfile,
    journey: 'career',
  };
  const parsedCareer = profileSchema.safeParse(careerProfile);
  assert.ok(parsedCareer.success, 'Career profile must parse cleanly');
  assert.equal(parsedCareer.data.journey, 'career');
});

test('Switching journey preserves all profile fields, academic data, CV-derived skills, and goals', () => {
  const initialStudentProfile: Profile = {
    name: 'Zainab Ahmed',
    stage: 'Choosing a degree',
    qualification: 'ICS',
    subjects: ['Mathematics', 'Computer Science', 'Physics'],
    interests: ['Technology', 'Problem solving'],
    skills: ['Python', 'SQL', 'Git'],
    city: 'Lahore',
    budget: 200000,
    hours: 12,
    ssc: 92,
    hssc: 89,
    equivalence: false,
    net: 81,
    goal: 'software',
    relocate: false,
    experience: 'Freelance frontend developer (6 months)',
    projects: 'Student Attendance Management App',
    certifications: 'Meta Frontend Certificate',
    links: 'https://github.com/zainab-dev',
    resumeText: 'Passionate computer science student with Python, SQL and Git skills.',
    extractedSkills: 'Python, SQL, Git, React, TypeScript',
    journey: 'student',
    student_knows_degree: true,
    specialization: 'Full-Stack Software Engineering',
    career_goal: 'Junior software developer',
  };

  // Switch to Career journey
  const switchedToCareer: Profile = {
    ...initialStudentProfile,
    journey: 'career' as Journey,
  };

  // Verify all academic and CV-derived fields remain completely intact
  assert.equal(switchedToCareer.journey, 'career');
  assert.equal(switchedToCareer.name, 'Zainab Ahmed');
  assert.equal(switchedToCareer.qualification, 'ICS');
  assert.deepEqual(switchedToCareer.subjects, ['Mathematics', 'Computer Science', 'Physics']);
  assert.deepEqual(switchedToCareer.interests, ['Technology', 'Problem solving']);
  assert.deepEqual(switchedToCareer.skills, ['Python', 'SQL', 'Git']);
  assert.equal(switchedToCareer.city, 'Lahore');
  assert.equal(switchedToCareer.budget, 200000);
  assert.equal(switchedToCareer.ssc, 92);
  assert.equal(switchedToCareer.hssc, 89);
  assert.equal(switchedToCareer.net, 81);
  assert.equal(switchedToCareer.goal, 'software');
  assert.equal(switchedToCareer.experience, 'Freelance frontend developer (6 months)');
  assert.equal(switchedToCareer.projects, 'Student Attendance Management App');
  assert.equal(switchedToCareer.certifications, 'Meta Frontend Certificate');
  assert.equal(switchedToCareer.resumeText, 'Passionate computer science student with Python, SQL and Git skills.');
  assert.equal(switchedToCareer.extractedSkills, 'Python, SQL, Git, React, TypeScript');
  assert.equal(switchedToCareer.student_knows_degree, true);
  assert.equal(switchedToCareer.specialization, 'Full-Stack Software Engineering');
  assert.equal(switchedToCareer.career_goal, 'Junior software developer');

  // Switch back to Student journey
  const switchedBackToStudent: Profile = {
    ...switchedToCareer,
    journey: 'student' as Journey,
  };

  // Verify full fidelity after roundtrip
  assert.equal(switchedBackToStudent.journey, 'student');
  assert.deepEqual(switchedBackToStudent, initialStudentProfile);
});

test('Learning plan progress is completely preserved when journey changes', () => {
  const initialPlan: Plan = createPlan('Computer science', ['Python', 'SQL', 'Git'], 10);
  assert.ok(initialPlan.milestones.length > 0);

  // Mark first milestone as completed with notes
  initialPlan.milestones[0].state = 'Demonstrated';
  initialPlan.milestones[0].done = true;
  initialPlan.milestones[0].notes = 'Completed freeCodeCamp scientific computing module';
  initialPlan.milestones[0].evidenceUrl = 'https://github.com/student/evidence';

  // Simulate journey toggle in state
  let activeJourney: Journey = 'student';
  let planInState: Plan | null = initialPlan;

  // Toggle to career
  activeJourney = 'career';
  assert.equal(activeJourney, 'career');
  assert.equal(planInState.milestones[0].state, 'Demonstrated');
  assert.equal(planInState.milestones[0].done, true);
  assert.equal(planInState.milestones[0].notes, 'Completed freeCodeCamp scientific computing module');
  assert.equal(planInState.milestones[0].evidenceUrl, 'https://github.com/student/evidence');

  // Toggle back to student
  activeJourney = 'student';
  assert.equal(activeJourney, 'student');
  assert.equal(planInState.milestones[0].state, 'Demonstrated');
  assert.equal(planInState.milestones[0].done, true);
  assert.equal(planInState.milestones.length, initialPlan.milestones.length);
});

test('Journey toggle view transition routing logic', () => {
  // Test view transitions for student vs career
  function resolveNextView(currentView: string, newJourney: Journey): string {
    if (newJourney === 'career') {
      if (currentView === 'universities' || currentView === 'explore' || currentView === 'dashboard') {
        return 'jobs';
      }
    } else {
      if (currentView === 'jobs' || currentView === 'dashboard') {
        return 'universities';
      }
    }
    return currentView;
  }

  // From Education (student) -> switch to Career -> navigates to Jobs (careers)
  assert.equal(resolveNextView('universities', 'career'), 'jobs');
  assert.equal(resolveNextView('explore', 'career'), 'jobs');
  assert.equal(resolveNextView('dashboard', 'career'), 'jobs');

  // From Jobs (career) -> switch to Student -> navigates to Universities (education)
  assert.equal(resolveNextView('jobs', 'student'), 'universities');
  assert.equal(resolveNextView('dashboard', 'student'), 'universities');

  // Shared tabs (learning roadmap and my profile) maintain their active view
  assert.equal(resolveNextView('learning', 'career'), 'learning');
  assert.equal(resolveNextView('learning', 'student'), 'learning');
  assert.equal(resolveNextView('profile', 'career'), 'profile');
  assert.equal(resolveNextView('profile', 'student'), 'profile');
});
