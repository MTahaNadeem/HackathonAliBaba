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

test('Dashboard preserves connected path map, adviser card, and exploration toolkit', () => {
  const html = renderToStaticMarkup(
    React.createElement(Dashboard, { go: () => {}, onChat: () => {} })
  );

  // Path map elements
  assert.match(html, /A degree you love/);
  assert.match(html, /Work that fits you/);
  assert.match(html, /Skills to get there/);

  // Adviser card
  assert.match(html, /MEET YOUR CAREER COMPANION/);
  assert.match(html, /Let’s find your direction/);

  // Toolkit
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

  // Continue where you left off
  assert.match(html, /Continue where you left off/);
  assert.match(html, /Your path to Computer Science/);
  assert.match(html, /1 of 2 steps completed/);
  assert.match(html, /Resume my roadmap/);

  // Your journey: distinct Education and Career journeys
  assert.match(html, /Education Journey/);
  assert.match(html, /Career Journey/);
  assert.match(html, /Computer Science/);
  assert.match(html, /PKR 250,000 \/ semester/);
  assert.match(html, /Find University Programs/);
  assert.match(html, /Explore Careers &amp; Analyze Job/);

  // Quick actions: all 6 shortcuts
  assert.match(html, /Quick actions/);
  assert.match(html, /Find university programs/);
  assert.match(html, /Check admission eligibility/);
  assert.match(html, /Explore career options/);
  assert.match(html, /Analyze a target job/);
  assert.match(html, /View my roadmap/);
  assert.match(html, /Edit my profile/);

  // Progress overview: real data
  assert.match(html, /Progress overview/);
  assert.match(html, /1 \/ 2/); // Roadmap milestones
  assert.match(html, /2/); // Skills reported
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

  // Onboarding continue state
  assert.match(html, /Start shaping your next chapter/);
  assert.match(html, /Explore degree paths/);
  assert.match(html, /Analyze a job brief/);

  // Informative empty state for progress overview
  assert.match(html, /No activity saved yet/);
});

