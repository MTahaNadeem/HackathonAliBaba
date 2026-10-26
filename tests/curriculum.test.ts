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

void test('Curriculum generation with mocked Groq model output', async () => {
  const mockedGroqResponse = {
    title: 'AI-Guided Data Science Mastery',
    description: 'Custom learning path generated dynamically by Groq.',
    goalType: 'career' as const,
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
        id: 'mod-groq-1',
        title: 'Foundations of Data Wrangling',
        description: 'Handling tabular data and data pipelines.',
        learningObjectives: ['Master dataframe operations', 'Clean dirty datasets'],
        estimatedDuration: '3 weeks',
        prerequisites: ['Basic Python'],
        lessons: [
          {
            id: 'les-groq-1-1',
            title: 'Pandas Dataframes & Series',
            description: 'Core tabular abstractions in Python.',
            learningObjective: 'Filter, group, and reshape dataframes.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Clean a customer dataset with 20% missing values.'
          }
        ]
      },
      {
        id: 'mod-groq-2',
        title: 'Predictive Modeling with Scikit-Learn',
        description: 'Supervised machine learning algorithms.',
        learningObjectives: ['Train classifiers and regressors', 'Evaluate with ROC-AUC'],
        estimatedDuration: '4 weeks',
        prerequisites: ['Module 1'],
        lessons: [
          {
            id: 'les-groq-2-1',
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
    { request: async () => mockedGroqResponse }
  );

  assert.equal(plan.source, 'groq');
  assert.equal(plan.fallbackUsed, false);
  assert.equal(plan.title, 'AI-Guided Data Science Mastery');
  assert.equal(plan.modules?.length, 2);
  assert.equal(plan.modules?.[0].lessons[0].resources[0].verified, true);
});

void test('Curriculum generation safely falls back to deterministic curriculum on Groq error', async () => {
  const plan = await generateCurriculum(
    { goal: 'Economics', skills: ['Statistics'], profile: sampleProfile },
    { request: async () => { throw new Error('Groq rate limit'); } }
  );

  assert.equal(plan.source, 'deterministic');
  assert.equal(plan.fallbackUsed, true);
  assert.ok(plan.modules && plan.modules.length >= 4);
  assert.ok(plan.assessment);
  assert.equal(plan.subject, 'Economics');
});

// MANDATED TEST CASES

void test('Mandated Case 1: BS Computer Science + beginner Python generates degree-level breadth', async () => {
  const plan = await generateCurriculum({
    goal: 'BS Computer Science',
    skills: ['Python'],
    profile: {
      ...sampleProfile,
      goal: 'cs',
      skills: ['Python'],
      journey: 'student',
      specialization: '',
      interests: ['Technology', 'Problem solving']
    }
  });

  assert.ok(plan.modules, 'Plan must have modules');
  // Substantial degree curriculum: 6-10 modules representing degree breadth
  assert.ok(plan.modules.length >= 6 && plan.modules.length <= 10, `Expected 6-10 modules, got ${plan.modules.length}`);
  assert.equal(plan.goalType, 'degree');
  // Verifies coverage of core computer science pillars
  const titles = plan.modules.map(m => m.title.toLowerCase());
  assert.ok(titles.some(t => t.includes('computational') || t.includes('mathematical') || t.includes('logic')));
  assert.ok(titles.some(t => t.includes('data structures') || t.includes('graph') || t.includes('algorithm')));
  assert.ok(titles.some(t => t.includes('architecture') || t.includes('operating systems') || t.includes('concurrency')));
  assert.ok(titles.some(t => t.includes('database')));
  assert.ok(titles.some(t => t.includes('capstone')));
  // Assessment acknowledges Python skill
  assert.ok(plan.assessment?.existingKnowledgeAssessed?.toLowerCase().includes('python'));
});

void test('Mandated Case 2: BS Software Engineering + web development interest generates distinct SE curriculum', async () => {
  const plan = await generateCurriculum({
    goal: 'BS Software Engineering',
    skills: ['Programming fundamentals'],
    profile: {
      ...sampleProfile,
      goal: 'software',
      skills: ['Programming fundamentals'],
      journey: 'student',
      interests: ['Web development', 'Technology', 'Building']
    }
  });

  assert.ok(plan.modules, 'Plan must have modules');
  assert.ok(plan.modules.length >= 6 && plan.modules.length <= 10, `Expected 6-10 modules, got ${plan.modules.length}`);
  const titles = plan.modules.map(m => m.title.toLowerCase());
  // SE distinct features: software construction, testing/QA, CI/CD, and web architecture
  assert.ok(titles.some(t => t.includes('software construction') || t.includes('architecture')));
  assert.ok(titles.some(t => t.includes('web') || t.includes('api') || t.includes('distributed')));
  assert.ok(titles.some(t => t.includes('testing') || t.includes('quality assurance') || t.includes('tdd')));
  assert.ok(titles.some(t => t.includes('devops') || t.includes('container') || t.includes('ci/cd')));
  assert.ok(titles.some(t => t.includes('capstone')));
});

void test('Mandated Case 3: Data Science career + Python skills skips basic Python and focuses on ML', async () => {
  const plan = await generateCurriculum({
    goal: 'Data Science',
    skills: ['Python'],
    profile: {
      ...sampleProfile,
      journey: 'career',
      career_goal: 'Data Scientist',
      skills: ['Python'],
      interests: ['Numbers', 'Research']
    }
  });

  assert.ok(plan.modules, 'Plan must have modules');
  // Focused career roadmap: 4-6 modules
  assert.ok(plan.modules.length >= 4 && plan.modules.length <= 6, `Expected 4-6 modules, got ${plan.modules.length}`);
  const titles = plan.modules.map(m => m.title.toLowerCase());
  // Focuses on scientific computing, statistical analysis, and scikit-learn ML rather than basic syntax
  assert.ok(titles.some(t => t.includes('pandas') || t.includes('scientific') || t.includes('wrangling')));
  assert.ok(titles.some(t => t.includes('statistical') || t.includes('inference') || t.includes('exploratory')));
  assert.ok(titles.some(t => t.includes('machine learning') || t.includes('supervised')));
  assert.ok(titles.some(t => t.includes('capstone') || t.includes('pipeline')));
  // Assessment acknowledges Python skill
  assert.ok(plan.assessment?.existingKnowledgeAssessed?.toLowerCase().includes('python'));
  assert.ok(!titles[0].includes('syntax') && !titles[0].includes('hello world'));
});

void test('Mandated Case 4: Data Analyst career + weak SQL emphasizes database & SQL modules', async () => {
  const plan = await generateCurriculum({
    goal: 'Data Analyst',
    skills: ['Spreadsheets', 'Communication'],
    profile: {
      ...sampleProfile,
      journey: 'career',
      career_goal: 'Data Analyst',
      skills: ['Spreadsheets', 'Communication'],
      interests: ['Numbers', 'Research']
    }
  });

  assert.ok(plan.modules, 'Plan must have modules');
  assert.ok(plan.modules.length >= 4 && plan.modules.length <= 6, `Expected 4-6 modules, got ${plan.modules.length}`);
  const titles = plan.modules.map(m => m.title.toLowerCase());
  // Emphasizes SQL queries, relational databases, and BI dashboarding
  assert.ok(titles.some(t => t.includes('sql') || t.includes('database')));
  assert.ok(titles.some(t => t.includes('spreadsheets') || t.includes('excel')));
  assert.ok(titles.some(t => t.includes('dashboard') || t.includes('business intelligence')));
  // Identified gaps include SQL
  const gaps = plan.assessment?.skillGapsIdentified?.map(g => g.toLowerCase()) || [];
  assert.ok(gaps.some(g => g.includes('sql') || g.includes('relational') || g.includes('database')));
});

void test('Mandated Case 5: User with stronger existing skills accelerates to advanced modules', async () => {
  const strongSkills = ['Python', 'SQL', 'Git', 'Data structures'];
  const plan = await generateCurriculum({
    goal: 'BS Computer Science',
    skills: strongSkills,
    profile: {
      ...sampleProfile,
      skills: strongSkills,
      journey: 'student',
      qualification: 'Undergraduate',
      experience: '2 years of self-taught software and open-source contributions'
    }
  });

  assert.ok(plan.modules, 'Plan must have modules');
  // Assessment explicitly records assessed prior knowledge
  assert.ok(plan.assessment?.existingKnowledgeAssessed?.includes('Python'));
  assert.ok(plan.assessment?.existingKnowledgeAssessed?.includes('SQL'));
  // Module 1 is advanced / discrete math rather than basic programming syntax
  const mod1Title = plan.modules[0].title.toLowerCase();
  assert.ok(mod1Title.includes('mathematical') || mod1Title.includes('computational complexity') || mod1Title.includes('advanced'));
  assert.ok(!mod1Title.includes('introductory python') && !mod1Title.includes('basic variables'));
});

