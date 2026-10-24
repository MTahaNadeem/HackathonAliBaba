/* ════════════════════════════════════════════════════
   popup.js – CourseAI Compass
   All popup logic: navigation, analysis, skill matching,
   selectable skill roadmap, auth/profile sync, saved jobs.
════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════
   CONFIGURATION
══════════════════════════════════════════════════ */

/**
 * URL pointing to the CourseCompass web app.
 * Only an account-owned analysis ID is passed to the website.
 */
const COMPASS_WEB_APP_URL = 'https://coursecompassai.vercel.app/';
async function accountMessage(message){const response=await chrome.runtime.sendMessage(message);if(!response?.ok){if(response?.status===401){userSession=null;userProfileData=null;currentAnalysis=null;savedJobsList.innerHTML='';setState('initial');renderAuthState();}throw new Error(response?.error||'Account service unavailable.');}return response.data;}
const accountApi=(path,method='GET',body)=>accountMessage({action:'api',path,method,body});

/* ══════════════════════════════════════════════════
   SKILL DICTIONARY
   Comprehensive catalog of software / tech / AI skills.
══════════════════════════════════════════════════ */
const SKILL_DICTIONARY = [
  // Web frontend
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue.js', 'Angular',
  'HTML', 'CSS', 'Tailwind CSS', 'SASS', 'SCSS', 'Svelte',
  'Redux', 'Zustand', 'Webpack', 'Vite',
  // Backend
  'Node.js', 'Express', 'FastAPI', 'Flask', 'Django', 'Spring Boot',
  'REST APIs', 'GraphQL', 'gRPC', 'WebSockets',
  // Languages
  'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift',
  'PHP', 'Ruby', 'Scala', 'R',
  // Databases
  'SQL', 'PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis',
  'Supabase', 'Firebase', 'DynamoDB', 'Elasticsearch',
  // DevOps / Cloud
  'Git', 'GitHub', 'GitLab', 'Docker', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'Vercel', 'Netlify', 'Heroku',
  'CI/CD', 'Jenkins', 'GitHub Actions', 'Linux', 'Bash',
  'Terraform', 'Ansible',
  // AI / ML
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch',
  'Scikit-learn', 'Pandas', 'NumPy', 'Matplotlib', 'Jupyter',
  'LLMs', 'RAG', 'LangChain', 'OpenAI API', 'Hugging Face',
  'Computer Vision', 'NLP', 'Data Science', 'Data Analysis',
  // Testing / Quality
  'Jest', 'Pytest', 'Selenium', 'Cypress', 'Unit Testing',
  // Architecture & Engineering Practices
  'Figma', 'Agile', 'Scrum', 'Jira', 'Microservices',
  'Object-Oriented Programming', 'OOP', 'Design Patterns', 'Algorithms',
];

/* Default student profile — stored in chrome.storage.local */
const DEFAULT_STUDENT_SKILLS = [];

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let currentAnalysis = null;           // Holds the last analysis result
let userSession = null;               // Holds logged-in user session { access_token, email, userId }
let userProfileData = null;           // Holds profile data from server { email, profile, plan, skills, learnedSkills, inProgressSkills }
const selectedSkillsToLearn = new Set(); // Skills selected by user to include in their generated learning plan

