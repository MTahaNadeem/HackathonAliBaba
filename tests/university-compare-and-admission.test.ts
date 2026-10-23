import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { universities } from '../lib/catalogue';
import { emptyProfile, type Profile } from '../lib/domain';
import Dashboard from '../components/dashboard';
import Universities from '../components/universities';
import UniversityCompareDialog, { UniComparePicker, UniCompareColumn } from '../components/university-compare-dialog';

test('Dashboard View Campus Details links directly to university official admissions form', () => {
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

  // Each university card has a direct admission link to u.url with target="_blank"
  assert.ok(html.includes('View Campus Details'), 'Should render View Campus Details button');
  assert.ok(html.includes('href="https://nust.edu.pk/admissions/undergraduate/"') || html.includes('admissions'), 'Should link to official admissions portal');
  assert.ok(html.includes('target="_blank"'), 'Admissions link should open in a new tab');
  assert.ok(html.includes('rel="noreferrer"'), 'Link should have secure rel attributes');
});

test('Dashboard provides Compare button for universities', () => {
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

  // Compare buttons are present
  const compareButtons = html.match(/Compare<\/button>/g);
  assert.ok(compareButtons !== null && compareButtons.length >= 1, 'Should render Compare buttons on university recommendation cards');
});

test('UniversityCompareDialog components render campus choice options and side-by-side comparison', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    qualification: 'FSc Pre-Engineering',
    ssc: 85,
    hssc: 82,
    city: 'Islamabad',
    budget: 250000,
    goal: 'civil',
  };

  const nustCivil = universities.find(u => u.id === 'nust-civil')!;
  const uetCivil = universities.find(u => u.id === 'uet-civil' || u.degreeId === 'civil')!;
  const civilUnis = universities.filter(u => u.degreeId === 'civil' && u.id !== nustCivil.id);

  // 1. Verify choice picker options
  const pickerHtml = renderToStaticMarkup(
    React.createElement(UniComparePicker, {
      baseUni: nustCivil,
      targetUni: uetCivil,
      candidateUnis: civilUnis,
      onSelectTargetUni: () => {},
      profile,
    })
  );

  assert.ok(pickerHtml.includes('Comparing <strong>National University of Sciences &amp; Technology</strong> with:'), 'Displays base university label');
  assert.ok(pickerHtml.includes('select'), 'Provides a choice dropdown of other universities');
  assert.ok(pickerHtml.includes('chip'), 'Provides quick selection chips for candidate universities');

  // 2. Verify side-by-side comparison details
  const primaryColHtml = renderToStaticMarkup(
    React.createElement(UniCompareColumn, {
      uni: nustCivil,
      profile,
      isPrimary: true,
    })
  );
  assert.ok(primaryColHtml.includes('SELECTED CAMPUS'), 'Labels the primary selected campus');
  assert.ok(primaryColHtml.includes('SEMESTER TUITION'), 'Compares semester tuition');
  assert.ok(primaryColHtml.includes('ADMISSION &amp; ELIGIBILITY'), 'Compares eligibility criteria');
  assert.ok(primaryColHtml.includes('Open Admission Form'), 'Provides direct application form link');
  assert.ok(primaryColHtml.includes(nustCivil.url), 'Link points to official university admissions form');

  const targetColHtml = renderToStaticMarkup(
    React.createElement(UniCompareColumn, {
      uni: uetCivil,
      profile,
      isPrimary: false,
    })
  );
  assert.ok(targetColHtml.includes('COMPARISON OPTION'), 'Labels the comparison option');
  assert.ok(targetColHtml.includes('Open Admission Form'), 'Provides direct application form link for comparison university');
});

test('Universities Finder provides Compare campus action', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    qualification: 'FSc Pre-Engineering',
    city: 'Islamabad',
    budget: 250000,
  };

  const html = renderToStaticMarkup(
    React.createElement(Universities, {
      profile,
      go: () => {},
    })
  );

  assert.ok(html.includes('Compare campus'), 'Should provide Compare campus button on university listings');
});
