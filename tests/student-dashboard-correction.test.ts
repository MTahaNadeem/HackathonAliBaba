import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../components/dashboard';
import { emptyProfile, type Profile } from '../lib/domain';
import { degrees } from '../lib/catalogue';

// ── Test 1: Case A (Student has selected a degree)
test('Dashboard Case A: prominently shows selected degree, top verified universities, eligibility, tuition, and Master Your Degree', () => {
  const profile: Profile = {
    ...emptyProfile,
    name: 'Hamza',
    journey: 'student',
    student_knows_degree: true,
    goal: 'computing', // Computer science
    qualification: 'FSc',
    ssc: 88,
    hssc: 84,
    net: 78,
    city: 'Islamabad',
    budget: 250000,
  };

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      session: null, // Guest with saved onboarding
      profile,
      plan: null,
    })
  );

  // 1. Personalized greeting & workspace
  assert.match(html, /Welcome back, Hamza!/);
  assert.match(html, /Your target degree path is Computer science/);

  // 2. Master Your Degree entry point
  assert.match(html, /MASTER YOUR DEGREE/);
  assert.match(html, /Master Your Degree in Computer science/);
  assert.match(html, /Bridge campus coursework with high-demand industry skills/);
  assert.match(html, /Specialized Roadmap/);

  // 3. Top Universities for selected degree
  assert.match(html, /Top Universities for Computer science/);
  assert.match(html, /Ranked using verified admission rules for your FSc qualification in Islamabad and semester budget\./);

  // 4. Universities offering exact degree are listed with eligibility and fee
  assert.match(html, /Quaid-i-Azam University/);
  assert.match(html, /BS Computer Science/);
  assert.match(html, /Academic minimum met/);
  assert.match(html, /Within semester budget/);
  assert.match(html, /PKR 68,490/);

  // 5. Actions: View Campus Details & Compare
  assert.match(html, /View Campus Details/);
  assert.match(html, /Compare/);

  // 6. Unrelated degrees must NOT appear in Case A university recommendations
  assert.doesNotMatch(html, /BS Civil Engineering/);
  assert.doesNotMatch(html, /BS Economics/);
});

// ── Test 2: Case B (Student has NOT selected a degree)
test('Dashboard Case B: prominently shows Top 5 Degree Paths, 0-100 scores, reasons, skills, and Select Degree CTA', () => {
  const profile: Profile = {
    ...emptyProfile,
    name: 'Sara',
    journey: 'student',
    student_knows_degree: false,
    goal: '', // Undecided
    qualification: 'FSc',
    subjects: ['Mathematics', 'Computer Science'],
    interests: ['Technology', 'Problem solving'],
    city: 'Lahore',
    budget: 200000,
  };

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      session: null,
      profile,
      plan: null,
    })
  );

  // 1. Personalized greeting
  assert.match(html, /Welcome back, Sara!/);

  // 2. Top 5 Degree Paths section heading
  assert.match(html, /Top 5 Degree Paths for You/);
  assert.match(html, /Deterministic match estimates based on your high-school subjects and interests\./);

  // 3. Match score pills
  assert.match(html, /% Match/);

  // 4. Relevant tech degrees ranked
  assert.match(html, /Computer science/);

  // 5. Connected capabilities & skills
  assert.match(html, /key skills in this degree/i);
  assert.match(html, /degree-skill-chip/);

  // 6. Profile match reasons
  assert.match(html, /Directly connects with your (Computer Science|Mathematics) background/);
  assert.match(html, /Matches your interest in technology/i);

  // 7. Actions: Select Degree & Explore all 33 degrees
  assert.match(html, /Select Degree/);
  assert.match(html, /Explore all 33 degrees/);
});

// ── Test 3: Preliminary recommendations indicator for incomplete profile
test('Dashboard Case B shows preliminary recommendation warning when subjects/interests are missing', () => {
  const incompleteProfile: Profile = {
    ...emptyProfile,
    journey: 'student',
    student_knows_degree: false,
    goal: '',
    subjects: [],
    interests: [],
    city: 'Karachi',
    budget: 150000,
  };

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      onStartStudentOnboarding: () => {},
      session: null,
      profile: incompleteProfile,
      plan: null,
    })
  );

  // Preliminary banner
  assert.match(html, /Preliminary recommendations:/);
  assert.match(html, /We are displaying general disciplines\. Complete your subjects and interests to see accurate match percentages\./);
  assert.match(html, /Answer questionnaire/);
});

// ── Test 4: Pure guest without activity sees the guest exploration landing page
test('First-time guest with empty profile sees guest landing page', () => {
  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      session: null,
      profile: emptyProfile,
      plan: null,
    })
  );

  // Brand and marketing landing page
  assert.match(html, /CourseCompass AI/);
  assert.match(html, /Your future, with a.*clearer direction\./);
  assert.match(html, /I&#x27;m a Student/);
  assert.match(html, /I&#x27;m Building My Career/);
  assert.match(html, /Explore My Options/);
});
