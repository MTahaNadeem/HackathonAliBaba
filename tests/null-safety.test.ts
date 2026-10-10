import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assessUniversity, getFeeDisplay, formatPKR, emptyProfile, type Profile } from '../lib/domain';
import type { University } from '../lib/catalogue';
import Universities from '../components/universities';

// ── 1. getFeeDisplay null / undefined safety ───────────────────────────────

test('getFeeDisplay with fee: null and needs_information returns "Not published online"', () => {
  const u: University = {
    id: 'test-needs-info',
    name: 'Test University',
    short: 'TU',
    city: 'Lahore',
    programme: 'BBA',
    degreeId: 'business',
    url: 'https://example.edu',
    fee: null,
    mandatory: null,
    rule: 'unknown',
    checked: '2026-10-10',
    verificationStatus: 'needs_information',
    notes: 'Direct inquiry required',
  };

  const result = getFeeDisplay(u);
  assert.equal(result.isVerified, false);
  assert.equal(result.tuition, 'Not published online');
  assert.equal(result.mandatory, 'Official inquiry / portal required');
});

test('getFeeDisplay with fee: null and manual_snapshot returns "Not verified"', () => {
  const u: University = {
    id: 'test-manual-null',
    name: 'Test University',
    short: 'TU',
    city: 'Karachi',
    programme: 'BS CS',
    degreeId: 'computing',
    url: 'https://example.edu',
    fee: null,
    mandatory: null,
    rule: 'general',
    checked: '2026-10-10',
    verificationStatus: 'manual_snapshot',
  };

  const result = getFeeDisplay(u);
  assert.equal(result.isVerified, false);
  assert.equal(result.tuition, 'Not verified');
  assert.equal(result.mandatory, 'Check the current fee schedule');
});

test('getFeeDisplay with fee: undefined (runtime omitted) does not throw and returns "Not verified"', () => {
  // Simulate ingested / raw record where fee property is undefined
  const rawRecord = {
    id: 'test-undefined-fee',
    name: 'Test University',
    short: 'TU',
    city: 'Islamabad',
    programme: 'BS Economics',
    degreeId: 'economics',
    url: 'https://example.edu',
    fee: undefined,
    mandatory: undefined,
    rule: 'unknown',
    checked: '2026-10-10',
  } as unknown as University;

  assert.doesNotThrow(() => {
    const result = getFeeDisplay(rawRecord);
    assert.equal(result.isVerified, false);
    assert.equal(result.tuition, 'Not verified');
  });
});

test('getFeeDisplay with verified fee and null mandatory displays tuition without mandatory charges', () => {
  const u: University = {
    id: 'test-no-mandatory',
    name: 'Test University',
    short: 'TU',
    city: 'Islamabad',
    programme: 'BS Civil',
    degreeId: 'civil',
    url: 'https://example.edu',
    fee: 250000,
    mandatory: null,
    rule: 'general',
    checked: '2026-10-10',
    verificationStatus: 'manual_snapshot',
  };

  const result = getFeeDisplay(u);
  assert.equal(result.isVerified, true);
  assert.equal(result.tuition, 'PKR 250,000');
  assert.equal(result.mandatory, 'Semester tuition');
});

test('getFeeDisplay with verified fee and mandatory displays both amounts formatted', () => {
  const u: University = {
    id: 'test-full-verified',
    name: 'NUST',
    short: 'NUST',
    city: 'Islamabad',
    programme: 'BS Civil',
    degreeId: 'civil',
    url: 'https://nust.edu.pk',
    fee: 216750,
    mandatory: 5000,
    rule: 'nust-engineering',
    checked: '2026-10-10',
    verificationStatus: 'live_refreshed',
  };

  const result = getFeeDisplay(u);
  assert.equal(result.isVerified, true);
  assert.equal(result.tuition, 'PKR 216,750');
  assert.equal(result.mandatory, '+ PKR 5,000 mandatory charges');
});

// ── 2. formatPKR helper tests ──────────────────────────────────────────────

test('formatPKR correctly handles null, undefined, NaN, and numbers', () => {
  assert.equal(formatPKR(null), null);
  assert.equal(formatPKR(undefined), null);
  assert.equal(formatPKR(NaN), null);
  assert.equal(formatPKR(150000), 'PKR 150,000');
  assert.equal(formatPKR(0), 'PKR 0');
});

// ── 3. assessUniversity safety tests ───────────────────────────────────────

