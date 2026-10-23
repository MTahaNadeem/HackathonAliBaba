import test from 'node:test';
import assert from 'node:assert/strict';
import { planSchema } from '../lib/validation';
import {
  generateCurriculum,
  generateDeterministicCurriculum,
  discoverLessonResources
} from '../lib/ai/curriculum-engine';
import {
  exportPlan,
  synthesizeCurriculumIfMissing,
  type Plan,
  type Profile,
  type CurriculumModule
} from '../lib/domain';

const sampleProfile: Profile = {
  name: 'Ahmad Khan',
  stage: 'Choosing a degree',
  qualification: 'FSc (Pre-Engineering)',
  subjects: ['Physics', 'Mathematics', 'Chemistry'],
  interests: ['Technology', 'Problem solving'],
  skills: ['Python', 'Problem solving'],
  city: 'Islamabad',
  budget: 250000,
  hours: 15,
  ssc: 88,
  hssc: 85,
  equivalence: false,
  net: 140,
  goal: 'cs',
  relocate: true,
  experience: '',
  projects: '',
  certifications: '',
  links: '',
  resumeText: '',
  extractedSkills: '',
  journey: 'student',
  specialization: 'Artificial Intelligence',
  career_goal: ''
};

void test('Curriculum schema validation: validates valid plan with modules, lessons, and assessment', () => {
  const plan = generateDeterministicCurriculum({
    goal: 'Computer Science',
    skills: ['Python', 'SQL'],
    profile: sampleProfile,
    goalType: 'degree'
  });

  const parsed = planSchema.safeParse(plan);
  assert.ok(parsed.success, 'Plan should be valid according to planSchema');
  if (parsed.success) {
    assert.ok(parsed.data.modules && parsed.data.modules.length >= 4);
    assert.ok(parsed.data.assessment);
    assert.equal(parsed.data.goalType, 'degree');
    assert.equal(parsed.data.subject, 'Computer Science');
  }
});

void test('Curriculum generation: different subjects generate genuinely different curricula', async () => {
  const csPlan = await generateCurriculum({
    goal: 'Computer Science',
    skills: ['Python'],
    profile: sampleProfile
  });

  const econPlan = await generateCurriculum({
    goal: 'Economics',
    skills: ['Statistics'],
    profile: { ...sampleProfile, goal: 'economics' }
  });

  assert.notEqual(csPlan.modules?.[0].title, econPlan.modules?.[0].title);
  assert.ok(csPlan.modules?.[0].title.toLowerCase().includes('computational') || csPlan.modules?.[0].title.toLowerCase().includes('algorithms'));
  assert.ok(econPlan.modules?.[0].title.toLowerCase().includes('microeconomics') || econPlan.modules?.[0].title.toLowerCase().includes('economic'));
  assert.notEqual(csPlan.assessment?.whatYouWillLearn, econPlan.assessment?.whatYouWillLearn);
});

void test('Resource discovery: binds verified real links and avoids hallucinated URLs', () => {
  // Test known tech skill lesson
  const pythonResources = discoverLessonResources('Data Structures in Python', 'Foundations', 'Computer Science');
  assert.ok(pythonResources.length > 0);
  assert.ok(pythonResources[0].url.includes('freecodecamp.org') || pythonResources[0].url.includes('youtube.com'));
  assert.equal(pythonResources[0].verified, true);

  // Test SQL database lesson
  const sqlResources = discoverLessonResources('Relational Queries and Joins', 'Database Engineering', 'Computer Science');
  assert.ok(sqlResources.length > 0);
  assert.ok(sqlResources.some(r => r.url.includes('sqlbolt.com') || r.url.includes('youtube.com')));

  // Test academic university domain lesson
  const algoResources = discoverLessonResources('Graph Algorithms and Dynamic Programming', 'Algorithms', 'Computer Science');
  assert.ok(algoResources.length > 0);
  assert.ok(algoResources.some(r => r.provider.includes('MIT') || r.url.includes('ocw.mit.edu')));

  // Test obscure topic falls back to curated search and marks verified: false
  const obscure = discoverLessonResources('Very Obscure Quantum Sub-Topic', 'Advanced', 'Specialized');
  assert.ok(obscure.length > 0);
  assert.equal(obscure[0].verified, false);
  assert.ok(obscure[0].url.includes('ocw.mit.edu/search'));
});

void test('Lesson completion, module progress, and overall progress calculations', () => {
  const plan = generateDeterministicCurriculum({
    goal: 'Computer Science',
    skills: ['Python'],
    profile: sampleProfile
  });

  const modules = plan.modules || [];
  assert.ok(modules.length >= 4);

  const totalLessons = modules.flatMap(m => m.lessons).length;
  assert.ok(totalLessons >= 10);

  // Initially 0%
  let completed = modules.flatMap(m => m.lessons).filter(l => l.done).length;
  assert.equal(completed, 0);

  // Mark 2 lessons complete in module 0
  modules[0].lessons[0].done = true;
  modules[0].lessons[1].done = true;

  completed = modules.flatMap(m => m.lessons).filter(l => l.done).length;
  assert.equal(completed, 2);

  const overallPercent = Math.round((completed / totalLessons) * 100);
  assert.equal(overallPercent, Math.round((2 / totalLessons) * 100));

  const mod0Done = modules[0].lessons.filter(l => l.done).length;
  const mod0Percent = Math.round((mod0Done / modules[0].lessons.length) * 100);
  assert.ok(mod0Percent > 0);

  // Undo completion
  modules[0].lessons[1].done = false;
  completed = modules.flatMap(m => m.lessons).filter(l => l.done).length;
  assert.equal(completed, 1);
});