/* ══════════════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

// Navigation
const navAnalyze  = $('navAnalyze');
const navSaved    = $('navSaved');
const navProfile  = $('navProfile');

// Views
const viewAnalyze = $('viewAnalyze');
const viewSaved   = $('viewSaved');
const viewProfile = $('viewProfile');

// Context card
const contextSkeleton  = $('contextSkeleton');
const contextInfo      = $('contextInfo');
const pageTitle        = $('pageTitle');
const detectedCompany  = $('detectedCompany');
const detectedJobTitle = $('detectedJobTitle');
const rowCompany       = $('rowCompany');
const rowJobTitle      = $('rowJobTitle');

// States
const initialState = $('initialState');
const loadingState = $('loadingState');
const errorState   = $('errorState');
const resultsState = $('resultsState');

// Buttons & Actions
const btnAnalyze   = $('btnAnalyze');
const btnRetry     = $('btnRetry');
const btnReAnalyze = $('btnReAnalyze');
const btnBuildPlan = $('btnBuildPlan');
const btnSaveJob   = $('btnSaveJob');

// Results elements
const ringFill             = $('ringFill');
const scoreNumber          = $('scoreNumber');
const scoreCategory        = $('scoreCategory');
const statTotal            = $('statTotal');
const statMatched          = $('statMatched');
const statMissing          = $('statMissing');
const chipsHave            = $('chipsHave');
const chipsLearn           = $('chipsLearn');
const sectionHave          = $('sectionHave');
const sectionHaveTitle     = $('sectionHaveTitle');
const sectionLearn         = $('sectionLearn');
const nextActionText       = $('nextActionText');
const nextActionCard       = $('nextActionCard');
const errorTitle           = $('errorTitle');
const errorMsg             = $('errorMsg');
const profileContextBanner = $('profileContextBanner');
const profileContextText   = $('profileContextText');

// Interactive selection toolbar & inputs
const btnSelectAllSkills   = $('btnSelectAllSkills');
const btnClearAllSkills    = $('btnClearAllSkills');
const inputCustomSkill     = $('inputCustomSkill');
const btnAddCustomSkill    = $('btnAddCustomSkill');

// Saved jobs
const savedJobsList = $('savedJobsList');
const savedEmpty    = $('savedEmpty');

// Profile & Skills Management
const profileSkillChips = $('profileSkillChips');
const newSkillInput     = $('newSkillInput');
const btnAddSkill       = $('btnAddSkill');
const btnSaveSkills     = $('btnSaveSkills');
const saveConfirmation  = $('saveConfirmation');
const btnSyncSkills     = $('btnSyncSkills');
const syncConfirmation  = $('syncConfirmation');

// Login / Auth elements
const loginSection    = $('loginSection');
const loggedInSection = $('loggedInSection');
const loginEmail      = $('loginEmail');
const loginPassword   = $('loginPassword');
const btnLogin        = $('btnLogin');
const loginError      = $('loginError');
const userAvatar      = $('userAvatar');
const userEmail       = $('userEmail');
const btnLogout       = $('btnLogout');

// Profile progress elements
const planProgressSection     = $('planProgressSection');
const planTitle               = $('planTitle');
const planProgressBar         = $('planProgressBar');
const planProgressLabel       = $('planProgressLabel');
const learnedSkillsSection    = $('learnedSkillsSection');
const learnedSkillChips       = $('learnedSkillChips');
const inProgressSkillsSection = $('inProgressSkillsSection');
const inProgressSkillChips    = $('inProgressSkillChips');

/* ══════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════ */
function setView(viewEl, btnEl) {
  [viewAnalyze, viewSaved, viewProfile].forEach(v => v.classList.remove('active'));
  [navAnalyze, navSaved, navProfile].forEach(b => b.classList.remove('active'));
  viewEl.classList.add('active');
  btnEl.classList.add('active');
}

navAnalyze.addEventListener('click', () => setView(viewAnalyze, navAnalyze));
navSaved.addEventListener('click', () => {
  setView(viewSaved, navSaved);
  renderSavedJobs().catch(error=>showSyncMessage(error.message));
});
navProfile.addEventListener('click', () => {
  setView(viewProfile, navProfile);
  void renderProfileSkills().catch(error=>showSyncMessage(error.message));
  renderAuthState();
});

/* ══════════════════════════════════════════════════
   INITIALIZE POPUP
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentTabContext();
  await ensureDefaultSkills();
  await restoreSession();
  try {
    await syncSkillsFromCourseCompass();
  } catch {}
});

/** Load the current tab metadata and show in context card */
async function loadCurrentTabContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showContextFallback(); return; }

    const url = tab.url || '';

    // Internal browser pages cannot be scripted
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:')) {
      showContextFallback('Browser internal page');
      return;
    }

    contextSkeleton.style.display = 'none';
    contextInfo.style.display = 'block';
    pageTitle.textContent = truncate(tab.title || url, 60);

  } catch {
    showContextFallback();
  }
}

function showContextFallback(msg) {
  contextSkeleton.style.display = 'none';
  contextInfo.style.display = 'block';
  pageTitle.textContent = msg || 'Open a job listing to begin';
}

/* ══════════════════════════════════════════════════
   AUTH / LOGIN FLOW
══════════════════════════════════════════════════ */

/** Restore session from chrome.storage on popup open */
async function restoreSession(){try{userSession=await accountMessage({action:'session'});if(userSession)await fetchProfileFromServer();}catch(e){showLoginError(e.message);}renderAuthState();}

/** Render auth UI state based on whether user is logged in */
function renderAuthState() {
  if (userSession) {
    loginSection.style.display = 'none';
    loggedInSection.style.display = 'block';
    userEmail.textContent = userSession.email || 'Signed in';
    userAvatar.textContent = (userSession.email || 'U')[0].toUpperCase();
    renderProfileProgress();
  } else {
    loginSection.style.display = 'block';
    loggedInSection.style.display = 'none';
    planProgressSection.style.display = 'none';
    learnedSkillsSection.style.display = 'none';
    inProgressSkillsSection.style.display = 'none';
  }
}

