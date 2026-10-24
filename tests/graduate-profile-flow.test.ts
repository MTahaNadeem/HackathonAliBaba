import test from 'node:test';
import assert from 'node:assert/strict';
import { isProfileComplete, emptyProfile, type Profile } from '../lib/domain';
import { profileSchema } from '../lib/validation';

test('Graduate / job seeker flow: isProfileComplete criteria', () => {
  const gradProfile: Profile = {
    ...emptyProfile,
    stage: 'Graduate / job seeker',
    qualification: 'FSc',
    city: 'Lahore',
    budget: null,
    ssc: null,
    hssc: null,
    skills: [],
    resumeText: '',
    extractedSkills: '',
  };

  // Missing CV / skills
  assert.equal(isProfileComplete(gradProfile), false);

  // With skills populated from CV
  const gradWithSkills: Profile = {
    ...gradProfile,
    skills: ['Python', 'SQL'],
  };
  assert.equal(isProfileComplete(gradWithSkills), true);

  // With resumeText extracted
  const gradWithResume: Profile = {
    ...gradProfile,
    resumeText: 'Software Engineer with experience in Next.js',
  };
  assert.equal(isProfileComplete(gradWithResume), true);

  // With extractedSkills
  const gradWithExtractedSkills: Profile = {
    ...gradProfile,
    extractedSkills: 'React, TypeScript',
  };
  assert.equal(isProfileComplete(gradWithExtractedSkills), true);

  // Verify profileSchema parses graduate profile with null budget and null marks
  const parsed = profileSchema.safeParse({
    ...gradWithSkills,
    journey: 'career',
    budget: null,
    ssc: null,
    hssc: null,
    net: null,
  });
  assert.equal(parsed.success, true);
});
