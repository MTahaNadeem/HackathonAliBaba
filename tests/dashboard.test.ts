import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../components/dashboard';

test('Dashboard renders required hero section, brand, and supporting copy', () => {
  const html = renderToStaticMarkup(
    React.createElement(Dashboard, { go: () => {}, onChat: () => {} })
  );

  // Brand verification
  assert.match(html, /CourseCompass AI/);

  // Main heading verification
  assert.match(html, /Your future, with a.*clearer direction\./);

  // Supporting text verification
  assert.match(html, /Whether you&#x27;re choosing a university or preparing for your next job, start with where you are\./);

  // Action button preserved
  assert.match(html, /Personalise my path/);
});

test('Dashboard renders both primary journey cards with exact copy and CTAs', () => {
  const html = renderToStaticMarkup(
    React.createElement(Dashboard, { go: () => {}, onChat: () => {} })
  );

  // Card 1 — I'm a Student
  assert.match(html, /I&#x27;m a Student/);
  assert.match(html, /Find universities and degrees that match your marks, subjects, interests, and budget\./);
  assert.match(html, /Explore My Options/);

  // Card 2 — I'm Building My Career
  assert.match(html, /I&#x27;m Building My Career/);
  assert.match(html, /Discover the skills, courses, and projects you need for your target job\./);
  assert.match(html, /Build My Career Path/);
});

test('Dashboard preserves exploration toolkit and removes path map and adviser card', () => {
  const html = renderToStaticMarkup(
    React.createElement(Dashboard, { go: () => {}, onChat: () => {} })
  );

  // Removed elements confirmed absent
  assert.ok(!html.includes('YOUR PERSONAL PATH'));
  assert.ok(!html.includes('A degree you love'));

  // Toolkit preserved
  assert.match(html, /A few ways forward/);
  assert.match(html, /Discover your degree/);
  assert.match(html, /Find your university/);
  assert.match(html, /Turn gaps into goals/);
});

test('Personalized Dashboard renders welcome section, journeys, quick actions and progress when signed in', () => {
  const mockSession = {
    user: { id: 'u1', email: 'student@example.com' },
    access_token: 'fake-token',
  } as any;

  const mockProfile = {
    name: 'Ayesha',
    stage: 'Choosing a degree',
    qualification: 'FSc',
    subjects: ['Mathematics', 'Physics', 'Computer Science'],
    interests: ['Technology', 'Problem solving'],
    skills: ['Python', 'SQL'],
    city: 'Lahore',
    budget: 250000,
    hours: 8,
    ssc: 85,
    hssc: 82,
    equivalence: false,
    net: 75,
    goal: 'cs',
    relocate: false,
  };

  const mockPlan = {
    id: 'p1',
    title: 'Your path to Computer Science',
    goal: 'Computer Science',
    hoursPerWeek: 8,
    createdAt: '2026-10-10T12:00:00.000Z',
    milestones: [
      { id: 'm1', skill: 'Python', title: 'Build evidence of python', resourceId: null, practice: 'Write script', hours: 4, done: true },
      { id: 'm2', skill: 'SQL', title: 'Build evidence of sql', resourceId: null, practice: 'Query db', hours: 4, done: false }
    ]
  };

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      session: mockSession,
      profile: mockProfile,
      plan: mockPlan
    })
  );

  // Welcome section
  assert.match(html, /Welcome back, Ayesha!/);
  assert.match(html, /Pick up where you left off and take your next step forward\./);
  assert.match(html, /student@example\.com/);

  // Roadmap progress card
  assert.match(html, /Roadmap progress/);
  assert.match(html, /Your path to Computer Science/);
  assert.match(html, /1\/2 steps/);
  assert.match(html, /Resume roadmap/);

  // Stats and programme finder
  assert.match(html, /ROADMAP MILESTONES/);
  assert.match(html, /SKILLS REPORTED/);
  assert.match(html, /Programmes in Lahore/);
  assert.match(html, /Computer Science/);

  // Up next milestone
  assert.match(html, /Up next on your roadmap/);
  assert.match(html, /Build evidence of sql/);

  // Quick actions: all 6 shortcuts
  assert.match(html, /Quick actions/);
  assert.match(html, /Find university programs/);
  assert.match(html, /Check admission eligibility/);
  assert.match(html, /Explore career options/);
  assert.match(html, /Analyze a target job/);
  assert.match(html, /View my roadmap/);
  assert.match(html, /Edit my profile/);
});

test('Personalized Dashboard shows helpful onboarding state when signed in as new user with no saved data', () => {
  const mockSession = {
    user: { id: 'u2', email: 'newuser@example.com' },
    access_token: 'fake-token-2',
  } as any;

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      session: mockSession,
      profile: {
        name: '',
        stage: 'Choosing a degree',
        qualification: 'FSc',
        subjects: [],
        interests: [],
        skills: [],
        city: '',
        budget: null,
        hours: 5,
        ssc: null,
        hssc: null,
        equivalence: false,
        net: null,
        goal: '',
        relocate: false,
      },
      plan: null
    })
  );

  // Neutral welcome
  assert.match(html, /Welcome back!/);
  assert.match(html, /Pick up where you left off and take your next step forward\./);
  assert.match(html, /newuser@example\.com/);

  // Empty state for roadmap and programmes
  assert.match(html, /No active roadmap/);
  assert.match(html, /Explore degree paths/);
  assert.match(html, /Programme finder/);
});

