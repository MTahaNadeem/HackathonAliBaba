import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from '../components/dashboard';
import Universities from '../components/universities';
import Explore from '../components/explore';
import Jobs from '../components/jobs';
import { isProfileComplete, getProfileDirection, emptyProfile, type Profile } from '../lib/domain';
import { degrees } from '../lib/catalogue';

test('isProfileComplete correctly validates the minimum required preferences', () => {
  // Empty profile is incomplete
  assert.equal(isProfileComplete(emptyProfile), false);

  // Missing goal
  assert.equal(isProfileComplete({
    ...emptyProfile,
    qualification: 'FSc',
    city: 'Rawalpindi',
    budget: 200000,
    goal: ''
  }), false);

  // Missing city
  assert.equal(isProfileComplete({
    ...emptyProfile,
    qualification: 'FSc',
    goal: 'software',
    budget: 200000,
    city: ''
  }), false);

  // Missing or zero budget
  assert.equal(isProfileComplete({
    ...emptyProfile,
    qualification: 'FSc',
    goal: 'software',
    city: 'Rawalpindi',
    budget: null
  }), false);
  assert.equal(isProfileComplete({
    ...emptyProfile,
    qualification: 'FSc',
    goal: 'software',
    city: 'Rawalpindi',
    budget: 0
  }), false);

  // Invalid goal not in degrees catalogue
  assert.equal(isProfileComplete({
    ...emptyProfile,
    qualification: 'FSc',
    goal: 'non-existent-degree',
    city: 'Rawalpindi',
    budget: 200000
  }), false);

  // Complete profile with all 4 required fields
  const completeProfile: Profile = {
    ...emptyProfile,
    qualification: 'FSc',
    goal: 'software',
    city: 'Rawalpindi',
    budget: 200000
  };
  assert.equal(isProfileComplete(completeProfile), true);

  const dir = getProfileDirection(completeProfile);
  assert.equal(dir?.name, 'Software engineering');
  assert.equal(dir?.field, 'Technology');
});

test('Dashboard Programme Finder card filters strictly by chosen direction and city without irrelevant padding', () => {
  const profile: Profile = {
    ...emptyProfile,
    name: 'Taha',
    qualification: 'FSc',
    goal: 'software', // Software engineering (Technology)
    city: 'Rawalpindi',
    budget: 200000
  };

  const mockSession = { user: { id: 'u1', email: 'test@example.com' } } as any;

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      session: mockSession,
      profile,
      plan: null
    })
  );

  // Programme finder heading and field-matched subtext
  assert.match(html, /Programmes in Rawalpindi/);
  assert.match(html, /Matched to your Software engineering direction in Rawalpindi\./);

  // Relevant Technology / Software engineering programmes in Rawalpindi are shown
  assert.match(html, /BS Software Engineering/);
  assert.match(html, /BS Computer Science/);
  assert.match(html, /Fatima Jinnah Women University/);
  assert.match(html, /Rawalpindi Women University/);

  // Irrelevant programmes from other fields are NOT included
  assert.doesNotMatch(html, /Civil Engineering/);
  assert.doesNotMatch(html, /BS Economics/);
  assert.doesNotMatch(html, /Visual Communication/);
  assert.doesNotMatch(html, /BBA/);
  assert.doesNotMatch(html, /BS Biotechnology/); // in Rawalpindi, but Sciences field -> excluded
});

test('Universities page applies personalized direction and budget filtering with active banner', () => {
  const profile: Profile = {
    ...emptyProfile,
    qualification: 'FSc',
    goal: 'software',
    city: 'Rawalpindi',
    budget: 200000
  };

  const html = renderToStaticMarkup(
    React.createElement(Universities, {
      profile,
      go: () => {}
    })
  );

  // Active filter banner is present
  assert.match(html, /Showing personalized results for/);
  assert.match(html, /Software engineering \(Technology\)/);
  assert.match(html, /Rawalpindi/);
  assert.match(html, /PKR 200,000/);
  assert.match(html, /View all programmes/);

  // Filtered programmes match
  assert.match(html, /BS Software Engineering/);
  assert.match(html, /BS Computer Science/);
});

test('Explore page prioritizes chosen direction degrees first with active banner', () => {
  const profile: Profile = {
    ...emptyProfile,
    goal: 'software', // Software engineering (Technology)
    city: 'Rawalpindi',
    budget: 200000
  };

  const html = renderToStaticMarkup(
    React.createElement(Explore, {
      profile,
      onGoal: () => {}
    })
  );

  assert.match(html, /Prioritizing degree paths for your chosen direction/);
  assert.match(html, /Software engineering \(Technology\)/);
  assert.match(html, /Standard ranking/);
});

test('Jobs page prioritizes role briefs matching chosen direction with active banner', () => {
  const profile: Profile = {
    ...emptyProfile,
    goal: 'software',
    city: 'Rawalpindi',
    budget: 200000
  };

  const html = renderToStaticMarkup(
    React.createElement(Jobs, {
      profile,
      onPlan: () => {}
    })
  );

  assert.match(html, /Prioritizing role briefs for/);
  assert.match(html, /Software engineering \(Technology\)/);
  assert.match(html, /Standard order/);
});