test('assessUniversity with fee: null returns cost: null and "Costs need checking"', () => {
  const u: University = {
    id: 'test-null-fee',
    name: 'Test U',
    short: 'TU',
    city: 'Lahore',
    programme: 'BBA',
    degreeId: 'business',
    url: 'https://example.edu',
    fee: null,
    mandatory: null,
    rule: 'unknown',
    checked: '2026-10-10',
    verificationStatus: 'needs_information',
  };

  const a = assessUniversity(u, { ...emptyProfile, budget: 500000 });
  assert.equal(a.cost, null);
  assert.equal(a.budget, 'Costs need checking');
});

test('assessUniversity with fee: undefined does not throw and handles missing profile budget', () => {
  const u = {
    id: 'test-undefined-fee',
    name: 'Test U',
    short: 'TU',
    city: 'Lahore',
    programme: 'BBA',
    degreeId: 'business',
    url: 'https://example.edu',
    rule: 'unknown',
    checked: '2026-10-10',
  } as unknown as University;

  const profileWithoutBudget = { ...emptyProfile, budget: undefined } as unknown as Profile;
  assert.doesNotThrow(() => {
    const a = assessUniversity(u, profileWithoutBudget);
    assert.equal(a.cost, null);
    assert.equal(a.budget, 'Costs need checking');
  });
});

// ── 4. React rendering tests with fee: null and fee: undefined ─────────────

test('rendering a university card with fee: null does not throw and shows fallback label', () => {
  const sampleUniversities: University[] = [
    {
      id: 'lse-test',
      name: 'Lahore School of Economics',
      short: 'LSE',
      city: 'Lahore',
      programme: 'BBA (Hons)',
      degreeId: 'business',
      url: 'https://admissions.lahoreschool.edu.pk/',
      fee: null,
      mandatory: null,
      rule: 'unknown',
      checked: '2026-10-10',
      verificationStatus: 'needs_information',
      notes: 'LSE does not publish an open fee schedule on its public website.',
    },
    {
      id: 'nca-test-null',
      name: 'National College of Arts',
      short: 'NCA',
      city: 'Lahore',
      programme: 'Design',
      degreeId: 'design',
      url: 'https://www.nca.edu.pk/',
      fee: null,
      mandatory: null,
      rule: 'general',
      checked: '2026-10-10',
      verificationStatus: 'manual_snapshot',
    },
    {
      // Completely undefined fee & mandatory properties
      id: 'undefined-test',
      name: 'Unknown Academy',
      short: 'UA',
      city: 'Karachi',
      programme: 'Arts',
      degreeId: 'design',
      url: 'https://example.com',
      rule: 'unknown',
      checked: '2026-10-10',
    } as unknown as University,
  ];

  let html = '';
  assert.doesNotThrow(() => {
    html = renderToStaticMarkup(
      React.createElement(Universities, {
        profile: { ...emptyProfile, budget: null },
        go: () => {},
        liveUniversities: sampleUniversities,
        dataSource: 'database',
      })
    );
  }, 'Rendering Universities with fee: null or undefined must not throw');

  // Verify the correct fallback labels are rendered in the HTML
  assert.ok(html.includes('Not published online'), 'needs_information card must show "Not published online"');
  assert.ok(html.includes('Not verified'), 'manual_snapshot with fee: null must show "Not verified"');
  assert.ok(html.includes('Costs need checking'), 'Card must show "Costs need checking" in budget fact');
  assert.ok(html.includes('Budget not set'), 'Summary must show "Budget not set" when profile.budget is null');
});

test('rendering Universities with profile.budget: undefined does not throw and renders "Budget not set"', () => {
  const rawProfile = {
    ...emptyProfile,
    budget: undefined,
  } as unknown as Profile;

  let html = '';
  assert.doesNotThrow(() => {
    html = renderToStaticMarkup(
      React.createElement(Universities, {
        profile: rawProfile,
        go: () => {},
        liveUniversities: [
          {
            id: 'nust-test',
            name: 'NUST',
            short: 'NUST',
            city: 'Islamabad',
            programme: 'Civil',
            degreeId: 'civil',
            url: 'https://nust.edu.pk',
            fee: 216750,
            mandatory: 5000,
            rule: 'nust-engineering',
            checked: '2026-10-10',
            verificationStatus: 'live_refreshed',
          },
        ],
        dataSource: 'database',
      })
    );
  });

  assert.ok(html.includes('Budget not set'), 'Must safely render "Budget not set" when budget is undefined');
  assert.ok(html.includes('PKR 216,750'), 'Must render verified fee');
});