/** Handle login button click */
if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) {
      showLoginError('Please enter email and password.');
      return;
    }
    btnLogin.disabled = true;
    btnLogin.textContent = 'Signing in…';
    loginError.style.display = 'none';

    try {
      userSession=await accountMessage({action:'login',email,password});
      loginPassword.value='';
      currentAnalysis=null;userProfileData=null;savedJobsList.innerHTML='';setState('initial');
      await fetchProfileFromServer();
      renderAuthState();
      void renderProfileSkills().catch(error=>showSyncMessage(error.message));

    } catch (e) {
      showLoginError(e.message || 'Could not sign in. Check credentials.');
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Sign In
      `;
    }
  });
}

/** Allow pressing Enter in password field to submit */
if (loginPassword) {
  loginPassword.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnLogin.click();
  });
}

/** Handle logout */
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    try{await accountMessage({action:'logout'});}catch(e){showSyncMessage(e.message);return;}
    userSession=null;userProfileData=null;currentAnalysis=null;savedJobsList.innerHTML='';setState('initial');
    renderAuthState();
    void renderProfileSkills().catch(error=>showSyncMessage(error.message));
  });
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
}

/** Fetch user profile + plan from the CourseCompass API */
async function fetchProfileFromServer(){if(!userSession)return;userProfileData=await accountApi('/api/extension/profile');}

/** Render plan progress + what the user has done till now */
function renderProfileProgress() {
  if (!userProfileData) {planProgressSection.style.display='none';learnedSkillsSection.style.display='none';inProgressSkillsSection.style.display='none';return;}

  // Plan progress card
  if (userProfileData.plan) {
    const p = userProfileData.plan;
    planProgressSection.style.display = 'block';
    planTitle.textContent = p.title || 'Your Learning Plan';
    const pct = p.totalMilestones > 0 ? Math.round((p.completedMilestones / p.totalMilestones) * 100) : 0;
    planProgressBar.style.width = `${pct}%`;
    planProgressLabel.textContent = `${p.completedMilestones} / ${p.totalMilestones} stages completed (${pct}%)`;
  } else {
    planProgressSection.style.display = 'none';
  }

  // Learned skills ("What you have done till now")
  if (userProfileData.learnedSkills && userProfileData.learnedSkills.length > 0) {
    learnedSkillsSection.style.display = 'block';
    learnedSkillChips.innerHTML = '';
    userProfileData.learnedSkills.forEach(skill => {
      learnedSkillChips.appendChild(createChip(skill, 'have', '✓'));
    });
  } else {
    learnedSkillsSection.style.display = 'none';
  }

  // In progress skills
  if (userProfileData.inProgressSkills && userProfileData.inProgressSkills.length > 0) {
    inProgressSkillsSection.style.display = 'block';
    inProgressSkillChips.innerHTML = '';
    userProfileData.inProgressSkills.forEach(skill => {
      inProgressSkillChips.appendChild(createChip(skill, 'learn', '◉'));
    });
  } else {
    inProgressSkillsSection.style.display = 'none';
  }
}

/* ══════════════════════════════════════════════════
   ANALYSIS FLOW
══════════════════════════════════════════════════ */
btnAnalyze.addEventListener('click', runAnalysis);
btnRetry.addEventListener('click', () => {
  setState('initial');
  void runAnalysis();
});
btnReAnalyze.addEventListener('click', () => {
  setState('initial');
  void runAnalysis();
});

async function runAnalysis() {
  setState('loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    const url = tab.url || '';
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:')) {
      throw new Error('CourseAI Compass cannot run on browser internal pages. Navigate to any job listing and try again.');
    }

    // Attempt sending message to content script
    let data;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DATA' });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Empty response from page content script');
      }
      data = response.data;
    } catch {
      // If content script was not already present, inject it on the fly
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files:  ['content.js'],
      });
      await new Promise(r => setTimeout(r, 200));

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DATA' });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Could not read page content.');
      }
      data = response.data;
    }

    // Refresh user profile before analysis if logged in
    if (userSession) {
      await fetchProfileFromServer();
    }

    // Perform skill matching
    const analysis = await analyzeSkills(data);
    currentAnalysis = { ...analysis, ...data };

    // Update context card with detected job details
    updateContextCard(data);

    // Render results
    await renderResults(analysis, data);
    setState('results');

  } catch {
    showError(
      'Could not analyze this page',
      err.message || 'Make sure you are on a readable web page with text content.'
    );
  }
}

function updateContextCard(data) {
  if (data.company) {
    rowCompany.style.display    = 'flex';
    detectedCompany.textContent = truncate(data.company, 30);
  }
  if (data.jobTitle) {
    rowJobTitle.style.display    = 'flex';
    detectedJobTitle.textContent = truncate(data.jobTitle, 35);
  }
  if (data.title) {
    pageTitle.textContent = truncate(data.title, 60);
  }
}

/* ══════════════════════════════════════════════════
   SKILL EXTRACTION & STRICT MATCHING
══════════════════════════════════════════════════ */

// Strict matching rules to eliminate false positives like 'R', 'Go', etc.
const SKILL_MATCHERS = {
  // R programming language: STRICT matching.
  // NEVER match lowercase 'r', never match (R), (r), ®, R&D, R&R, Roles & Responsibilities, or single letter bullet 'r.'
  'R': (text) => {
    // 1. Explicit R programming / language references
    if (/\b(?:R\s+(?:programming|language|script|package|packages|code|studio)|(?:programming|language)\s+in\s+R|RStudio|CRAN|ggplot2|tidyverse|dplyr)\b/i.test(text)) {
      return true;
    }
    // 2. Listed directly with other data / programming languages (e.g. "Python, R, SQL" or "Python / R" or "R, Python")
    if (/\b(?:Python|SQL|Julia|SAS|SPSS|MATLAB|Scala)[,\s/]+R\b|\bR[,\s/]+(?:Python|SQL|Julia|SAS|SPSS|MATLAB|Scala)\b/.test(text)) {
      return true;
    }
    return false;
  },

  // Go (Golang): NEVER match common English verb 'go'
  'Go': (text) => {
    if (/\b(?:Golang|Go\s+(?:language|programming|developer|engineer|backend|code))\b/i.test(text)) {
      return true;
    }
    if (/\b(?:Docker|Kubernetes|Python|Rust|Java|C\+\+)[,\s/]+Go\b|\bGo[,\s/]+(?:Docker|Kubernetes|Python|Rust|Java|C\+\+)\b/.test(text)) {
      return true;
    }
    return false;
  },

  // React & synonyms
  'React': (text) => /\b(?:React(?:\.js|js)?)\b/i.test(text),

  // Node.js & synonyms
  'Node.js': (text) => /\b(?:Node(?:\.js|js)?)\b/i.test(text),

  // Next.js & synonyms
  'Next.js': (text) => /\b(?:Next(?:\.js|js)?)\b/i.test(text),

  // Vue.js & synonyms
  'Vue.js': (text) => /\b(?:Vue(?:\.js|js)?)\b/i.test(text),

  // Tailwind CSS
  'Tailwind CSS': (text) => /\b(?:Tailwind(?:\s*CSS)?)\b/i.test(text),

  // Kubernetes
  'Kubernetes': (text) => /\b(?:Kubernetes|K8s)\b/i.test(text),

  // PostgreSQL
  'PostgreSQL': (text) => /\b(?:PostgreSQL|Postgres)\b/i.test(text),

  // REST APIs
  'REST APIs': (text) => /\b(?:REST(?:\s*APIs?|ful\s*APIs?|ful)?)\b/i.test(text),

  // CI/CD
  'CI/CD': (text) => /\b(?:CI\s*\/\s*CD|CICD)\b/i.test(text),

  // C#
  'C#': (text) => /(?:^|[^a-zA-Z0-9])C#(?=$|[^a-zA-Z0-9])|\bC-Sharp\b/i.test(text),

  // C++
  'C++': (text) => /(?:^|[^a-zA-Z0-9])C\+\+(?=$|[^a-zA-Z0-9])/i.test(text),
};

function extractSkillsFromText(text) {
  if (!text) return [];
  const found = new Set();

  for (const skill of SKILL_DICTIONARY) {
    const customMatcher = SKILL_MATCHERS[skill];
    if (customMatcher) {
      if (customMatcher(text)) {
        found.add(skill);
      }
      continue;
    }

    // Default alphanumeric skill matching with word boundaries
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp('(?:^|[^a-zA-Z0-9])' + escaped + '(?=[^a-zA-Z0-9]|$)', 'i');
    if (pattern.test(text)) {
      found.add(skill);
    }
  }

  return [...found];
}

/**
 * Compare detected job skills with the student's stored skills + profile data.
 * Checks what the user has done till now vs what they need for this job.
 */
async function analyzeSkills(data) {
  if(userSession)return accountApi('/api/extension/analyses','POST',{bodyText:data.bodyText,jobTitle:data.jobTitle||data.title||'Target role',company:data.company||'',url:data.url||''});
  const detectedSkills = extractSkillsFromText((data.bodyText || '') + ' ' + (data.title || ''));
  const studentSkills  = await getStudentSkills();

  // Aggregate everything the user has done till now
  const allUserDoneSkills = [...studentSkills];
  const serverLearnedSkills = [];

  if (userProfileData) {
    if (Array.isArray(userProfileData.skills)) allUserDoneSkills.push(...userProfileData.skills);
    if (Array.isArray(userProfileData.learnedSkills)) {
      allUserDoneSkills.push(...userProfileData.learnedSkills);
      serverLearnedSkills.push(...userProfileData.learnedSkills);
    }

  }

  const doneLower = [...new Set(allUserDoneSkills)].map(s => s.toLowerCase());
  const matchedSkills = detectedSkills.filter(s => doneLower.includes(s.toLowerCase()));
  const missingSkills = detectedSkills.filter(s => !doneLower.includes(s.toLowerCase()));

  const matchPercent = detectedSkills.length > 0
    ? Math.round((matchedSkills.length / detectedSkills.length) * 100)
    : null;

  return {
    detectedSkills,
    matchedSkills,
    missingSkills,
    matchPercent,
    serverLearnedSkills,
  };
}

/* ══════════════════════════════════════════════════
   RENDER RESULTS & INTERACTIVE SKILL SELECTION
══════════════════════════════════════════════════ */
async function renderResults(analysis, data) {
  const { detectedSkills, matchedSkills, missingSkills, matchPercent } = analysis;

  // ── Score ring ──────────────────────────────────
  const CIRCUMFERENCE = 263.9; // 2π × r (r = 42)
  const pct = matchPercent ?? 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  requestAnimationFrame(() => {
    ringFill.style.strokeDashoffset = offset;
    ringFill.classList.remove('strong', 'good', 'some', 'low');
    if (pct >= 80)      ringFill.classList.add('strong');
    else if (pct >= 60) ringFill.classList.add('good');
    else if (pct >= 40) ringFill.classList.add('some');
    else                ringFill.classList.add('low');
  });

  scoreNumber.textContent = matchPercent===null?'—':`${pct}%`;
  document.querySelector('.score-disclaimer').textContent=analysis.method ? `${analysis.method}${analysis.formal?.length ? ' Criteria to review: '+analysis.formal.join('; ') : ''}` : 'Guest skill coverage only. Experience and qualifications require separate review.';
  document.querySelector('.score-label').textContent='Skill fit';

  // ── Category label ──────────────────────────────
  let category, categoryColor;
  if (pct >= 80)      { category = 'Strong alignment';           categoryColor = '#22c55e'; }
  else if (pct >= 60) { category = 'Good foundation';            categoryColor = '#3b82f6'; }
  else if (pct >= 40) { category = 'Some skill gaps';            categoryColor = '#f59e0b'; }
  else                { category = 'Significant learning needed'; categoryColor = '#ef4444'; }

  scoreCategory.textContent = matchPercent===null?'No technical requirements detected':category;
  scoreCategory.style.color = categoryColor;

  // ── Stats ───────────────────────────────────────
  statTotal.textContent   = detectedSkills.length;
  statMatched.textContent = matchedSkills.length;
  statMissing.textContent = missingSkills.length;

  // ── Profile context banner ──────────────────────
  if (userSession && userSession.email) {
    profileContextBanner.style.display = 'flex';
    const doneCount = (userProfileData?.learnedSkills?.length || 0) + (userProfileData?.skills?.length || 0);
    profileContextText.innerHTML = `Connected as <strong>${escapeHtml(userSession.email)}</strong> · Analyzed against your completed milestones &amp; profile (${doneCount} skills)`;
  } else {
    profileContextBanner.style.display = 'none';
  }

  // ── What you have done till now (Matched) ────────
  chipsHave.innerHTML = '';
  if (matchedSkills.length > 0) {
    sectionHave.style.display = 'block';
    sectionHaveTitle.textContent = `Matched skill evidence (${matchedSkills.length})`;
    matchedSkills.forEach(skill => {
      const isDemonstrated = userProfileData?.learnedSkills?.some(s => s.toLowerCase() === skill.toLowerCase());
      const prefix = isDemonstrated ? '✓ [Completion reported]' : '✓ [Self-reported]';
      const chip = createChip(skill, 'have', prefix);
      chip.title = 'You already have this skill. Click to add to target plan if you want to brush up.';
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        addSkillToSelectedPlan(skill);
      });
      chipsHave.appendChild(chip);
    });
  } else {
    sectionHave.style.display = 'none';
  }

  // ── Skills needed for this role (Interactive Selection) ──
  // Initialize selection with the missing skills for this job
  selectedSkillsToLearn.clear();
  if (missingSkills.length > 0) {
    missingSkills.forEach(s => selectedSkillsToLearn.add(s));
  } else if (detectedSkills.length > 0) {
    // If no gaps detected, pre-select up to 3 detected skills for review
    detectedSkills.slice(0, 3).forEach(s => selectedSkillsToLearn.add(s));
  }

  renderSelectableSkillChips(missingSkills, detectedSkills);

  // ── Save job button dataset ─────────────────────
  btnBuildPlan.dataset.jobTitle = (data && (data.jobTitle || data.title)) || (currentAnalysis && (currentAnalysis.jobTitle || currentAnalysis.title)) || '';
  btnBuildPlan.dataset.company  = (data && data.company) || (currentAnalysis && currentAnalysis.company) || '';

  nextActionCard.style.display = 'block';
  updateBuildPlanUI();
}

/** Render selectable chips in the "Skills needed" section */
function renderSelectableSkillChips(missingSkills, detectedSkills) {
  chipsLearn.innerHTML = '';

  const displaySkills = missingSkills.length > 0 ? missingSkills : detectedSkills;

  if (displaySkills.length === 0) {
    sectionLearn.style.display = 'block';
    const emptyNotice = document.createElement('p');
    emptyNotice.style.fontSize = '12px';
    emptyNotice.style.color = '#64748b';
    emptyNotice.style.margin = '4px 0 8px';
    emptyNotice.textContent = 'No specific technology skills detected automatically. You can add skills manually below:';
    chipsLearn.appendChild(emptyNotice);
    return;
  }

  sectionLearn.style.display = 'block';

  displaySkills.forEach(skill => {
    const isSelected = selectedSkillsToLearn.has(skill);
    const chip = document.createElement('span');
    chip.className = `chip-selectable ${isSelected ? 'selected' : 'unselected'}`;
    chip.dataset.skill = skill;
    const evidence=currentAnalysis?.requirements?.find(requirement=>requirement.skill===skill);
    chip.innerHTML = `${isSelected ? '✓' : '+'} ${escapeHtml(skill)}`;
    chip.title=evidence ? `${evidence.optional?'Preferred':'Required'}: ${evidence.status}. ${evidence.evidence}` : skill;
    if(evidence?.status==='CV-inferred; confirm')chip.appendChild(document.createTextNode(' (CV-inferred; confirm)'));

    chip.addEventListener('click', () => {
      toggleSkillSelection(skill, chip);
    });

    chipsLearn.appendChild(chip);
  });
}

/** Toggle selection of a skill for the learning plan */
function toggleSkillSelection(skill, chipEl) {
  if (selectedSkillsToLearn.has(skill)) {
    selectedSkillsToLearn.delete(skill);
    chipEl.className = 'chip-selectable unselected';
    chipEl.innerHTML = `+ ${escapeHtml(skill)}`;
  } else {
    selectedSkillsToLearn.add(skill);
    chipEl.className = 'chip-selectable selected';
    chipEl.innerHTML = `✓ ${escapeHtml(skill)}`;
  }
  updateBuildPlanUI();
}

/** Add a skill directly to selected plan and create chip if needed */
function addSkillToSelectedPlan(skill) {
  const clean = skill.trim();
  if (!clean) return;

  selectedSkillsToLearn.add(clean);

  // Check if chip already exists in chipsLearn
  let existingChip = null;
  chipsLearn.querySelectorAll('.chip-selectable').forEach(el => {
    if (el.dataset.skill && el.dataset.skill.toLowerCase() === clean.toLowerCase()) {
      existingChip = el;
    }
  });

  if (existingChip) {
    existingChip.className = 'chip-selectable selected';
    existingChip.innerHTML = `✓ ${escapeHtml(clean)}`;
  } else {
    const newChip = document.createElement('span');
    newChip.className = 'chip-selectable selected';
    newChip.dataset.skill = clean;
    newChip.innerHTML = `✓ ${escapeHtml(clean)}`;
    newChip.addEventListener('click', () => {
      toggleSkillSelection(clean, newChip);
    });
    chipsLearn.appendChild(newChip);
  }

  updateBuildPlanUI();
}

/** Update the "Build Learning Plan" button text and next action card */
function updateBuildPlanUI() {
  const count = selectedSkillsToLearn.size;
  const skillsArray = Array.from(selectedSkillsToLearn);

  if (count > 0) {
    btnBuildPlan.disabled = false;
    btnBuildPlan.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      Build Learning Plan (${count} skill${count === 1 ? '' : 's'})
    `;

    const preview = skillsArray.slice(0, 4).join(', ') + (count > 4 ? ` (+${count - 4} more)` : '');
    nextActionText.textContent = `New roadmap targets: ${preview}. If this job already has a saved roadmap, it reopens with progress preserved.`;
  } else {
    btnBuildPlan.disabled = true;
    btnBuildPlan.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Select skills above to build plan
    `;
    nextActionText.textContent = 'Please click at least one skill above (or add a custom skill) to generate your learning plan.';
  }
}

// ── Select All / Clear All buttons ─────────────────
if (btnSelectAllSkills) {
  btnSelectAllSkills.addEventListener('click', () => {
    chipsLearn.querySelectorAll('.chip-selectable').forEach(chip => {
      const skill = chip.dataset.skill;
      if (skill) {
        selectedSkillsToLearn.add(skill);
        chip.className = 'chip-selectable selected';
        chip.innerHTML = `✓ ${escapeHtml(skill)}`;
      }
    });
    updateBuildPlanUI();
  });
}

if (btnClearAllSkills) {
  btnClearAllSkills.addEventListener('click', () => {
    selectedSkillsToLearn.clear();
    chipsLearn.querySelectorAll('.chip-selectable').forEach(chip => {
      const skill = chip.dataset.skill;
      if (skill) {
        chip.className = 'chip-selectable unselected';
        chip.innerHTML = `+ ${escapeHtml(skill)}`;
      }
    });
    updateBuildPlanUI();
  });
}

// ── Add custom skill to plan ───────────────────────
if (btnAddCustomSkill && inputCustomSkill) {
  const handleAddCustom = () => {
    const val = inputCustomSkill.value.trim();
    if (!val) return;
    addSkillToSelectedPlan(val);
    inputCustomSkill.value = '';
  };

  btnAddCustomSkill.addEventListener('click', handleAddCustom);
  inputCustomSkill.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddCustom();
  });
}

/* ══════════════════════════════════════════════════
   BUILD LEARNING PLAN BUTTON
   Builds the plan using the EXACT skills chosen by the user.
══════════════════════════════════════════════════ */
btnBuildPlan.addEventListener('click',async()=>{
 if(!userSession){showSyncMessage('Sign in to save this analysis and open your account roadmap.');navProfile.click();return;}
 if(!currentAnalysis?.id){showSyncMessage('Analyze the job again to save it to your account.');return;}
 try{await accountApi('/api/extension/analyses','PATCH',{id:currentAnalysis.id,skills:Array.from(selectedSkillsToLearn)});await chrome.tabs.create({url:`${COMPASS_WEB_APP_URL}?analysis=${encodeURIComponent(currentAnalysis.id)}#roadmap`});}catch(error){showError('Roadmap unavailable',error.message);}
});

