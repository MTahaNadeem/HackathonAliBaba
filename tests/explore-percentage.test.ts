import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Explore from '../components/explore';
import { emptyProfile, type Profile } from '../lib/domain';

test('Explore page displays match percentage on top 5 degrees only, and omits percentage for degrees 6th and beyond', () => {
  const profile: Profile = {
    ...emptyProfile,
    journey: 'student',
    subjects: ['Mathematics', 'Computer Science'],
    interests: ['Technology', 'Problem solving', 'Building'],
    city: 'Islamabad',
    budget: 200000,
  };

  const html = renderToStaticMarkup(
    React.createElement(Explore, {
      profile,
      onGoal: () => {},
    })
  );

  // Match percentage badges exist
  const matchPills = html.match(/class="degree-score-pill[^"]*"[^>]*>(\d+)% Match<\/span>/g);

  assert.ok(matchPills !== null, 'Match pills should be rendered on Explore page');
  assert.equal(matchPills.length, 5, `Expected exactly 5 degree recommendation percentages, got ${matchPills.length}`);

  // Top 5 degrees have match percentages
  for (const pill of matchPills) {
    assert.match(pill, /\d+% Match/);
  }
});
