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
import { requestQwen, logFallback, type QwenRequest } from './qwen-provider';

export interface CurriculumInput {
  goal: string;
  skills: string[];
  profile?: Profile;
  goalType?: 'degree' | 'specialization' | 'skill';
  completedTopics?: string[];
}

export interface CurriculumOptions {
  signal?: AbortSignal;
  onProgress?: (progress: { message?: string; percent?: number; stage?: string }) => void;
  request?: QwenRequest;
}

// Zod schema for validating Qwen structured output
const qwenCurriculumSchema = z.object({
  title: z.string().min(3).max(250),
  description: z.string().min(10).max(3000),
  goalType: z.enum(['degree', 'specialization', 'skill']).default('skill'),
  subject: z.string().min(2).max(200),
  targetOutcome: z.string().min(5).max(1000),
  estimatedDuration: z.string().min(3).max(100),
  assessment: z.object({
    whatYouWillLearn: z.string().min(10).max(5000),
    whyIncluded: z.string().min(10).max(5000),
    expectedSequence: z.string().min(10).max(5000),
    estimatedTotalDuration: z.string().min(3).max(200),
    majorMilestones: z.array(z.string().min(3).max(500)).min(2).max(15),
    existingKnowledgeAssessed: z.string().max(2000).optional(),
    skillGapsIdentified: z.array(z.string().max(200)).optional(),
  }),
  modules: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(3).max(250),
    description: z.string().min(10).max(2000),
    learningObjectives: z.array(z.string().min(3).max(500)).min(1).max(15),
    estimatedDuration: z.string().min(2).max(100),
    prerequisites: z.array(z.string().max(500)).default([]),
    lessons: z.array(z.object({
      id: z.string().min(1).max(100),
      title: z.string().min(3).max(250),
      description: z.string().min(5).max(2000),
      learningObjective: z.string().min(5).max(1000),
      estimatedDuration: z.string().min(2).max(100),
      practiceTask: z.string().max(2000).optional(),
    })).min(1).max(20)
  })).min(2).max(15)
});

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
  const targetSkill = (query.includes('database') || query.includes('relational')) ? 'sql'
    : (query.includes('pandas') || query.includes('data science') || query.includes('machine learning') || query.includes('data wrangling')) ? 'python'
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

  if (query.includes('calculus') || query.includes('math') || query.includes('algebra')) {
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

  if (query.includes('economics') || query.includes('micro') || query.includes('macro')) {
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
 * Builds a rich, cohesive deterministic curriculum when Qwen is unavailable.
 * Covers foundations, core principles, practical work, and capstone project.
 */
export function generateDeterministicCurriculum(input: CurriculumInput): Plan {
  const goal = input.goal?.trim() || 'Computer Science';
  const hours = input.profile?.hours ?? 10;
  const goalLower = goal.toLowerCase();
  const knownSkills = input.profile?.skills || input.skills || [];
  const goalType = input.goalType || (input.profile?.journey === 'career' ? 'skill' : (input.profile?.specialization ? 'specialization' : 'degree'));

  const basePlan = createPlan(goal, knownSkills, hours);
  const planId = basePlan.id;

  let modules: CurriculumModule[] = [];
  let assessment: LearningAssessment;

  if (goalLower.includes('econ')) {
    // Economics curriculum
    assessment = {
      whatYouWillLearn: 'Microeconomic decision theory, macroeconomic indicators, econometrics, statistical modeling, and international trade dynamics.',
      whyIncluded: `Tailored for ${goal} to balance theoretical rigor with practical empirical analysis demanded by research institutions and economic policy roles.`,
      expectedSequence: 'Begins with individual utility and firm optimization, advances to aggregate economy dynamics, and concludes with empirical econometrics and policy capstone.',
      estimatedTotalDuration: '14 weeks (140 hours)',
      majorMilestones: [
        'Master Microeconomic Optimization',
        'Analyze Macroeconomic Monetary & Fiscal Policy',
        'Empirical Regression Analysis with Econometrics',
        'Economic Research Capstone Paper'
      ],
      existingKnowledgeAssessed: knownSkills.length > 0 ? `Self-reported skills: ${knownSkills.join(', ')}` : 'Entry-level foundation in secondary mathematics and analytical reasoning.',
      skillGapsIdentified: ['Econometric modeling', 'Statistical hypothesis testing', 'Macroeconomic policy analysis'],
      providerNotice: 'Deterministic Academic Syllabus (Deterministic Fallback)'
    };

    modules = [
      {
        id: 'mod-econ-1',
        title: 'Module 1: Foundations of Microeconomics & Consumer Theory',
        description: 'Understand scarcity, choice, supply, demand, elasticity, consumer preferences, and utility maximization.',
        learningObjectives: ['Model consumer equilibrium using budget lines and indifference curves', 'Calculate price and income elasticities of demand'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Basic high school algebra and functions'],
        lessons: [
          {
            id: 'les-econ-1-1',
            title: 'Scarcity, Opportunity Cost, and Comparative Advantage',
            description: 'Core economic tradeoffs and gains from trade.',
            learningObjective: 'Derive production possibilities frontiers and calculate opportunity costs between goods.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Draw a PPF curve from a given production schedule and identify points of efficiency and inefficiency.',
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
          },
          {
            id: 'les-econ-1-3',
            title: 'Consumer Preference and Utility Maximization',
            description: 'Indifference curves and optimal consumption bundles.',
            learningObjective: 'Solve for the optimal bundle of goods subject to a linear budget constraint.',
            estimatedDuration: '2 hours',
            practiceTask: 'Solve a utility maximization problem using marginal utility per rupee equal across goods.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-econ-2',
        title: 'Module 2: Macroeconomic Systems & National Income Accounting',
        description: 'Aggregate economic performance, GDP calculation, inflation metrics, unemployment, and business cycles.',
        learningObjectives: ['Compute real vs nominal GDP', 'Explain the transmission mechanism of monetary policy'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Module 1: Foundations of Microeconomics'],
        lessons: [
          {
            id: 'les-econ-2-1',
            title: 'Measuring National Output: GDP, GNP, and Price Indexes',
            description: 'Expenditure and income approaches to national accounting.',
            learningObjective: 'Calculate GDP deflator, CPI, and analyze real growth rates across periods.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Calculate real GDP growth and inflation rate for a simulated two-year economy.',
            resources: []
          },
          {
            id: 'les-econ-2-2',
            title: 'The IS-LM Framework and Monetary Policy',
            description: 'Goods market and money market equilibrium interactions.',
            learningObjective: 'Graphically analyze the effects of central bank interest rate interventions.',
            estimatedDuration: '2 hours',
            practiceTask: 'Simulate the impact of an expansionary fiscal policy shift on interest rates and investment.',
            resources: []
          },
          {
            id: 'les-econ-2-3',
            title: 'Inflation, Unemployment, and the Phillips Curve',
            description: 'Short-run tradeoffs and long-run vertical neutrality.',
            learningObjective: 'Contrast Keynesian short-run Phillips curve with Friedman-Phelps natural rate hypothesis.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Write a brief analysis of how inflation expectations shift the short-run Phillips curve upward.',
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
          },
          {
            id: 'les-econ-3-3',
            title: 'Hypothesis Testing & Model Specification Tests',
            description: 't-tests, F-tests, heteroskedasticity, and multicollinearity.',
            learningObjective: 'Perform F-tests for joint significance and check for robust standard errors.',
            estimatedDuration: '2 hours',
            practiceTask: 'Perform Breusch-Pagan test for heteroskedasticity in an econometric software package.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-econ-4',
        title: 'Module 4: Empirical Capstone & Policy Paper',
        description: 'Synthesize micro, macro, and econometric tools to produce a data-driven policy investigation.',
        learningObjectives: ['Formulate an empirical research question', 'Draft an academic-grade policy brief with data charts'],
        estimatedDuration: '4 weeks (40 hours)',
        prerequisites: ['Modules 1, 2, and 3'],
        lessons: [
          {
            id: 'les-econ-4-1',
            title: 'Research Question Formulation & Literature Framing',
            description: 'Identifying verifiable hypotheses in public economic data.',
            learningObjective: 'Develop an empirical research proposal investigating an economic policy intervention.',
            estimatedDuration: '2 hours',
            practiceTask: 'Write a 1-page research proposal citing 3 peer-reviewed economic studies.',
            resources: []
          },
          {
            id: 'les-econ-4-2',
            title: 'Empirical Data Cleaning and Descriptive Analysis',
            description: 'Managing economic datasets (e.g., State Bank of Pakistan or World Bank indicators).',
            learningObjective: 'Clean raw macro indicators, handle missing values, and construct summary statistical tables.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Produce a standardized descriptive statistics table and correlation matrix in Python/Excel.',
            resources: []
          },
          {
            id: 'les-econ-4-3',
            title: 'Final Policy Paper Defense & Executive Summary',
            description: 'Communicating econometric findings to policy makers and stakeholders.',
            learningObjective: 'Present regression findings with policy recommendations and limitations.',
            estimatedDuration: '3 hours',
            practiceTask: 'Draft a 1,500-word policy brief summarizing findings and presenting actionable recommendations.',
            resources: []
          }
        ]
      }
    ];
  } else {
    // Computer Science / Software Engineering / General Technical Curriculum
    assessment = {
      whatYouWillLearn: 'Algorithmic problem solving, data structures, full-stack architecture, relational database modeling, and production deployment.',
      whyIncluded: `Structured for ${goal} to bridge academic computer science principles with modern industry software engineering standards.`,
      expectedSequence: 'Starts with foundational computational logic and data structures, moves into applied tooling and systems, and culminates in a production capstone.',
      estimatedTotalDuration: '16 weeks (160 hours)',
      majorMilestones: [
        'Algorithmic Complexity & Core Data Structures',
        'Database Modeling & Relational Systems',
        'Modern API & Application Architecture',
        'Production Capstone Deployment'
      ],
      existingKnowledgeAssessed: knownSkills.length > 0 ? `Self-reported skills: ${knownSkills.join(', ')}` : 'Entry-level analytical capability and basic programming literacy.',
      skillGapsIdentified: ['System design & architecture', 'Database indexing & query optimization', 'Automated testing & CI/CD'],
      providerNotice: 'Deterministic Computer Science Syllabus (Deterministic Fallback)'
    };

    modules = [
      {
        id: 'mod-cs-1',
        title: 'Module 1: Foundations of Computational Logic & Data Structures',
        description: 'Algorithmic thinking, Big-O complexity analysis, arrays, linked lists, stacks, and queues.',
        learningObjectives: ['Analyze time and space complexity of algorithms', 'Implement and compare linear data structures'],
        estimatedDuration: '3 weeks (30 hours)',
        prerequisites: ['Basic programming syntax in Python, TypeScript, or C++'],
        lessons: [
          {
            id: 'les-cs-1-1',
            title: 'Asymptotic Analysis & Big-O Notation',
            description: 'Measuring algorithm performance independently of hardware.',
            learningObjective: 'Determine tight asymptotic bounds (O, Ω, Θ) for iterative and recursive loops.',
            estimatedDuration: '1.5 hours',
            practiceTask: 'Calculate the exact Big-O time and space complexity for three provided sorting algorithms.',
            resources: []
          },
          {
            id: 'les-cs-1-2',
            title: 'Arrays, Strings, and Memory Layout',
            description: 'Contiguous memory allocation, two-pointer techniques, and sliding window patterns.',
            learningObjective: 'Implement memory-efficient array transformations and solve sliding window problems.',
            estimatedDuration: '2 hours',
            practiceTask: 'Write a function implementing the sliding window pattern to find the maximum sum subarray of size k.',
            resources: []
          },
          {
            id: 'les-cs-1-3',
            title: 'Linked Lists, Stacks, and Queues',
            description: 'Node-based structures, pointer manipulation, and LIFO/FIFO mechanics.',
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
        description: 'Binary search trees, balanced trees, hash tables, and depth/breadth first graph traversals.',
        learningObjectives: ['Implement tree traversals (pre, in, post order)', 'Solve shortest-path graph problems using BFS and Dijkstra'],
        estimatedDuration: '4 weeks (40 hours)',
        prerequisites: ['Module 1: Foundations of Computational Logic'],
        lessons: [
          {
            id: 'les-cs-2-1',
            title: 'Hash Tables, Collision Resolution, and Hash Functions',
            description: 'Hash sets, hash maps, open addressing, and separate chaining.',
            learningObjective: 'Explain constant-time average lookups and resolve hash collisions.',
            estimatedDuration: '2 hours',
            practiceTask: 'Implement a custom hash map with linear probing collision resolution in code.',
            resources: []
          },
          {
            id: 'les-cs-2-2',
            title: 'Binary Search Trees & Heap Priority Queues',
            description: 'Hierarchical data, search invariant, and min/max heap operations.',
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
        title: 'Module 3: Database Engineering & Data Modeling',
        description: 'Relational data modeling, SQL queries, indexing, normalization, and ACID transaction semantics.',
        learningObjectives: ['Design third normal form relational schemas', 'Write optimized SQL queries with multiple joins and indexes'],
        estimatedDuration: '4 weeks (40 hours)',
        prerequisites: ['Module 1: Foundations of Computational Logic'],
        lessons: [
          {
            id: 'les-cs-3-1',
            title: 'Relational Data Modeling & Normalization (1NF to 3NF)',
            description: 'Entities, attributes, primary/foreign keys, and eliminating update anomalies.',
            learningObjective: 'Normalize an unnormalized transaction ledger into third normal form.',
            estimatedDuration: '2 hours',
            practiceTask: 'Create an entity relationship diagram (ERD) with primary and foreign key constraints for an e-commerce platform.',
            resources: []
          },
          {
            id: 'les-cs-3-2',
            title: 'Advanced SQL: Aggregations, Joins, and Subqueries',
            description: 'INNER/LEFT/FULL joins, GROUP BY, HAVING, and window functions.',
            learningObjective: 'Formulate analytical SQL queries using window functions and conditional aggregations.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Write a SQL query that ranks student performance per department using ROW_NUMBER() and DENSE_RANK().',
            resources: []
          },
          {
            id: 'les-cs-3-3',
            title: 'Indexing Strategies, Query Execution Plans, and Transactions',
            description: 'B-tree indexes, table scans, EXPLAIN queries, and ACID isolation levels.',
            learningObjective: 'Identify indexing bottlenecks using query execution plans and explain serializable isolation.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Analyze an EXPLAIN plan for an unindexed join and show the performance improvement after adding a composite index.',
            resources: []
          }
        ]
      },
      {
        id: 'mod-cs-4',
        title: 'Module 4: Full-Stack Architecture, APIs & Cloud Deployment',
        description: 'RESTful API contracts, serverless/cloud architecture, authentication, and continuous integration.',
        learningObjectives: ['Design and build secure REST endpoints', 'Deploy a production web application with CI/CD'],
        estimatedDuration: '5 weeks (50 hours)',
        prerequisites: ['Modules 1, 2, and 3'],
        lessons: [
          {
            id: 'les-cs-4-1',
            title: 'REST API Design, Middleware, and Request Validation',
            description: 'HTTP status codes, structured JSON payloads, and validation schemas.',
            learningObjective: 'Build type-safe endpoints with schema validation and error-handling middleware.',
            estimatedDuration: '2.5 hours',
            practiceTask: 'Create a CRUD API router with Zod validation and structured HTTP 400/404/500 responses.',
            resources: []
          },
          {
            id: 'les-cs-4-2',
            title: 'Authentication, Authorization, and Session Security',
            description: 'JWT tokens, HTTP-only cookies, password hashing (bcrypt), and CSRF protection.',
            learningObjective: 'Implement secure user authentication using hashed credentials and signed tokens.',
            estimatedDuration: '3 hours',
            practiceTask: 'Implement authentication middleware verifying signed JWTs and protecting private endpoints.',
            resources: []
          },
          {
            id: 'les-cs-4-3',
            title: 'Capstone System Deployment & Automated CI/CD Pipeline',
            description: 'Containerization, environment configuration, automated tests, and cloud hosting.',
            learningObjective: 'Configure a continuous integration workflow that lints, tests, and deploys code.',
            estimatedDuration: '3.5 hours',
            practiceTask: 'Deploy an end-to-end full-stack application to a cloud host with an active GitHub Actions CI pipeline.',
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
 * When Qwen credentials are present, calls Qwen to structure modules and lessons.
 * Falls back safely to deterministic curriculum generation on failure or missing credentials.
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
  const goalType = input.goalType || (input.profile?.journey === 'career' ? 'skill' : (input.profile?.specialization ? 'specialization' : 'degree'));
  const request = options?.request || requestQwen;

  // Check if Qwen should be attempted
  let qwenSucceeded = false;
  let qwenResult: z.infer<typeof qwenCurriculumSchema> | null = null;

  try {
    options?.onProgress?.({
      message: 'Generating personalized curriculum modules and learning objectives...',
      percent: 45,
      stage: 'modules'
    });

    const promptContext = {
      goal: input.goal,
      goalType,
      weeklyHours: hours,
      skills: input.skills.slice(0, 8),
      completedTopics: input.completedTopics || [],
      profile: input.profile ? {
        stage: input.profile.stage,
        qualification: input.profile.qualification,
        subjects: input.profile.subjects,
        interests: input.profile.interests,
        journey: input.profile.journey,
        specialization: input.profile.specialization,
        career_goal: input.profile.career_goal
      } : null
    };

    const raw = await request(curriculumPrompt, promptContext);
    const parsed = qwenCurriculumSchema.safeParse(raw);
    if (parsed.success) {
      qwenResult = parsed.data;
      qwenSucceeded = true;
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

  // If Qwen succeeded, construct the Plan using Qwen's structure + verified resources
  if (qwenSucceeded && qwenResult) {
    const basePlan = createPlan(input.goal, input.skills, hours);
    const enrichedModules: CurriculumModule[] = qwenResult.modules.map((mod, modIdx) => {
      const moduleId = mod.id || `mod-${modIdx + 1}`;
      return {
        id: moduleId,
        title: mod.title,
        description: mod.description,
        learningObjectives: mod.learningObjectives,
        estimatedDuration: mod.estimatedDuration,
        prerequisites: mod.prerequisites || [],
        lessons: mod.lessons.map((les, lesIdx) => {
          const lessonId = les.id || `${moduleId}-les-${lesIdx + 1}`;
          const verifiedResources = discoverLessonResources(les.title, mod.title, qwenResult!.subject || input.goal);
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
      title: qwenResult.title || `Learning Roadmap for ${input.goal}`,
      description: qwenResult.description,
      goalType: qwenResult.goalType,
      subject: qwenResult.subject,
      targetOutcome: qwenResult.targetOutcome,
      estimatedDuration: qwenResult.estimatedDuration,
      assessment: {
        ...qwenResult.assessment,
        providerNotice: 'Personalized by Alibaba Cloud Qwen (Live Model)'
      },
      modules: enrichedModules,
      source: 'qwen',
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