/* ══════════════════════════════════════════════════
   SAVE JOB (Add to My Path)
══════════════════════════════════════════════════ */
btnSaveJob.addEventListener('click', async () => {
  if (!currentAnalysis) return;
  if(userSession){showSyncMessage('Analysis saved to your account.');return;}

  const job = {
    jobTitle:      currentAnalysis.jobTitle || 'Unknown Role',
    company:       currentAnalysis.company  || 'Unknown Company',
    pageUrl:       currentAnalysis.url      || '',
    matchScore:    currentAnalysis.matchPercent,
    matchedSkills: currentAnalysis.matchedSkills || [],
    missingSkills: selectedSkillsToLearn.size > 0 ? Array.from(selectedSkillsToLearn) : (currentAnalysis.missingSkills || []),
    savedAt:       new Date().toISOString(),
  };

  const savedJobs = userSession ? (await accountApi('/api/extension/analyses')).analyses.map(row=>({...row.data,analysisId:row.id,pageUrl:row.data.url,matchScore:row.data.matchPercent,savedAt:row.updated_at})) : (await chrome.storage.local.get('savedJobs')).savedJobs || [];
  const alreadySaved = savedJobs.some(j => j.pageUrl === job.pageUrl);
  if (!alreadySaved) {
    savedJobs.unshift(job);
    await chrome.storage.local.set({ savedJobs });
  }

  btnSaveJob.textContent = '✓ Saved to My Path';
  btnSaveJob.disabled = true;
  setTimeout(() => {
    btnSaveJob.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
      Add to My Path
    `;
    btnSaveJob.disabled = false;
  }, 2000);
});

/* ══════════════════════════════════════════════════
   SAVED JOBS VIEW
══════════════════════════════════════════════════ */
async function renderSavedJobs() {
  savedJobsList.innerHTML = '';
  const savedJobs = userSession ? (await accountApi('/api/extension/analyses')).analyses.map(row=>({...row.data,analysisId:row.id,pageUrl:row.data.url,matchScore:row.data.matchPercent,savedAt:row.updated_at})) : (await chrome.storage.local.get('savedJobs')).savedJobs || [];

  savedJobsList.innerHTML = '';

  if (savedJobs.length === 0) {
    savedEmpty.style.display = 'flex';
    return;
  }

  savedEmpty.style.display = 'none';

  savedJobs.forEach((job, index) => {
    const card = document.createElement('div');
    card.className = 'saved-job-card';

    const scoreClass = job.matchScore >= 80 ? 'score-strong'
                     : job.matchScore >= 60 ? 'score-good'
                     : job.matchScore >= 40 ? 'score-some'
                     : 'score-low';

    const dateStr = job.savedAt
      ? new Date(job.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';

    card.innerHTML = `
      <div class="saved-job-header">
        <div>
          <div class="saved-job-title">${escapeHtml(job.jobTitle)}</div>
          <div class="saved-job-company">${escapeHtml(job.company)}</div>
        </div>
        <div class="saved-job-score ${scoreClass}">
          ${job.matchScore != null ? job.matchScore + '%' : '—'}
        </div>
      </div>
      <div class="saved-job-meta">
        <span class="saved-job-date">${dateStr}</span>
        <button class="saved-delete-btn" data-index="${index}" title="Remove">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.saved-delete-btn')) return;
      if(job.analysisId)chrome.tabs.create({url:`${COMPASS_WEB_APP_URL}?analysis=${job.analysisId}#roadmap`});
      else if (/^https?:\/\//.test(job.pageUrl)) chrome.tabs.create({ url: job.pageUrl });
    });

    card.querySelector('.saved-delete-btn').addEventListener('click', async e => {
      e.stopPropagation();
      if(userSession&&job.analysisId){try{await accountApi(`/api/extension/analyses?id=${job.analysisId}`,'DELETE');await renderSavedJobs().catch(error=>showSyncMessage(error.message));}catch(error){showSyncMessage(error.message);}return;}
      const { savedJobs: current = [] } = await chrome.storage.local.get('savedJobs');
      current.splice(index, 1);
      await chrome.storage.local.set({ savedJobs: current });
      renderSavedJobs().catch(error=>showSyncMessage(error.message));
    });

    savedJobsList.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════
   PROFILE / SKILLS MANAGEMENT
══════════════════════════════════════════════════ */

async function ensureDefaultSkills() {
  const { studentSkills } = await chrome.storage.local.get('studentSkills');
  if (!studentSkills) {
    await chrome.storage.local.set({ studentSkills: DEFAULT_STUDENT_SKILLS });
  }
}

async function getStudentSkills() {
  if(userSession)return userProfileData?.skills || [];
  const { studentSkills = DEFAULT_STUDENT_SKILLS } = await chrome.storage.local.get('studentSkills');
  return studentSkills;
}

async function renderProfileSkills() {
  const skills = await getStudentSkills();
  profileSkillChips.innerHTML = '';

  skills.forEach((skill, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip profile';
    chip.innerHTML = `
      ${escapeHtml(skill)}
      <button class="chip-remove" data-index="${i}" title="Remove">×</button>
    `;
    if(userSession&&!userProfileData?.manualSkills?.some(s=>s.toLowerCase()===skill.toLowerCase())){chip.querySelector('.chip-remove').disabled=true;chip.querySelector('.chip-remove').title='Edit website profile skills on the website; completed learning is retained.';}
    chip.querySelector('.chip-remove').addEventListener('click', async () => {
      const current = await getStudentSkills();
      current.splice(i, 1);
      if(userSession){try{await accountApi('/api/extension/profile','PUT',{skill:skills[i],remove:true});await fetchProfileFromServer();}catch(error){showSyncMessage(error.message);return;}}else await chrome.storage.local.set({ studentSkills: current });
      void renderProfileSkills().catch(error=>showSyncMessage(error.message));
    });
    profileSkillChips.appendChild(chip);
  });
}

btnAddSkill.addEventListener('click', async () => {
  const raw = newSkillInput.value.trim();
  if (!raw) return;

  const current = await getStudentSkills();
  if (current.some(s => s.toLowerCase() === raw.toLowerCase())) {
    newSkillInput.value = '';
    return;
  }

  if(userSession){try{await accountApi('/api/extension/profile','PUT',{skill:raw});await fetchProfileFromServer();}catch(error){showSyncMessage(error.message);return;}}else{current.push(raw);await chrome.storage.local.set({ studentSkills: current });}
  newSkillInput.value = '';
  void renderProfileSkills().catch(error=>showSyncMessage(error.message));
});

newSkillInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnAddSkill.click();
});

btnSaveSkills.addEventListener('click', async () => {
  const skills = await getStudentSkills();
  if(!userSession)await chrome.storage.local.set({ studentSkills: skills });
  saveConfirmation.classList.add('visible');
  setTimeout(() => saveConfirmation.classList.remove('visible'), 2000);
});

/** Sync skills with CourseCompass account and open tabs */
if (btnSyncSkills) {
  btnSyncSkills.addEventListener('click', async () => {
    btnSyncSkills.disabled = true;
    btnSyncSkills.textContent = 'Syncing...';
    try {
      const synced = await syncSkillsFromCourseCompass();
      if (synced && synced.length > 0) {
        showSyncMessage(`Synced ${synced.length} skills from CourseCompass ✓`);
        await renderProfileSkills();
        renderAuthState();
      } else {
        showSyncMessage(userSession?'Your account has no reported skills yet. Add skills or complete learning on the website.':'Sign in to sync your CourseCompass account.');
      }
    } catch (e) {
      showSyncMessage(e.message || 'Account sync failed. Please retry.');
    } finally {
      btnSyncSkills.disabled = false;
      btnSyncSkills.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        Sync Skills from CourseCompass (CV & Profile)
      `;
    }
  });
}

function showSyncMessage(msg) {
  if (!syncConfirmation) return;
  syncConfirmation.textContent = msg;
  syncConfirmation.classList.add('visible');
  setTimeout(() => syncConfirmation.classList.remove('visible'), 3000);
}

async function syncSkillsFromCourseCompass(){if(!userSession)return null;await fetchProfileFromServer();renderAuthState();await renderProfileSkills();return userProfileData.skills;}

/* ══════════════════════════════════════════════════
   UI HELPERS & CHIPS
══════════════════════════════════════════════════ */

function createChip(text, type, prefix) {
  const chip = document.createElement('span');
  chip.className = `chip ${type}`;
  chip.textContent = `${prefix} ${text}`;
  return chip;
}

function setState(state) {
  initialState.style.display = state === 'initial' ? 'block' : 'none';
  loadingState.style.display = state === 'loading' ? 'block' : 'none';
  errorState.style.display   = state === 'error'   ? 'block' : 'none';
  resultsState.style.display = state === 'results' ? 'block' : 'none';
}

function showError(title, msg) {
  errorTitle.textContent = title;
  errorMsg.textContent   = msg;
  setState('error');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

$('manualAnalyze').addEventListener('click',async()=>{
 const text=$('manualJobText').value.trim();if(text.length<30){$('manualError').textContent='Paste at least 30 characters.';return;}
 $('manualAnalyze').disabled=true;$('manualError').textContent='';
 try{if(userSession)await fetchProfileFromServer();const data={bodyText:text,jobTitle:'Pasted job description',company:'',url:'',title:'Pasted job description'};const analysis=await analyzeSkills(data);currentAnalysis={...data,...analysis};await renderResults(analysis,data);setState('results');}catch(error){$('manualError').textContent=error.message;}finally{$('manualAnalyze').disabled=false;}
});
