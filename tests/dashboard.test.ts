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
