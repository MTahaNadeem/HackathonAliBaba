import { z } from 'zod';
import {
  type Plan,
  type Profile,
  type CurriculumModule,
  type Lesson,
  type LessonResource,
  type LearningAssessment,
  createPlan,
  getSkillResources,
  type MilestoneState
} from '../domain';
import { resources, degrees } from '../catalogue';
import { curriculumPrompt } from './prompts';
import { requestGroq, logFallback, type GroqRequest, GroqFailure } from './groq-provider';

export type { GroqRequest, GroqRequest as QwenRequest };
export { requestGroq, requestGroq as requestQwen };

export interface CurriculumInput {
  goal: string;
  skills: string[];
  profile?: Partial<Profile>;
  goalType?: 'degree' | 'career' | 'specialization' | 'skill';
  completedTopics?: string[];
  missingSkills?: string[];
}

export interface CurriculumOptions {
  signal?: AbortSignal;
  onProgress?: (progress: { message?: string; percent?: number; stage?: string }) => void;
  request?: GroqRequest;
}

// Strict Zod schema for validating Groq structured output
export const groqCurriculumSchema = z.object({
  title: z.string().min(3).max(250),
  description: z.string().min(10).max(3000),
  goalType: z.enum(['degree', 'career', 'specialization', 'skill']).default('skill'),
  subject: z.string().min(2).max(250),
  targetOutcome: z.string().min(5).max(1500),
  estimatedDuration: z.string().min(3).max(100),
  assessment: z.object({
    whatYouWillLearn: z.string().min(10).max(5000),
    whyIncluded: z.string().min(10).max(5000),
    expectedSequence: z.string().min(10).max(5000),
    estimatedTotalDuration: z.string().min(3).max(200),
    majorMilestones: z.array(z.string().min(3).max(500)).min(2).max(30),
    existingKnowledgeAssessed: z.string().max(2000).optional(),
    skillGapsIdentified: z.array(z.string().max(200)).optional(),
  }),
  modules: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(3).max(250),
    description: z.string().min(10).max(2000),
    learningObjectives: z.array(z.string().min(3).max(500)).min(1).max(25),
    estimatedDuration: z.string().min(2).max(100),
    prerequisites: z.array(z.string().max(500)).default([]),
    lessons: z.array(z.object({
      id: z.string().min(1).max(100),
      title: z.string().min(3).max(250),
      description: z.string().min(5).max(2000),
      learningObjective: z.string().min(5).max(1000),
      estimatedDuration: z.string().min(2).max(100),
      practiceTask: z.string().max(2000).optional(),
    })).min(1).max(30)
  })).min(2).max(30)
});

// Backward-compatibility alias
export const qwenCurriculumSchema = groqCurriculumSchema;

/**
 * Discovers and validates genuine, non-hallucinated resources for a lesson
 * using our catalogue and verified open course repositories.
 */
export function discoverLessonResources(
  lessonTitle: string,
  moduleTitle: string,
  subject: string
): LessonResource[] {
  const query = `${lessonTitle} ${moduleTitle} ${subject}`.toLowerCase();
  const matched: LessonResource[] = [];

  // Check known tech skills from getSkillResources
  const techSkills = [
    'react', 'typescript', 'javascript', 'python', 'sql', 'postgres',
    'node', 'express', 'next', 'git', 'docker', 'kubernetes', 'aws', 'tailwind'
  ];

  // Specific database and data science aliases
  const targetSkill = (query.includes('database') || query.includes('relational') || query.includes('sql') || query.includes('queries')) ? 'sql'
    : (query.includes('pandas') || query.includes('data science') || query.includes('machine learning') || query.includes('data wrangling') || query.includes('scikit')) ? 'python'
    : techSkills.find(skill => query.includes(skill));

  if (targetSkill) {
    const enriched = getSkillResources(targetSkill);
    if (enriched.startLearning) {
      matched.push({
        title: enriched.startLearning.title,
        provider: enriched.startLearning.provider,
        url: enriched.startLearning.url,
        resourceType: enriched.startLearning.url.includes('youtube') ? 'video' : 'course',
        verified: true
      });
    }
    if (enriched.structuredLearning) {
      matched.push({
        title: enriched.structuredLearning.title,
        provider: enriched.structuredLearning.provider,
        url: enriched.structuredLearning.url,
        resourceType: 'documentation',
        verified: true
      });
    }
  }

  // Check catalogue resources (MIT OCW, Khan Academy, CORE Econ, GCFGlobal, SQLBolt, etc.)
  for (const r of resources) {
    const hitsSkill = r.skills.some(s => query.includes(s.toLowerCase()));
    if (hitsSkill && matched.length < 2) {
      const typeMap: Record<string, 'video' | 'course' | 'documentation' | 'article' | 'exercise'> = {
        Video: 'video',
        Lessons: 'course',
        Textbook: 'documentation'
      };
      matched.push({
        title: r.title,
        provider: r.provider,
        url: r.url,
        resourceType: typeMap[r.format] || 'course',
        verified: true
      });
    }
  }

  // Verified academic domain resources for university subjects
  if (query.includes('algorithm') || query.includes('data structure') || query.includes('computer science')) {
    if (matched.length < 2) {
      matched.push({
        title: 'MIT OCW: Introduction to Algorithms (6.006)',
        provider: 'MIT OpenCourseWare',
        url: 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/',
        resourceType: 'course',
        verified: true
      });
    }
  }

  if (query.includes('calculus') || query.includes('math') || query.includes('algebra') || query.includes('discrete')) {
    if (matched.length < 2) {
      matched.push({
        title: 'Differential and Integral Calculus',
        provider: 'Khan Academy',
        url: 'https://www.khanacademy.org/math/calculus-1',
        resourceType: 'course',
        verified: true
      });
    }
  }

  if (query.includes('economics') || query.includes('micro') || query.includes('macro') || query.includes('econometric')) {
    if (matched.length < 2) {
      matched.push({
        title: 'The Economy: Economics for a Changing World',
        provider: 'CORE Econ',
        url: 'https://www.core-econ.org/',
        resourceType: 'documentation',
        verified: true
      });
    }
  }

  if (query.includes('accounting') || query.includes('finance') || query.includes('business')) {
    if (matched.length < 2) {
      matched.push({
        title: 'Principles of Accounting Volume 1',
        provider: 'OpenStax',
        url: 'https://openstax.org/details/books/principles-accounting-volume-1-financial-accounting',
        resourceType: 'documentation',
        verified: true
      });
    }
  }

  // If no exact lecture or course was found, provide a curated search link clearly marked unverified
  if (matched.length === 0) {
    const encodedTopic = encodeURIComponent(lessonTitle);
    matched.push({
      title: `Curated Subject Materials: ${lessonTitle}`,
      provider: 'MIT OpenCourseWare Search',
      url: `https://ocw.mit.edu/search/?q=${encodedTopic}`,
      resourceType: 'article',
      verified: false
    });
  }

  return matched.slice(0, 2);
}

/**
 * Builds a dynamic, cohesive curriculum tailored to the specific target,
 * goal type, known skills, skill gaps, and weekly hours when Groq is offline or unavailable.
 */