void test('synthesizeCurriculumIfMissing seamlessly upgrades legacy milestone plans', () => {
  const legacyPlan: Plan = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Path to Frontend',
    goal: 'Frontend Developer',
    createdAt: new Date().toISOString(),
    hoursPerWeek: 10,
    milestones: [
      { id: 'step-0', skill: 'React', title: 'Master React', practice: 'Build app', done: true, state: 'Demonstrated' },
      { id: 'step-1', skill: 'TypeScript', title: 'Master TypeScript', practice: 'Type app', done: false, state: 'Not started' }
    ]
  };

  const synthesized = synthesizeCurriculumIfMissing(legacyPlan);
  assert.ok(synthesized.modules && synthesized.modules.length > 0);
  assert.ok(synthesized.assessment);
  assert.equal(synthesized.modules[0].lessons.length, 2);
  assert.equal(synthesized.modules[0].lessons[0].done, true);
  assert.equal(synthesized.modules[0].lessons[1].done, false);
});

void test('exportPlan outputs rich Markdown with modules, lessons, objectives, and resources', () => {
  const plan = generateDeterministicCurriculum({
    goal: 'Economics',
    skills: ['Statistics'],
    profile: sampleProfile
  });

  const md = exportPlan(plan);
  assert.ok(md.includes('# Your path to Economics'));
  assert.ok(md.includes('Learning Assessment Overview'));
  assert.ok(md.includes('Module 1:'));
  assert.ok(md.includes('Objective'));
  assert.ok(md.includes('Lessons'));
});

void test('Curriculum generation with mocked Qwen model output', async () => {
  const mockedQwenResponse = {
    title: 'AI-Guided Data Science Mastery',
    description: 'Custom learning path generated by Qwen model.',
    goalType: 'specialization',
    subject: 'Data Science',
    targetOutcome: 'Full capability in exploratory data analysis and ML models.',
    estimatedDuration: '12 weeks (120 hours)',
    assessment: {
      whatYouWillLearn: 'Linear regression, classification, pandas, feature engineering.',
      whyIncluded: 'Targeted to match strong analytical skills with modern machine learning tools.',
      expectedSequence: 'Data wrangling -> Exploratory analysis -> Predictive modeling.',
      estimatedTotalDuration: '12 weeks',
      majorMilestones: ['Data Wrangling in Pandas', 'Scikit-Learn Modeling', 'End-to-End ML Pipeline']
    },
    modules: [
      {
        id: 'mod-qwen-1',
        title: 'Foundations of Data Wrangling',
        description: 'Handling tabular data and data pipelines.',
        learningObjectives: ['Master dataframe operations', 'Clean dirty datasets'],
        estimatedDuration: '3 weeks',
        prerequisites: ['Basic Python'],
        lessons: [
          {
            id: 'les-qwen-1-1',
            title: 'Pandas Dataframes & Series',
            description: 'Core tabular abstractions in Python.',
            learningObjective: 'Filter, group, and reshape dataframes.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Clean a customer dataset with 20% missing values.'
          }
        ]
      },
      {
        id: 'mod-qwen-2',
        title: 'Predictive Modeling with Scikit-Learn',
        description: 'Supervised machine learning algorithms.',
        learningObjectives: ['Train classifiers and regressors', 'Evaluate with ROC-AUC'],
        estimatedDuration: '4 weeks',
        prerequisites: ['Module 1'],
        lessons: [
          {
            id: 'les-qwen-2-1',
            title: 'Linear & Logistic Regression',
            description: 'Fundamental regression and classification models.',
            learningObjective: 'Train and interpret logistic regression coefficients.',
            estimatedDuration: '2 hours',
            practiceTask: 'Build a churn prediction classifier and report confusion matrix.'
          }
        ]
      }
    ]
  };

  const plan = await generateCurriculum(
    { goal: 'Data Science', skills: ['Python'], profile: sampleProfile },
    { request: async () => mockedQwenResponse }
  );

  assert.equal(plan.source, 'qwen');
  assert.equal(plan.fallbackUsed, false);
  assert.equal(plan.title, 'AI-Guided Data Science Mastery');
  assert.equal(plan.modules?.length, 2);
  assert.equal(plan.modules?.[0].lessons[0].resources[0].verified, true);
});

void test('Curriculum generation safely falls back to deterministic curriculum on Qwen error', async () => {
  const plan = await generateCurriculum(
    { goal: 'Economics', skills: ['Statistics'], profile: sampleProfile },
    { request: async () => { throw new Error('Provider network timeout'); } }
  );

  assert.equal(plan.source, 'deterministic');
  assert.equal(plan.fallbackUsed, true);
  assert.ok(plan.modules && plan.modules.length >= 4);
  assert.ok(plan.assessment);
  assert.equal(plan.subject, 'Economics');
});
