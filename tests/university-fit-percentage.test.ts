import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { universities } from '../lib/catalogue';
import { calculateUniversityFit, rankTopUniversities, emptyProfile, type Profile } from '../lib/domain';
import Universities from '../components/universities';
import Dashboard from '../components/dashboard';

test('calculateUniversityFit computes deterministic preference fit scores', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    qualification: 'FSc Pre-Engineering',
    ssc: 85,
    hssc: 82,
    city: 'Islamabad',
    relocate: false,
    budget: 250000,
    goal: 'civil',
  };

  const nustCivil = universities.find(u => u.degreeId === 'civil' && u.city === 'Islamabad')!;
  assert.ok(nustCivil, 'NUST civil should exist in catalogue');

  const fit = calculateUniversityFit(nustCivil, profile);
  assert.ok(fit.fitPercentage >= 80, `Expected high fit percentage for local affordable university, got ${fit.fitPercentage}`);
  assert.ok(fit.matchReasons.length > 0, 'Should provide match reasons based on preferences');

  // Relocation penalty when relocate is false and city differs
  const lahoreProfile: Profile = {
    ...profile,
    city: 'Karachi',
    relocate: false,
  };
  const diffCityFit = calculateUniversityFit(nustCivil, lahoreProfile);
  assert.ok(diffCityFit.fitPercentage < fit.fitPercentage, 'Fit percentage should be lower when city does not match and relocation is false');
});

test('Universities page displays fit percentage on first and second university cards only', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    qualification: 'FSc Pre-Engineering',
    ssc: 88,
    hssc: 84,
    city: 'Islamabad',
    relocate: false,
    budget: 300000,
    goal: 'civil',
  };

  const html = renderToStaticMarkup(
    React.createElement(Universities, {
      profile,
      go: () => {},
    })
  );

  // #1 Best Fit and #2 Fit badges exist
  const bestFitMatch = html.match(/#1 Best Fit · (\d+)%/g);
  const secondFitMatch = html.match(/#2 Fit · (\d+)%/g);
  const thirdFitMatch = html.match(/#3 Fit · (\d+)%/g);

  assert.ok(bestFitMatch !== null && bestFitMatch.length === 1, 'Expected exactly one #1 Best Fit badge');
  assert.ok(secondFitMatch !== null && secondFitMatch.length === 1, 'Expected exactly one #2 Fit badge');
  assert.equal(thirdFitMatch, null, 'Should not render a #3 Fit percentage badge on 3rd university or beyond');
});

test('Dashboard Top Universities displays fit percentage on first and second cards only', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    student_knows_degree: true,
    qualification: 'FSc Pre-Engineering',
    ssc: 88,
    hssc: 84,
    city: 'Islamabad',
    relocate: true,
    budget: 300000,
    goal: 'civil',
  };

  const html = renderToStaticMarkup(
    React.createElement(Dashboard, {
      go: () => {},
      onChat: () => {},
      profile,
    })
  );

  // Check top universities grid for fit pills
  const bestFitMatch = html.match(/#1 Best Fit · (\d+)%/g);
  const secondFitMatch = html.match(/#2 Fit · (\d+)%/g);
  const thirdFitMatch = html.match(/#3 Fit · (\d+)%/g);

  assert.ok(bestFitMatch !== null && bestFitMatch.length >= 1, 'Expected #1 Best Fit badge on Dashboard top universities');
  assert.ok(secondFitMatch !== null && secondFitMatch.length >= 1, 'Expected #2 Fit badge on Dashboard top universities');
  assert.equal(thirdFitMatch, null, 'Should not render #3 Fit badge on 3rd university or beyond');
});