export function generateDeterministicCurriculum(input: CurriculumInput): Plan {
  const goal = input.goal?.trim() || 'Computer Science';
  const hours = input.profile?.hours ?? 10;
  const goalLower = goal.toLowerCase();

  const userSkills = Array.from(new Set([
    ...(input.profile?.skills || []),
    ...(input.skills || []),
    ...(input.profile?.extractedSkills ? input.profile.extractedSkills.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : [])
  ]));
  const userSkillsLower = userSkills.map(s => s.toLowerCase());
  const interests = input.profile?.interests || [];
  const interestsLower = interests.map(i => i.toLowerCase());

  // Determine goalType
  const isDegree = degrees.some(d => d.name.toLowerCase() === goalLower || d.id === input.profile?.goal) ||
    /^BS\s|^Bachelor|^Master|^MS\s|^BE\s/i.test(goal);
  const isCareer = input.profile?.journey === 'career' || Boolean(input.profile?.career_goal && input.profile.career_goal.toLowerCase() === goalLower);
  const goalType: 'degree' | 'career' | 'specialization' | 'skill' = input.goalType ||
    (isCareer ? 'career' : (input.profile?.specialization ? 'specialization' : (isDegree ? 'degree' : 'skill')));

  const basePlan = createPlan(goal, userSkills, hours);

  let modules: CurriculumModule[] = [];
  let assessment: LearningAssessment;

  // Domain archetypes
  const isCS = goalLower.includes('computer science') || (goalLower.includes('cs') && !goalLower.includes('economics'));
  const isSE = goalLower.includes('software engineering') || goalLower.includes('software development');
  const isDataAnalyst = goalLower.includes('data analyst') || goalLower.includes('data analysis') || goalLower.includes('business analyst');
  const isDataScience = goalLower.includes('data science') || goalLower.includes('machine learning') || goalLower.includes('ai') || goalLower.includes('artificial intelligence');
  const isFrontend = goalLower.includes('frontend') || goalLower.includes('front-end') || goalLower.includes('web development');
  const isEcon = goalLower.includes('econ');

  if (isDataAnalyst) {
    // Career Roadmap: Data Analyst (4-5 focused modules with strong SQL emphasis)
    const hasSql = userSkillsLower.includes('sql');
    const gaps = hasSql ? ['Advanced Data Storytelling', 'Automated BI Dashboards'] : ['Relational Database Queries (SQL)', 'Aggregations & Joins', 'Window Functions'];

    assessment = {
      whatYouWillLearn: 'Business data analytics, relational SQL modeling, data cleaning with spreadsheets, interactive dashboard design in Power BI/Tableau, and statistical insights.',
      whyIncluded: `Custom-tailored for ${goal} to bridge raw data manipulation with executive decision-making. Emphasizes database querying and visual analytics.`,
      expectedSequence: 'Begins with spreadsheet analysis and data cleaning, progresses through relational SQL mastery, and culminates in an executive BI dashboard portfolio capstone.',
      estimatedTotalDuration: `${Math.round(16 * (10 / hours))} weeks (${160} hours)`,
      majorMilestones: [
        'Advanced Spreadsheet & Business Data Modeling',
        'Relational Databases & Analytical SQL Queries',
        'Interactive Business Intelligence Dashboards',
        'Exploratory Data Analysis with Python',
        'Executive Analytics Portfolio Capstone'
      ],
      existingKnowledgeAssessed: userSkills.length > 0
        ? `Identified self-reported skills: ${userSkills.join(', ')}.`
        : 'Entry-level foundation in analytical reasoning and quantitative spreadsheets.',
      skillGapsIdentified: gaps,
      providerNotice: 'Deterministic Fallback Curriculum (Groq Offline)'
    };

    modules = [
      {
        id: 'mod-da-1',
        title: 'Module 1: Advanced Spreadsheets & Business Data Cleaning',
        description: 'Data hygiene, lookup functions (XLOOKUP), pivot tables, data validation, and financial/operational modeling.',
        learningObjectives: ['Audit and clean malformed transactional datasets', 'Build dynamic summary models using nested formulas and pivot tables'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Basic familiarity with tabular data'],
        lessons: [
          {
            id: 'les-da-1-1',
            title: 'Data Hygiene, Deduplication & Quality Auditing',
            description: 'Techniques for identifying missing values, anomalous outliers, and standardizing categorical columns.',
            learningObjective: 'Clean a dirty 5,000-row customer transactions dataset with consistent formatting.',
            estimatedDuration: '2 hours',
            practiceTask: 'Clean and standardize an unformatted retail ledger in Excel with missing dates and currency formats.',
            resources: []
          },
          {
            id: 'les-da-1-2',
            title: 'Advanced Formula Architecture: XLOOKUP & Dynamic Arrays',
            description: 'Modern formula workflows for joining reference tables and dynamic matrix calculations.',
            learningObjective: 'Implement multi-criteria lookups using XLOOKUP and FILTER functions.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Build an automated monthly sales reconciliation sheet using XLOOKUP and SUMIFS.',
            resources: []
          },
          {
            id: 'les-da-1-3',
            title: 'Pivot Tables, Slicers & Summary Reporting',
            description: 'Multidimensional data summarization, calculated fields, and interactive slicer controls.',
            learningObjective: 'Design an interactive operational summary view with slicers and conditional heatmaps.',
            estimatedDuration: '2 hours',
            practiceTask: 'Construct an interactive sales performance scorecard segmented by geographic region.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-da-2',
        title: 'Module 2: Relational Databases & Analytical SQL Mastery',
        description: 'Comprehensive SQL query formulation for data analytics: SELECT, filtering, multi-table JOINs, GROUP BY aggregations, and subqueries.',
        learningObjectives: ['Write complex SQL queries joining 3+ normalized tables', 'Formulate analytical aggregations with HAVING and conditional CASE statements'],
        estimatedDuration: '4 weeks (40 hours)',
        prerequisites: ['Module 1: Advanced Spreadsheets'],
        lessons: [
          {
            id: 'les-da-2-1',
            title: 'Relational Schemas, Primary/Foreign Keys & Core SELECT Queries',
            description: 'Database table relationships, filtering predicates, NULL handling, and sorting mechanics.',
            learningObjective: 'Query a multi-table database with precise WHERE filters, LIKE patterns, and order constraints.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write 5 SQL queries extracting active customer subscriptions and filtered order histories.',
            resources: []
          },
          {
            id: 'les-da-2-2',
            title: 'Multi-Table Joins (INNER, LEFT, FULL) & Aggregations',
            description: 'Joining relational tables and aggregating metrics across categories using GROUP BY and HAVING.',
            learningObjective: 'Calculate average order value, customer lifetime spend, and churn rates across product categories.',
            estimatedDuration: '3 hours',
            practiceTask: 'Write a query that performs a three-way LEFT JOIN to report monthly revenue by sales representative.',
            resources: []
          },
          {
            id: 'les-da-2-3',
            title: 'Analytical Window Functions & Ranking Mechanics',
            description: 'Partitioning data with OVER(), ROW_NUMBER(), RANK(), DENSE_RANK(), and running totals.',
            learningObjective: 'Compute 7-day rolling revenue averages and monthly customer purchase ranks using window functions.',
            estimatedDuration: '3 hours',
            practiceTask: 'Implement running totals and month-over-month percentage growth using LAG() and LEAD().',
            resources: []
          }
        ]
      },
      {
        id: 'mod-da-3',
        title: 'Module 3: Business Intelligence & Interactive Dashboards',
        description: 'Visual analytics, semantic data modeling, DAX/calculated measures, and narrative storytelling with Power BI or Tableau.',
        learningObjectives: ['Build star-schema data models for BI reporting', 'Design executive dashboards with cross-filtering and drill-through capabilities'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 2: Relational Databases & SQL'],
        lessons: [
          {
            id: 'les-da-3-1',
            title: 'Star Schema Data Modeling & Relationship Cardinality',
            description: 'Fact tables, dimension tables, one-to-many relationships, and date dimensions.',
            learningObjective: 'Design a clean star-schema model connecting sales facts with customer, store, and date dimensions.',
            estimatedDuration: '2 hours',
            practiceTask: 'Build a relational star schema in Power BI Desktop connecting sales transactions to lookup tables.',
            resources: []
          },
          {
            id: 'les-da-3-2',
            title: 'Calculated Measures & Business Metric Engineering',
            description: 'Writing DAX measures for Year-to-Date revenue, profit margins, and cohort retention.',
            learningObjective: 'Formulate time-intelligence calculations comparing current period performance to previous period.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Create 4 reusable DAX measures computing YoY revenue growth and gross profit percentage.',
            resources: []
          },
          {
            id: 'les-da-3-3',
            title: 'Dashboard UX, Visual Hierarchy & Executive Storytelling',
            description: 'Choosing chart types for comparisons, distributions, and trends with clear visual hierarchy.',
            learningObjective: 'Construct a single-page executive overview dashboard with KPI cards and interactive drill-through.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Design a clean, accessible executive dashboard highlighting regional quarterly performance.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-da-4',
        title: 'Module 4: Exploratory Data Analysis with Python (Pandas & Seaborn)',
        description: 'Python for automated data inspection, handling missing records, computing descriptive statistics, and generating publication-ready charts.',
        learningObjectives: ['Wrangle tabular datasets with Pandas', 'Visualize multi-variable correlations with Seaborn heatmaps'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 2: Relational Databases & SQL'],
        lessons: [
          {
            id: 'les-da-4-1',
            title: 'Pandas DataFrames, Indexing & Missing Data Handling',
            description: 'Loading CSVs, inspecting columns, handling null values, and datatype casting.',
            learningObjective: 'Load an uncleaned CSV, impute missing values, and transform dates into standard formats.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Clean an e-commerce customer churn dataset in a Jupyter notebook using Pandas.',
            resources: []
          },
          {
            id: 'les-da-4-2',
            title: 'Descriptive Statistics & Exploratory Visualization',
            description: 'Summary statistics, histograms, boxplots for outlier detection, and correlation matrices.',
            learningObjective: 'Identify significant statistical relationships and skewness across continuous variables.',
            estimatedDuration: '2 hours',
            practiceTask: 'Generate a correlation matrix and distribution plots for customer lifetime value features.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-da-5',
        title: 'Module 5: Capstone Project: Enterprise Analytics & Executive Brief',
        description: 'Synthesize SQL queries, data cleaning, interactive dashboarding, and actionable business recommendations into a complete portfolio case study.',
        learningObjectives: ['Deliver an end-to-end data analytics project from raw database to executive presentation', 'Present quantitative findings with clear business strategy recommendations'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 1, 2, 3, and 4'],
        lessons: [
          {
            id: 'les-da-5-1',
            title: 'Business Problem Formulation & Data Extraction',
            description: 'Defining key performance indicators and extracting raw data using structured SQL scripts.',
            learningObjective: 'Frame an actionable business question and extract the required relational dataset.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Draft a project charter and extract 10,000 rows of relational sales and support data.',
            resources: []
          },
          {
            id: 'les-da-5-2',
            title: 'Final Dashboard Assembly & Executive Portfolio Brief',
            description: 'Compiling findings into an interactive dashboard and a 2-page executive summary slide deck.',
            learningObjective: 'Publish an interactive portfolio dashboard with documented insights and business action items.',
            estimatedDuration: '3 hours',
            practiceTask: 'Present a 5-minute video walkthrough of your dashboard highlighting 3 high-impact business insights.',
            resources: []
          }
        ]
      }
    ];
  } else if (isDataScience) {
    // Career Roadmap: Data Science (4-5 focused modules skipping basic Python syntax)
    const hasPython = userSkillsLower.includes('python');

    assessment = {
      whatYouWillLearn: 'Advanced data wrangling with Pandas/NumPy, statistical inference, feature engineering, supervised/unsupervised machine learning with Scikit-Learn, and model deployment.',
      whyIncluded: `Tailored for ${goal}. ${hasPython ? 'Leverages your existing Python background to skip introductory syntax and advance directly into exploratory data analysis and predictive modeling.' : 'Provides progressive grounding in scientific Python and machine learning algorithms.'}`,
      expectedSequence: 'Begins with scientific computing and statistical analysis, advances into feature engineering and machine learning models, and concludes with an end-to-end predictive pipeline capstone.',
      estimatedTotalDuration: `${Math.round(16 * (10 / hours))} weeks (${160} hours)`,
      majorMilestones: [
        'Scientific Computing & Advanced Tabular Wrangling',
        'Statistical Inference & Exploratory Data Analysis',
        'Supervised & Unsupervised Machine Learning (Scikit-Learn)',
        'Model Evaluation, Hyperparameter Tuning & Cross-Validation',
        'End-to-End Predictive Pipeline & Deployment Capstone'
      ],
      existingKnowledgeAssessed: hasPython
        ? `Self-reported Python skills confirmed: ${userSkills.join(', ')}. Introductory programming is bypassed to focus on scientific pipelines.`
        : 'Entry-level quantitative foundation.',
      skillGapsIdentified: ['Feature engineering', 'Machine learning algorithms (Scikit-Learn)', 'Model evaluation & validation'],
      providerNotice: 'Deterministic Fallback Curriculum (Groq Offline)'
    };

    modules = [
      {
        id: 'mod-ds-1',
        title: 'Module 1: Scientific Computing & Tabular Wrangling with Pandas & NumPy',
        description: 'Vectorized array computations, multidimensional matrices, dataframe reshaping, merge/join operations, and datetime manipulation.',
        learningObjectives: ['Perform vectorized mathematical transformations with NumPy', 'Reshape, pivot, and merge complex multi-table datasets with Pandas'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: [hasPython ? 'Working knowledge of Python syntax' : 'Introductory programming'],
        lessons: [
          {
            id: 'les-ds-1-1',
            title: 'Vectorized Arrays & Broadcasting in NumPy',
            description: 'N-dimensional arrays, memory layouts, slicing, and broadcasting mechanics.',
            learningObjective: 'Implement matrix operations and vectorized calculations without explicit Python loops.',
            estimatedDuration: '2 hours',
            practiceTask: 'Vectorize a Euclidean distance calculation across 10,000 coordinate pairs in NumPy.',
            resources: []
          },
          {
            id: 'les-ds-1-2',
            title: 'Advanced Data Cleaning & Transformations in Pandas',
            description: 'Groupby aggregations, rolling window transforms, and categorical encoding.',
            learningObjective: 'Clean a noisy 50,000-record dataset handling missing data and type discrepancies.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Clean and reshape a messy multi-source hospital admission dataset.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-ds-2',
        title: 'Module 2: Probability, Statistical Inference & Exploratory Analysis',
        description: 'Continuous/discrete distributions, central limit theorem, hypothesis testing (t-tests, ANOVA), and correlation vs causation.',
        learningObjectives: ['Conduct statistical hypothesis tests to validate experiments', 'Perform exploratory data analysis with multivariate visualizations'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Scientific Computing'],
        lessons: [
          {
            id: 'les-ds-2-1',
            title: 'Distributions, Central Limit Theorem & Confidence Intervals',
            description: 'Normal, Poisson, and Binomial distributions and calculating bootstrap confidence intervals.',
            learningObjective: 'Calculate and interpret confidence intervals for population parameters from sample data.',
            estimatedDuration: '2 hours',
            practiceTask: 'Run a Monte Carlo simulation verifying the Central Limit Theorem for skewed distributions.',
            resources: []
          },
          {
            id: 'les-ds-2-2',
            title: 'Hypothesis Testing & A/B Experimentation',
            description: 'Null hypothesis formulation, p-values, Type I/II errors, and two-sample t-tests.',
            learningObjective: 'Analyze an A/B test conversion dataset and formulate a rigorous statistical conclusion.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Conduct a two-sample t-test on website conversion rates and compute statistical power.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-ds-3',
        title: 'Module 3: Supervised Machine Learning with Scikit-Learn',
        description: 'Linear regression, logistic regression, decision trees, random forests, and gradient boosting algorithms.',
        learningObjectives: ['Train and evaluate regression and classification models', 'Engineer informative features from raw tabular columns'],
        estimatedDuration: '4 weeks (40 hours)',
        prerequisites: ['Module 2: Statistical Inference'],
        lessons: [
          {
            id: 'les-ds-3-1',
            title: 'Linear & Logistic Regression with Regularization',
            description: 'Cost functions, gradient descent, L1/L2 regularization (Lasso/Ridge), and decision boundaries.',
            learningObjective: 'Train a regularized regression model and interpret feature coefficient weights.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Train a Lasso regression predicting housing prices and identify sparse feature subsets.',
            resources: []
          },
          {
            id: 'les-ds-3-2',
            title: 'Tree-Based Ensembles: Random Forests & Gradient Boosting',
            description: 'Decision tree splitting criteria (Gini/Entropy), bagging, boosting, and XGBoost mechanics.',
            learningObjective: 'Train a Random Forest classifier and evaluate feature importances.',
            estimatedDuration: '3 hours',
            practiceTask: 'Build a customer churn prediction pipeline with cross-validated ROC-AUC evaluation.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-ds-4',
        title: 'Module 4: Model Validation, Tuning & Unsupervised Learning',
        description: 'Cross-validation strategies, confusion matrices, ROC-AUC, precision-recall tradeoffs, K-Means clustering, and PCA dimensionality reduction.',
        learningObjectives: ['Implement robust cross-validation preventing data leakage', 'Cluster high-dimensional records using PCA and K-Means'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 3: Supervised Machine Learning'],
        lessons: [
          {
            id: 'les-ds-4-1',
            title: 'Cross-Validation & Hyperparameter Optimization',
            description: 'K-Fold, Stratified K-Fold, GridSearchCV, and Optuna Bayesian optimization.',
            learningObjective: 'Optimize model hyperparameters using Stratified K-Fold without test-set leakage.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Tune hyperparameters for a gradient-boosted tree model using GridSearchCV.',
            resources: []
          },
          {
            id: 'les-ds-4-2',
            title: 'Dimensionality Reduction (PCA) & Clustering (K-Means)',
            description: 'Eigenvectors, explained variance ratio, elbow method, and silhouette scores.',
            learningObjective: 'Reduce a 50-variable feature space into 3 principal components and cluster observations.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Perform customer segmentation on purchase histories using PCA and K-Means.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-ds-5',
        title: 'Module 5: Capstone Project: End-to-End Machine Learning Pipeline',
        description: 'Deploy an automated machine learning inference pipeline with reproducible data preprocessing, artifact serialization, and API endpoint.',
        learningObjectives: ['Package a complete ML model into a production prediction service', 'Document model performance, limitations, and ethical considerations'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 1, 2, 3, and 4'],
        lessons: [
          {
            id: 'les-ds-5-1',
            title: 'Pipeline Assembly, Serialization & API Packaging',
            description: 'Scikit-learn Pipelines, ColumnTransformers, model serialization with joblib, and FastAPI endpoints.',
            learningObjective: 'Export an end-to-end preprocessing and prediction pipeline exposed via REST API.',
            estimatedDuration: '3 hours',
            practiceTask: 'Build a FastAPI endpoint serving real-time predictions from a trained ML pipeline.',
            resources: []
          },
          {
            id: 'les-ds-5-2',
            title: 'Model Evaluation Report & Production Defense',
            description: 'Drafting an empirical performance report with calibration curves, drift checks, and unit tests.',
            learningObjective: 'Present a complete machine learning project portfolio artifact with GitHub repository.',
            estimatedDuration: '3 hours',
            practiceTask: 'Publish your complete project notebook, API code, and technical documentation.',
            resources: []
          }
        ]
      }
    ];
  } else if (isSE) {
    // Broad Degree: BS Software Engineering (8 substantial academic modules)
    const hasWeb = interestsLower.some(i => i.includes('web') || i.includes('frontend') || i.includes('full'));

    assessment = {
      whatYouWillLearn: 'Software construction, design patterns, relational and document databases, software architecture, modern web services, automated testing/QA, CI/CD DevOps pipelines, and enterprise capstone engineering.',
      whyIncluded: `Structured for ${goal} with a strong focus on the complete software engineering lifecycle, robust system design, and industry production standards.${hasWeb ? ' Aligned with your declared interest in web engineering and full-stack systems.' : ''}`,
      expectedSequence: 'Progresses from object-oriented software construction through core data structures, database engineering, clean architecture, automated testing, cloud DevOps, and a comprehensive production capstone.',
      estimatedTotalDuration: `${Math.round(24 * (10 / hours))} weeks (${240} hours)`,
      majorMilestones: [
        'Software Construction & Object-Oriented Design',
        'Data Structures & Algorithmic Problem Solving',
        'Relational Database Modeling & Transaction Engineering',
        'Software Architecture, Clean Design & SOLID Principles',
        'Modern Web Architecture & Distributed API Services',
        'Software Quality Assurance, Automated Testing & Verification',
        'DevOps, Containerization & CI/CD Pipelines',
        'Production Software Engineering Capstone System'
      ],
      existingKnowledgeAssessed: userSkills.length > 0
        ? `Identified prior skills: ${userSkills.join(', ')}. Integrated into practical engineering projects.`
        : 'Entry-level programming and analytical capability.',
      skillGapsIdentified: ['Design patterns & SOLID principles', 'Automated test-driven development (TDD)', 'CI/CD pipeline configuration & cloud deployment'],
      providerNotice: 'Deterministic Fallback Curriculum (Groq Offline)'
    };

    modules = [
      {
        id: 'mod-se-1',
        title: 'Module 1: Software Construction & Object-Oriented Principles',
        description: 'Encapsulation, inheritance, polymorphism, abstraction, modular decomposition, and clean code conventions.',
        learningObjectives: ['Implement class hierarchies applying strong encapsulation', 'Apply composition over inheritance in software components'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Basic programming syntax in Python, TypeScript, or Java'],
        lessons: [
          {
            id: 'les-se-1-1',
            title: 'Object-Oriented Decomposition & Domain Modeling',
            description: 'Class design, state management, and separation of concerns.',
            learningObjective: 'Model a real-world business system using cohesive classes with clear boundaries.',
            estimatedDuration: '2 hours',
            practiceTask: 'Implement a domain model for a banking ledger with accounts, transactions, and audit trails.',
            resources: []
          },
          {
            id: 'les-se-1-2',
            title: 'Polymorphism, Interfaces & Abstract Contracts',
            description: 'Interface design, runtime polymorphism, and decoupling implementations.',
            learningObjective: 'Implement interchangeable notification providers conforming to a single interface contract.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Build a notification service supporting Email, SMS, and Push providers via an abstract interface.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-2',
        title: 'Module 2: Core Data Structures & Algorithmic Complexity',
        description: 'Asymptotic complexity (Big-O), arrays, linked lists, hash tables, stacks, queues, and tree traversals.',
        learningObjectives: ['Analyze time and space complexity of algorithms', 'Select optimal data structures for given throughput requirements'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Software Construction'],
        lessons: [
          {
            id: 'les-se-2-1',
            title: 'Asymptotic Analysis & Linear Data Structures',
            description: 'Big-O notation, array memory layout, stacks, and queues.',
            learningObjective: 'Calculate tight asymptotic bounds and implement a queue with amortized O(1) operations.',
            estimatedDuration: '2 hours',
            practiceTask: 'Implement a thread-safe message buffer queue in code with bounded capacity.',
            resources: []
          },
          {
            id: 'les-se-2-2',
            title: 'Hash Maps & Binary Search Trees',
            description: 'Hash collisions, open addressing, BST traversal invariants, and balanced trees.',
            learningObjective: 'Implement a hash map with collision resolution and evaluate search performance.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Construct a custom hash set with chaining and benchmark lookup speeds against an array.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-3',
        title: 'Module 3: Database Modeling & Relational Systems',
        description: 'Relational data modeling, schema normalization (1NF to 3NF), SQL querying, indexing, and ACID transaction semantics.',
        learningObjectives: ['Design normalized relational schemas with foreign key integrity', 'Write optimized SQL queries and analyze execution plans'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Software Construction'],
        lessons: [
          {
            id: 'les-se-3-1',
            title: 'Relational Schema Design & Normalization',
            description: 'Entity relationship modeling, cardinality, and eliminating redundant data anomalies.',
            learningObjective: 'Normalize an unnormalized transaction spreadsheet into 3rd Normal Form.',
            estimatedDuration: '2 hours',
            practiceTask: 'Design an Entity Relationship Diagram (ERD) for an enterprise inventory management system.',
            resources: []
          },
          {
            id: 'les-se-3-2',
            title: 'Advanced SQL Queries, Indexes & Transactions',
            description: 'Multi-table joins, subqueries, B-tree indexes, and database transaction isolation.',
            learningObjective: 'Optimize slow queries using composite indexes and verify performance with EXPLAIN ANALYZE.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write a transactional funds transfer script ensuring ACID rollback on failure.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-4',
        title: 'Module 4: Software Architecture, Clean Code & Design Patterns',
        description: 'SOLID design principles, Gang of Four patterns (Factory, Observer, Strategy, Decorator), and layered clean architecture.',
        learningObjectives: ['Refactor monolithic code using SOLID principles', 'Apply behavioral and creational design patterns to solve common architectural problems'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 1 and 2'],
        lessons: [
          {
            id: 'les-se-4-1',
            title: 'SOLID Principles in Practice',
            description: 'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.',
            learningObjective: 'Refactor a tightly coupled class hierarchy into an extensible SOLID design.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Refactor an order-processing monolith to satisfy Open/Closed and Dependency Inversion.',
            resources: []
          },
          {
            id: 'les-se-4-2',
            title: 'Core Design Patterns: Strategy, Factory & Observer',
            description: 'Creational, structural, and behavioral patterns for robust software design.',
            learningObjective: 'Implement the Strategy and Observer patterns to decouple event-driven business logic.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Build an extensible payment gateway using the Strategy and Factory patterns.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-5',
        title: 'Module 5: Modern Web Architecture & Distributed API Services',
        description: 'RESTful API contracts, HTTP protocol semantics, stateless session security, input validation, and microservices concepts.',
        learningObjectives: ['Build type-safe REST API endpoints with schema validation', 'Implement secure JWT authentication and authorization middleware'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 3 and 4'],
        lessons: [
          {
            id: 'les-se-5-1',
            title: 'RESTful API Design & Structured Payload Validation',
            description: 'HTTP verbs, status code semantics, JSON schemas, and error handling middleware.',
            learningObjective: 'Build a production-grade CRUD router with validation and standard HTTP error responses.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Develop a RESTful product catalog API with Zod validation and structured error payloads.',
            resources: []
          },
          {
            id: 'les-se-5-2',
            title: 'Authentication, Authorization & Session Security',
            description: 'JWT tokens, password hashing (bcrypt), role-based access control (RBAC), and CORS protection.',
            learningObjective: 'Implement secure login, registration, and role-guarded endpoints.',
            estimatedDuration: '3 hours',
            practiceTask: 'Implement authentication middleware verifying signed JWTs and protecting admin routes.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-6',
        title: 'Module 6: Software Testing, Quality Assurance & TDD',
        description: 'Unit testing, integration testing, end-to-end testing, test-driven development (TDD), mocking, and code coverage metrics.',
        learningObjectives: ['Practice test-driven development writing tests before production code', 'Mock external network and database dependencies in automated test suites'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 5: Modern Web Architecture'],
        lessons: [
          {
            id: 'les-se-6-1',
            title: 'Unit Testing & Test-Driven Development (TDD)',
            description: 'The Red-Green-Refactor cycle, test assertions, and achieving high unit test coverage.',
            learningObjective: 'Build a core business domain calculation engine using pure TDD.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write a comprehensive unit test suite achieving 90%+ code coverage for a discount pricing engine.',
            resources: []
          },
          {
            id: 'les-se-6-2',
            title: 'Integration Testing & Service Mocking',
            description: 'Testing API endpoints and database interactions with mocked third-party integrations.',
            learningObjective: 'Write integration tests verifying database transactions and mocked payment gateways.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write automated integration tests for your REST API using in-memory databases and mocked services.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-7',
        title: 'Module 7: DevOps, Containerization & CI/CD Pipelines',
        description: 'Docker containerization, Docker Compose, automated build pipelines with GitHub Actions, environment configuration, and cloud hosting.',
        learningObjectives: ['Containerize full-stack applications with Docker', 'Configure an automated CI/CD pipeline that lints, tests, and deploys code'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 6: Software Testing'],
        lessons: [
          {
            id: 'les-se-7-1',
            title: 'Application Containerization with Docker',
            description: 'Dockerfile instructions, multi-stage builds, container isolation, and Docker Compose networking.',
            learningObjective: 'Create an optimized multi-stage Dockerfile for a web application and its database.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Containerize a full-stack application and database using Docker Compose.',
            resources: []
          },
          {
            id: 'les-se-7-2',
            title: 'Automated CI/CD Workflows with GitHub Actions',
            description: 'Pipeline triggers, test execution steps, artifact builds, and automated cloud deployments.',
            learningObjective: 'Configure a GitHub Actions workflow that executes tests on pull requests and deploys main.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write a GitHub Actions YAML workflow that installs dependencies, lints, and runs tests.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-se-8',
        title: 'Module 8: Capstone Project: Production Software Engineering System',
        description: 'Design, develop, test, and deploy a comprehensive enterprise-grade software system with automated CI/CD, documentation, and live demo.',
        learningObjectives: ['Deliver an end-to-end production software engineering project', 'Present architectural trade-off decisions, test coverage reports, and live deployment'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 1 through 7'],
        lessons: [
          {
            id: 'les-se-8-1',
            title: 'System Architecture Specification & Technical Design Doc',
            description: 'Writing software requirements specifications (SRS), component architecture diagrams, and database schemas.',
            learningObjective: 'Draft a comprehensive architectural design document for the capstone system.',
            estimatedDuration: '3 hours',
            practiceTask: 'Write a 4-page software architecture document with ERDs and component interaction diagrams.',
            resources: []
          },
          {
            id: 'les-se-8-2',
            title: 'Production Deployment & Senior Engineering Defense',
            description: 'Deploying the system to cloud infrastructure with logging, health checks, and public demo URL.',
            learningObjective: 'Deploy the complete capstone system with live URL, automated CI/CD, and 85%+ test coverage.',
            estimatedDuration: '3.5 hours',
            practiceTask: 'Deploy the production application to a cloud provider and record an architectural walkthrough.',
            resources: []
          }
        ]
      }
    ];
  } else if (isEcon) {
    // Broad Degree: Economics (6 substantial academic modules)
    assessment = {
      whatYouWillLearn: 'Microeconomic decision theory, macroeconomic stabilization policy, quantitative econometrics, statistical hypothesis testing, international trade, and empirical research.',
      whyIncluded: `Tailored for ${goal} to balance theoretical economic rigor with empirical quantitative skills demanded by research institutes, central banks, and financial advisory roles.`,
      expectedSequence: 'Begins with consumer optimization and market equilibrium, advances to aggregate macroeconomic dynamics, empirical regression econometrics, and policy research capstone.',
      estimatedTotalDuration: `${Math.round(18 * (10 / hours))} weeks (${180} hours)`,
      majorMilestones: [
        'Foundations of Microeconomics & Consumer Choice',
        'Macroeconomic Policy, National Accounting & Monetary Systems',
        'Econometrics, Ordinary Least Squares & Statistical Inference',
        'Multiple Regression & Causal Identification',
        'International Economics, Trade & Financial Markets',
        'Empirical Economic Research Capstone'
      ],
      existingKnowledgeAssessed: userSkills.length > 0 ? `Self-reported skills: ${userSkills.join(', ')}` : 'Entry-level foundation in secondary mathematics.',
      skillGapsIdentified: ['Econometric modeling', 'Empirical regression analysis', 'Statistical hypothesis testing'],
      providerNotice: 'Deterministic Fallback Curriculum (Groq Offline)'
    };

    modules = [
      {
        id: 'mod-econ-1',
        title: 'Module 1: Foundations of Microeconomics & Consumer Theory',
        description: 'Scarcity, choice, supply, demand, elasticity, consumer preferences, budget constraints, and utility maximization.',
        learningObjectives: ['Model consumer equilibrium using budget lines and indifference curves', 'Calculate price and income elasticities of demand'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Basic secondary mathematics and algebra'],
        lessons: [
          {
            id: 'les-econ-1-1',
            title: 'Scarcity, Opportunity Cost, and Comparative Advantage',
            description: 'Core economic tradeoffs and gains from trade.',
            learningObjective: 'Derive production possibilities frontiers and calculate opportunity costs between goods.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Draw a PPF curve from a given production schedule and identify points of efficiency.',
            resources: []
          },
          {
            id: 'les-econ-1-2',
            title: 'Market Equilibrium, Supply, and Demand Elasticity',
            description: 'Price discovery mechanics and elasticity formulas.',
            learningObjective: 'Calculate price elasticity of demand and explain implications for total revenue.',
            estimatedDuration: '2 hours',
            practiceTask: 'Calculate point elasticity for a given demand equation and determine consumer surplus.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-econ-2',
        title: 'Module 2: Macroeconomic Systems & National Income Accounting',
        description: 'Aggregate economic performance, GDP calculation, inflation metrics, unemployment, and monetary transmission.',
        learningObjectives: ['Compute real vs nominal GDP', 'Explain the transmission mechanism of central bank monetary policy'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Foundations of Microeconomics'],
        lessons: [
          {
            id: 'les-econ-2-1',
            title: 'Measuring National Output: GDP, Inflation & Price Indexes',
            description: 'Expenditure and income approaches to national accounting.',
            learningObjective: 'Calculate GDP deflator, CPI, and analyze real growth rates across periods.',
            estimatedDuration: '2 hours',
            practiceTask: 'Calculate real GDP growth and inflation rate for a simulated two-year economy.',
            resources: []
          },
          {
            id: 'les-econ-2-2',
            title: 'The IS-LM Framework & Monetary Policy Transmission',
            description: 'Goods market and money market equilibrium interactions.',
            learningObjective: 'Graphically analyze the effects of central bank interest rate interventions.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Simulate the impact of an expansionary fiscal policy shift on interest rates and investment.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-econ-3',
        title: 'Module 3: Econometrics & Quantitative Data Analysis',
        description: 'Statistical estimation of economic relationships, ordinary least squares (OLS), and regression diagnostics.',
        learningObjectives: ['Estimate bivariate and multiple regression models', 'Interpret p-values, R-squared, and standard errors'],
        estimatedDuration: '4 weeks (40 hours)',
        prerequisites: ['Introductory Statistics & Probability'],
        lessons: [
          {
            id: 'les-econ-3-1',
            title: 'Simple Linear Regression & Gauss-Markov Assumptions',
            description: 'Deriving OLS estimators and unbiasedness properties.',
            learningObjective: 'State the five Gauss-Markov assumptions and interpret regression slope coefficients.',
            estimatedDuration: '2 hours',
            practiceTask: 'Run an OLS regression between education level and wage income on a sample dataset.',
            resources: []
          },
          {
            id: 'les-econ-3-2',
            title: 'Multiple Regression & Omitted Variable Bias',
            description: 'Controlling for confounding factors in observational economic data.',
            learningObjective: 'Diagnose omitted variable bias and formulate multivariable econometric specifications.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Estimate a wage equation controlling for experience, education, and regional location.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-econ-4',
        title: 'Module 4: Empirical Capstone & Policy Paper',
        description: 'Synthesize micro, macro, and econometric tools to produce a data-driven policy investigation.',
        learningObjectives: ['Formulate an empirical research question', 'Draft an academic-grade policy brief with data charts'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 1, 2, and 3'],
        lessons: [
          {
            id: 'les-econ-4-1',
            title: 'Empirical Data Cleaning & Regression Estimation',
            description: 'Managing public economic datasets and reporting descriptive statistics.',
            learningObjective: 'Clean raw macro indicators, handle missing values, and estimate regression models.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Produce a standardized descriptive statistics table and correlation matrix in Python/Excel.',
            resources: []
          },
          {
            id: 'les-econ-4-2',
            title: 'Policy Paper Defense & Executive Brief',
            description: 'Communicating econometric findings to policymakers and stakeholders.',
            learningObjective: 'Present regression findings with policy recommendations and limitations.',
            estimatedDuration: '3 hours',
            practiceTask: 'Draft a 1,500-word policy brief summarizing findings and presenting actionable recommendations.',
            resources: []
          }
        ]
      }
    ];
  } else {
    // Broad Degree: BS Computer Science (8 substantial academic modules)
    const hasPython = userSkillsLower.includes('python');
    const isAIInterested = interestsLower.some(i => i.includes('ai') || i.includes('artificial') || i.includes('machine learning'));

    assessment = {
      whatYouWillLearn: 'Algorithmic problem solving, asymptotic complexity, data structures, computer architecture & low-level memory, relational and distributed databases, operating systems & concurrency, computer networking, specialized electives, and a senior capstone system.',
      whyIncluded: `Structured for ${goal} to balance academic theoretical rigor with modern systems programming and software engineering standards.${hasPython ? ' Acknowledges your existing Python skills to accelerate directly into advanced algorithms and computational models.' : ''}`,
      expectedSequence: 'Begins with computational logic and data structures, advances through low-level computer architecture, database engineering, operating systems, networking, specialized domain electives, and senior capstone.',
      estimatedTotalDuration: `${Math.round(24 * (10 / hours))} weeks (${240} hours)`,
      majorMilestones: [
        hasPython ? 'Discrete Mathematics & Computational Complexity' : 'Foundations of Computational Logic & Programming',
        'Non-Linear Data Structures & Graph Algorithms',
        'Computer Architecture, Memory Layout & Assembly Principles',
        'Database Systems, Relational Modeling & Indexing',
        'Operating Systems, Concurrency & Process Scheduling',
        'Computer Networks, Protocols & Distributed Systems',
        isAIInterested ? 'Elective: Artificial Intelligence & Intelligent Agents' : 'Elective: Advanced Systems & Distributed Cloud Architecture',
        'Senior Capstone System & Engineering Defense'
      ],
      existingKnowledgeAssessed: hasPython
        ? `Self-reported skills: ${userSkills.join(', ')}. Foundational programming syntax is acknowledged, allowing immediate focus on asymptotic complexity and data structure internals.`
        : 'Entry-level analytical capability and basic programming literacy.',
      skillGapsIdentified: ['System architecture & memory hierarchy', 'Non-linear data structures & graph algorithms', 'Operating systems & concurrency'],
      providerNotice: 'Deterministic Fallback Curriculum (Groq Offline)'
    };

    modules = [
      {
        id: 'mod-cs-1',
        title: hasPython
          ? 'Module 1: Mathematical Foundations & Computational Complexity'
          : 'Module 1: Foundations of Computational Logic & Programming',
        description: hasPython
          ? 'Discrete mathematics, logic, Big-O asymptotic analysis, recurrences, and memory models leveraging your prior Python background.'
          : 'Algorithmic thinking, control structures, Big-O complexity analysis, and linear data representations.',
        learningObjectives: ['Analyze time and space complexity using asymptotic bounds', 'Formulate discrete mathematical models for computational problems'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Basic secondary algebra'],
        lessons: [
          {
            id: 'les-cs-1-1',
            title: 'Asymptotic Analysis & Big-O Notation',
            description: 'Measuring algorithm performance independently of hardware.',
            learningObjective: 'Determine tight asymptotic bounds (O, Ω, Θ) for iterative and recursive functions.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Calculate the exact Big-O time and space complexity for three provided sorting algorithms.',
            resources: []
          },
          {
            id: 'les-cs-1-2',
            title: 'Contiguous Memory Allocation & Linear Structures',
            description: 'Arrays, dynamic sizing, two-pointer techniques, and amortized complexity.',
            learningObjective: 'Implement memory-efficient array transformations and sliding window algorithms.',
            estimatedDuration: '2 hours',
            practiceTask: 'Write a function implementing the sliding window pattern to find the maximum sum subarray.',
            resources: []
          },
          {
            id: 'les-cs-1-3',
            title: 'Linked Lists, Stacks & Queue Implementations',
            description: 'Node-based memory links, pointer manipulation, and LIFO/FIFO mechanics.',
            learningObjective: 'Implement a doubly linked list and a stack-based expression evaluator.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Implement a queue using two stacks and demonstrate amortized O(1) operations.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-2',
        title: 'Module 2: Non-Linear Data Structures & Graph Algorithms',
        description: 'Binary search trees, balanced trees, hash tables with collision resolution, and depth/breadth first graph traversals.',
        learningObjectives: ['Implement tree traversals and heap priority queues', 'Solve shortest-path graph problems using BFS and Dijkstra'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Foundations'],
        lessons: [
          {
            id: 'les-cs-2-1',
            title: 'Hash Tables, Collision Resolution & Hash Functions',
            description: 'Hash sets, hash maps, open addressing, and separate chaining.',
            learningObjective: 'Explain constant-time average lookups and resolve hash collisions.',
            estimatedDuration: '2 hours',
            practiceTask: 'Implement a custom hash map with linear probing collision resolution in code.',
            resources: []
          },
          {
            id: 'les-cs-2-2',
            title: 'Binary Search Trees & Priority Queues (Heaps)',
            description: 'Hierarchical data, search invariants, and min/max heap operations.',
            learningObjective: 'Insert, search, and delete nodes in a BST while maintaining binary search invariants.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Construct a min-heap from an unsorted array and implement extractMin in O(log n).',
            resources: []
          },
          {
            id: 'les-cs-2-3',
            title: 'Graph Representations & Traversals (BFS / DFS)',
            description: 'Adjacency lists, matrices, connected components, and cycle detection.',
            learningObjective: 'Write iterative and recursive BFS and DFS to traverse directed and undirected graphs.',
            estimatedDuration: '3 hours',
            practiceTask: 'Build a maze-solver function using Breadth-First Search that returns the shortest path coordinate list.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-3',
        title: 'Module 3: Computer Architecture & Low-Level Systems',
        description: 'Von Neumann architecture, register transfer logic, CPU instruction sets, memory hierarchy, and caching.',
        learningObjectives: ['Explain the CPU instruction execution cycle', 'Analyze how CPU cache hierarchy impacts algorithm efficiency'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Foundations'],
        lessons: [
          {
            id: 'les-cs-3-1',
            title: 'Digital Logic, ALU Operations & Register Transfer',
            description: 'Boolean gates, arithmetic logic units, registers, and program counters.',
            learningObjective: 'Trace an arithmetic operation through CPU registers and ALU execution.',
            estimatedDuration: '2 hours',
            practiceTask: 'Trace 5 assembly instructions showing register and memory state changes.',
            resources: []
          },
          {
            id: 'les-cs-3-2',
            title: 'Memory Hierarchy, Caches (L1/L2/L3) & Cache Locality',
            description: 'Spatial and temporal locality, cache lines, hit/miss ratios, and virtual memory.',
            learningObjective: 'Analyze how memory layout and cache lines influence multi-dimensional array traversal speed.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Benchmark row-major vs column-major array iteration demonstrating cache hit advantages.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-4',
        title: 'Module 4: Database Engineering & Information Systems',
        description: 'Relational data modeling, SQL queries, indexing, normalization, and ACID transaction semantics.',
        learningObjectives: ['Design third normal form relational schemas', 'Write optimized SQL queries with multiple joins and indexes'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 2: Non-Linear Data Structures'],
        lessons: [
          {
            id: 'les-cs-4-1',
            title: 'Relational Data Modeling & Normalization (1NF to 3NF)',
            description: 'Entities, attributes, primary/foreign keys, and eliminating update anomalies.',
            learningObjective: 'Normalize an unnormalized transaction ledger into third normal form.',
            estimatedDuration: '2 hours',
            practiceTask: 'Create an entity relationship diagram (ERD) with primary and foreign key constraints.',
            resources: []
          },
          {
            id: 'les-cs-4-2',
            title: 'Advanced SQL: Aggregations, Joins & Subqueries',
            description: 'INNER/LEFT/FULL joins, GROUP BY, HAVING, and window functions.',
            learningObjective: 'Formulate analytical SQL queries using window functions and conditional aggregations.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write a SQL query that ranks student performance per department using window functions.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-5',
        title: 'Module 5: Operating Systems & Concurrent Programming',
        description: 'Process management, threads, concurrency, race conditions, semaphores, mutexes, and deadlocks.',
        learningObjectives: ['Implement multi-threaded programs synchronized with mutexes', 'Diagnose and prevent deadlock conditions in concurrent software'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 3: Computer Architecture'],
        lessons: [
          {
            id: 'les-cs-5-1',
            title: 'Processes, Threads & CPU Scheduling Algorithms',
            description: 'Process control blocks, context switches, Round-Robin, and Priority scheduling.',
            learningObjective: 'Compare preemptive and non-preemptive scheduling algorithms for average wait time.',
            estimatedDuration: '2 hours',
            practiceTask: 'Simulate Round-Robin CPU scheduling given process burst and arrival times.',
            resources: []
          },
          {
            id: 'les-cs-5-2',
            title: 'Synchronization, Mutexes & Deadlock Prevention',
            description: 'Critical sections, race conditions, atomic operations, and Banker’s algorithm.',
            learningObjective: 'Write concurrent code protecting shared memory using mutex locks.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Solve the classic Dining Philosophers problem preventing deadlock using resource hierarchy.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-6',
        title: 'Module 6: Computer Networks & Distributed Communication',
        description: 'OSI and TCP/IP stack layers, socket programming, routing protocols, DNS, TLS encryption, and HTTP mechanics.',
        learningObjectives: ['Build a client-server socket communication application', 'Trace packet routing, TCP three-way handshakes, and DNS resolution'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 5: Operating Systems'],
        lessons: [
          {
            id: 'les-cs-6-1',
            title: 'The TCP/IP Protocol Stack & Socket Programming',
            description: 'TCP reliability, UDP speed, port multiplexing, and network socket APIs.',
            learningObjective: 'Build a multi-client chat server using raw TCP sockets.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Implement an echo server handling multiple simultaneous client socket connections.',
            resources: []
          },
          {
            id: 'les-cs-6-2',
            title: 'Application Protocols (HTTP, DNS) & Network Security',
            description: 'HTTP request/response cycles, domain resolution, and TLS handshake cryptography.',
            learningObjective: 'Explain public key cryptography and TLS certificate validation.',
            estimatedDuration: '2 hours',
            practiceTask: 'Inspect HTTP and DNS network packets using a packet analyzer tool.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-7',
        title: isAIInterested
          ? 'Module 7: Elective: Artificial Intelligence & Intelligent Agents'
          : 'Module 7: Elective: Cloud Systems & Distributed Architecture',
        description: isAIInterested
          ? 'Search algorithms (A*, minimax), constraint satisfaction, knowledge representation, and machine learning foundations.'
          : 'Distributed consensus, microservices architecture, fault tolerance, and cloud computing principles.',
        learningObjectives: [
          isAIInterested ? 'Implement heuristic search algorithms for pathfinding' : 'Design horizontally scalable distributed systems',
          isAIInterested ? 'Evaluate agent decisions using adversarial minimax search' : 'Apply fault tolerance patterns like circuit breakers'
        ],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 2 and 5'],
        lessons: [
          {
            id: 'les-cs-7-1',
            title: isAIInterested ? 'Heuristic Search & the A* Algorithm' : 'Distributed System Fundamentals & CAP Theorem',
            description: isAIInterested ? 'Admissible heuristics, priority queues, and optimal path exploration.' : 'Consistency, availability, partition tolerance, and replication.',
            learningObjective: isAIInterested ? 'Implement the A* algorithm to find optimal paths on a weighted grid.' : 'Analyze trade-offs between consistency and availability in distributed storage.',
            estimatedDuration: '2.5 hours',
            practiceTask: isAIInterested ? 'Code an A* pathfinding agent navigating around random obstacles.' : 'Draft a CAP theorem trade-off analysis for a globally distributed database.',
            resources: []
          },
          {
            id: 'les-cs-7-2',
            title: isAIInterested ? 'Adversarial Search & Minimax with Alpha-Beta Pruning' : 'Microservices, Message Queues & Event-Driven Architecture',
            description: isAIInterested ? 'Game trees, utility functions, and search tree pruning.' : 'Asynchronous messaging, pub-sub architectures, and message brokers.',
            learningObjective: isAIInterested ? 'Build an unbeatable game-playing agent using Minimax.' : 'Implement asynchronous inter-service communication using event queues.',
            estimatedDuration: '2.5 hours',
            practiceTask: isAIInterested ? 'Build a Tic-Tac-Toe agent with alpha-beta pruning that never loses.' : 'Build an event-driven order processing pipeline with message queues.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-8',
        title: 'Module 8: Senior Capstone System & Engineering Defense',
        description: 'Design, develop, test, and present a substantial software and systems engineering artifact incorporating multi-threading, databases, and networking.',
        learningObjectives: ['Architect and deliver a full-scale capstone software system', 'Present technical architecture, performance benchmarks, and code quality verification'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Modules 1 through 7'],
        lessons: [
          {
            id: 'les-cs-8-1',
            title: 'Capstone System Architecture & Prototype Milestone',
            description: 'System decomposition, component interface contracts, and core implementation.',
            learningObjective: 'Implement the core architectural components with comprehensive unit tests.',
            estimatedDuration: '3 hours',
            practiceTask: 'Complete the core working prototype of your capstone system with automated tests.',
            resources: []
          },
          {
            id: 'les-cs-8-2',
            title: 'Final System Deployment, Benchmarking & Defense',
            description: 'Load testing, system documentation, live deployment, and formal architectural defense.',
            learningObjective: 'Deploy the completed system and defend design decisions against benchmark data.',
            estimatedDuration: '3.5 hours',
            practiceTask: 'Publish your complete open-source capstone repository with documentation and live demo.',
            resources: []
          }
        ]
      }
    ];
  }

  // Attach discovered verified resources to each lesson
  for (const mod of modules) {
    for (const les of mod.lessons) {
      les.resources = discoverLessonResources(les.title, mod.title, goal);
    }
  }

  return {
    ...basePlan,
    description: `A guided ${goalType} curriculum for ${goal}, structured into progressive modules with hands-on exercises and verified learning resources.`,
    goalType,
    subject: goal,
    targetOutcome: assessment.targetOutcome || `Demonstrated practical and conceptual mastery in ${goal}`,
    estimatedDuration: assessment.estimatedTotalDuration,
    assessment,
    modules,
    source: 'deterministic',
    fallbackUsed: true
  };
}

/**
 * Generates an end-to-end curriculum roadmap for the given goal, skills, and profile.
 * Groq is the sole AI provider: calls Groq with strict JSON output schemas.
 * Falls back safely to deterministic curriculum generation on failure, timeout, or missing key.
 */
export async function generateCurriculum(
  input: CurriculumInput,
  options?: CurriculumOptions
): Promise<Plan> {
  const signal = options?.signal;
  if (signal?.aborted) {
    throw new Error('Curriculum generation aborted');
  }

  options?.onProgress?.({
    message: `Analyzing prerequisites and academic syllabus for ${input.goal}...`,
    percent: 20,
    stage: 'prerequisites'
  });

  const hours = input.profile?.hours ?? 10;

  // Resolve user skills
  const userSkills = Array.from(new Set([
    ...(input.profile?.skills || []),
    ...(input.skills || []),
    ...(input.profile?.extractedSkills ? input.profile.extractedSkills.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : [])
  ]));

  // Resolve goalType: degree | career | specialization | skill
  const goalLower = (input.goal || '').toLowerCase();
  const isDegree = degrees.some(d => d.name.toLowerCase() === goalLower || d.id === input.profile?.goal) ||
    /^BS\s|^Bachelor|^Master|^MS\s|^BE\s/i.test(input.goal);
  const isCareer = input.profile?.journey === 'career' || Boolean(input.profile?.career_goal && input.profile.career_goal.toLowerCase() === goalLower);
  const resolvedGoalType: 'degree' | 'career' | 'specialization' | 'skill' = input.goalType ||
    (isCareer ? 'career' : (input.profile?.specialization ? 'specialization' : (isDegree ? 'degree' : 'skill')));

  // Identify skill gaps
  let targetSkills: string[] = [];
  const matchedDeg = degrees.find(d => d.name.toLowerCase() === goalLower || d.id === input.profile?.goal);
  if (matchedDeg) {
    targetSkills = matchedDeg.skills;
  }
  const identifiedSkillGaps = Array.from(new Set([
    ...(input.missingSkills || []),
    ...targetSkills.filter(s => !userSkills.some(us => us.toLowerCase() === s.toLowerCase()))
  ]));

  const request = options?.request || requestGroq;

  let groqSucceeded = false;
  let groqResult: z.infer<typeof groqCurriculumSchema> | null = null;

  try {
    options?.onProgress?.({
      message: 'Generating personalized curriculum modules and learning objectives with Groq...',
      percent: 45,
      stage: 'modules'
    });

    const isBroadDegree = resolvedGoalType === 'degree' || /^BS\s|^Bachelor|^MS\s|^BE\s/i.test(input.goal);
    const isCareerTarget = resolvedGoalType === 'career';

    const promptContext = {
      target: {
        name: input.goal,
        type: resolvedGoalType,
      },
      learner: {
        knownSkills: userSkills,
        identifiedSkillGaps,
        interests: input.profile?.interests || [],
        specialization: input.profile?.specialization || null,
        academicStage: input.profile?.stage || null,
        qualification: input.profile?.qualification || null,
        backgroundSubjects: input.profile?.subjects || [],
        weeklyStudyHours: hours,
        completedTopics: input.completedTopics || [],
        priorExperience: input.profile?.experience || input.profile?.projects || null
      },
      pedagogicalRequirements: {
        targetBreadth: isBroadDegree
          ? 'Comprehensive academic degree curriculum covering theory, systems, databases, architecture, domain specializations, and capstone.'
          : (isCareerTarget
            ? 'Targeted professional career roadmap emphasizing practical industry tooling, gap remediation, and demonstrable portfolio work.'
            : 'Focused modular learning roadmap.'),
        expectedModuleCount: isBroadDegree ? '6 to 10 substantial progressive modules' : (isCareerTarget ? '4 to 6 modules' : '3 to 5 modules'),
        personalizationDirectives: [
          userSkills.length > 0
            ? `Learner already has competence in: ${userSkills.join(', ')}. DO NOT repeat basic syntax. Advance immediately to higher-level concepts.`
            : 'Learner is at entry level. Establish strong fundamentals.',
          identifiedSkillGaps.length > 0
            ? `Prioritize and allocate dedicated modules for identified gaps: ${identifiedSkillGaps.join(', ')}.`
            : 'Ensure comprehensive coverage of core target competencies.',
          (input.profile?.interests || []).length > 0
            ? `Align domain electives and practical projects with learner interests: ${(input.profile?.interests || []).join(', ')}.`
            : 'Use standard industry-relevant practical projects.'
        ]
      }
    };

    const raw = await request(curriculumPrompt, promptContext);
    const parsed = groqCurriculumSchema.safeParse(raw);
    if (parsed.success) {
      groqResult = parsed.data;
      groqSucceeded = true;
    } else {
      logFallback(new Error('Curriculum output failed schema validation'));
    }
  } catch (err) {
    logFallback(err);
  }

  if (signal?.aborted) {
    throw new Error('Curriculum generation aborted');
  }

  options?.onProgress?.({
    message: 'Curating verified learning resources and exercises...',
    percent: 75,
    stage: 'resources'
  });

  // If Groq succeeded, construct the Plan using Groq's structure + verified resources
  if (groqSucceeded && groqResult) {
    const basePlan = createPlan(input.goal, userSkills, hours);
    const slug = input.goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plan';

    const enrichedModules: CurriculumModule[] = groqResult.modules.map((mod, modIdx) => {
      const moduleId = mod.id || `${slug}-mod-${modIdx + 1}`;
      return {
        id: moduleId,
        title: mod.title,
        description: mod.description,
        learningObjectives: mod.learningObjectives,
        estimatedDuration: mod.estimatedDuration,
        prerequisites: mod.prerequisites || [],
        lessons: mod.lessons.map((les, lesIdx) => {
          const lessonId = les.id || `${moduleId}-les-${lesIdx + 1}`;
          const verifiedResources = discoverLessonResources(les.title, mod.title, groqResult!.subject || input.goal);
          return {
            id: lessonId,
            title: les.title,
            description: les.description,
            learningObjective: les.learningObjective,
            estimatedDuration: les.estimatedDuration,
            resources: verifiedResources,
            practiceTask: les.practiceTask || 'Complete a practical exercise applying these concepts.',
            done: false,
            notes: ''
          };
        })
      };
    });

    options?.onProgress?.({
      message: 'Finalizing your learning roadmap...',
      percent: 95,
      stage: 'finalizing'
    });

    return {
      ...basePlan,
      title: groqResult.title || `Learning Roadmap for ${input.goal}`,
      description: groqResult.description,
      goalType: groqResult.goalType,
      subject: groqResult.subject,
      targetOutcome: groqResult.targetOutcome,
      estimatedDuration: groqResult.estimatedDuration,
      assessment: {
        ...groqResult.assessment,
        providerNotice: 'Personalized by Groq AI (Live Model)'
      },
      modules: enrichedModules,
      source: 'groq',
      fallbackUsed: false
    };
  }

  // Fallback: Generate high quality deterministic curriculum
  const fallbackPlan = generateDeterministicCurriculum(input);

  options?.onProgress?.({
    message: 'Learning plan ready.',
    percent: 100,
    stage: 'complete'
  });

  return fallbackPlan;
}
