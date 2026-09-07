/* ════════════════════════════════════════════════════
   popup.js – CourseAI Compass
   All popup logic: navigation, analysis, skill matching,
   saved jobs, and profile management.
════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════
   CONFIGURATION
══════════════════════════════════════════════════ */

/**
 * Change this URL to point to your deployed web app.
 * It is passed missing skills as query params when the user
 * clicks "Build Learning Plan".
 * e.g. https://yourapp.vercel.app/?skills=React,Docker&source=extension
 */
const COMPASS_WEB_APP_URL = 'https://courseai-compass.vercel.app/';

/* ══════════════════════════════════════════════════
   SKILL DICTIONARY
   Comprehensive list of software / AI / tech skills.
   Matching is case-insensitive.
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
  // Misc — note: Linux already in DevOps above, no duplicate
  'Figma', 'Agile', 'Scrum', 'Jira', 'Microservices',
  'Object-Oriented Programming', 'OOP', 'Design Patterns', 'Algorithms',
];

/* Default student profile — stored in chrome.storage.local */
const DEFAULT_STUDENT_SKILLS = [
  'JavaScript', 'HTML', 'CSS', 'Java', 'C++', 'C#',
  'SQL', 'Git', 'GitHub', 'Supabase', 'Python',
];

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let currentAnalysis = null;  // holds the last analysis result

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
const contextSkeleton = $('contextSkeleton');
const contextInfo     = $('contextInfo');
const pageTitle       = $('pageTitle');
const detectedCompany  = $('detectedCompany');
const detectedJobTitle = $('detectedJobTitle');
const rowCompany       = $('rowCompany');
const rowJobTitle      = $('rowJobTitle');

// States
const initialState  = $('initialState');
const loadingState  = $('loadingState');
const errorState    = $('errorState');
const resultsState  = $('resultsState');

// Buttons
const btnAnalyze    = $('btnAnalyze');
const btnRetry      = $('btnRetry');
const btnReAnalyze  = $('btnReAnalyze');
const btnBuildPlan  = $('btnBuildPlan');
const btnSaveJob    = $('btnSaveJob');

// Results
const ringFill      = $('ringFill');
const scoreNumber   = $('scoreNumber');
const scoreCategory = $('scoreCategory');
const statTotal     = $('statTotal');
const statMatched   = $('statMatched');
const statMissing   = $('statMissing');
const chipsHave     = $('chipsHave');
const chipsLearn    = $('chipsLearn');
const sectionHave   = $('sectionHave');
const sectionLearn  = $('sectionLearn');
const nextActionText = $('nextActionText');
const nextActionCard = $('nextActionCard');
const errorTitle    = $('errorTitle');
const errorMsg      = $('errorMsg');

// Saved jobs
const savedJobsList = $('savedJobsList');
const savedEmpty    = $('savedEmpty');

// Profile
const profileSkillChips = $('profileSkillChips');
const newSkillInput      = $('newSkillInput');
const btnAddSkill        = $('btnAddSkill');
const btnSaveSkills      = $('btnSaveSkills');
const saveConfirmation   = $('saveConfirmation');

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
  renderSavedJobs();
});
navProfile.addEventListener('click', () => {
  setView(viewProfile, navProfile);
  renderProfileSkills();
});

/* ══════════════════════════════════════════════════
   INITIALISE POPUP
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentTabContext();
  await ensureDefaultSkills();
});

/** Load the current tab metadata and show in context card */
async function loadCurrentTabContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showContextFallback(); return; }

    const url = tab.url || '';

    // chrome:// pages cannot be scripted — detect early
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:')) {
      showContextFallback('Browser internal page');
      return;
    }

    // Show what we can from the tab object immediately
    contextSkeleton.style.display = 'none';
    contextInfo.style.display = 'block';
    pageTitle.textContent = truncate(tab.title || url, 60);

  } catch (err) {
    showContextFallback();
  }
}

function showContextFallback(msg) {
  contextSkeleton.style.display = 'none';
  contextInfo.style.display = 'block';
  pageTitle.textContent = msg || 'Open a job listing to begin';
}

/* ══════════════════════════════════════════════════
   ANALYSIS FLOW
══════════════════════════════════════════════════ */
btnAnalyze.addEventListener('click', runAnalysis);
btnRetry.addEventListener('click', () => {
  setState('initial');
  runAnalysis();
});
btnReAnalyze.addEventListener('click', () => {
  setState('initial');
  runAnalysis();
});

async function runAnalysis() {
  setState('loading');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('no-tab');

    const url = tab.url || '';

    // Guard: cannot script chrome:// or extension pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:')) {
      showError(
        'Cannot analyze browser pages',
        'CourseAI Compass only works on regular websites. Navigate to a job listing and try again.'
      );
      return;
    }

    // Send message to content script already injected by manifest
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DATA' });
    } catch {
      // Content script might not be active yet — inject it programmatically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DATA' });
      } catch (injErr) {
        throw new Error('inject-failed');
      }
    }

    if (!response || !response.success) {
      throw new Error('extraction-failed');
    }

    const { data } = response;

    // Update context card with extracted data
    updateContextCard(data);

    // Run skill matching — analyzeSkills is async (reads storage), must await
    const analysis = await analyzeSkills(data);
    currentAnalysis = { ...analysis, ...data };

    // If no skills detected show a friendly message instead of empty results
    if (analysis.detectedSkills.length === 0) {
      showError(
        'Not enough job information detected',
        'CourseAI Compass couldn\'t identify enough structured skill information on this page. Try opening the full job description.'
      );
      return;
    }

    await renderResults(analysis, data);
    setState('results');

  } catch (err) {
    const msgs = {
      'no-tab':           ['Couldn\'t access the tab', 'Please try reopening the extension.'],
      'inject-failed':    ['Permission error', 'CourseAI Compass doesn\'t have access to this page. Try a different page.'],
      'extraction-failed':['Page read failed', 'Couldn\'t read this page\'s content. Try refreshing and reopening the extension.'],
    };
    const [t, m] = msgs[err.message] || ['Something went wrong', 'CourseAI Compass encountered an unexpected error. Please try again.'];
    showError(t, m);
  }
}

function updateContextCard(data) {
  if (data.company) {
    detectedCompany.textContent = truncate(data.company, 50);
    rowCompany.style.display = 'flex';
  }
  if (data.jobTitle) {
    detectedJobTitle.textContent = truncate(data.jobTitle, 60);
    rowJobTitle.style.display = 'flex';
  }
  if (data.title) {
    pageTitle.textContent = truncate(data.title, 60);
  }
}

/* ══════════════════════════════════════════════════
   SKILL EXTRACTION & MATCHING
══════════════════════════════════════════════════ */

/**
 * Find which skills from the dictionary appear in the job text.
 * Matching is case-insensitive, whole-word aware.
 */
function extractSkillsFromText(text) {
  const found = new Set();

  for (const skill of SKILL_DICTIONARY) {
    // Escape all regex special characters in the skill name.
    // Using a correctly-formed character class: no bare [ inside [].
    const escaped = skill.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');

    // Match the skill surrounded by non-word characters or at string boundaries.
    // This handles: "React," "(React)" "React.js" won't match "React" inside "ReactDOM".
    const pattern = new RegExp(
      '(?:^|[\\s,;:.()/\\[\\]|\\-])' + escaped + '(?=$|[\\s,;:.()/\\[\\]|\\-])',
      'i'
    );
    if (pattern.test(text)) {
      found.add(skill);
    }
  }

  return [...found];
}

/**
 * Compare detected job skills with the student's stored skills.
 * Returns full analysis object.
 */
async function analyzeSkills(data) {
  const detectedSkills = extractSkillsFromText(data.bodyText + ' ' + data.title);
  const studentSkills  = await getStudentSkills();

  const studentLower   = studentSkills.map(s => s.toLowerCase());
  const matchedSkills  = detectedSkills.filter(s => studentLower.includes(s.toLowerCase()));
  const missingSkills  = detectedSkills.filter(s => !studentLower.includes(s.toLowerCase()));

  const matchPercent = detectedSkills.length > 0
    ? Math.round((matchedSkills.length / detectedSkills.length) * 100)
    : null;

  return { detectedSkills, matchedSkills, missingSkills, matchPercent };
}

// Make analyzeSkills synchronous-compatible by awaiting in caller
// The function IS async because of getStudentSkills.

/* ══════════════════════════════════════════════════
   RENDER RESULTS
══════════════════════════════════════════════════ */
async function renderResults(analysis, data) {
  const { detectedSkills, matchedSkills, missingSkills, matchPercent } = analysis;

  // ── Score ring ──────────────────────────────────
  const CIRCUMFERENCE = 263.9; // 2π × r (r = 42)
  const pct = matchPercent ?? 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  // Animate with a short delay to allow DOM paint
  requestAnimationFrame(() => {
    ringFill.style.strokeDashoffset = offset;

    // Color by category
    ringFill.classList.remove('strong', 'good', 'some', 'low');
    if (pct >= 80)      ringFill.classList.add('strong');
    else if (pct >= 60) ringFill.classList.add('good');
    else if (pct >= 40) ringFill.classList.add('some');
    else                ringFill.classList.add('low');
  });

  scoreNumber.textContent = `${pct}%`;

  // ── Category label ──────────────────────────────
  let category, categoryColor;
  if (pct >= 80)      { category = 'Strong alignment';           categoryColor = '#22c55e'; }
  else if (pct >= 60) { category = 'Good foundation';            categoryColor = '#3b82f6'; }
  else if (pct >= 40) { category = 'Some skill gaps';            categoryColor = '#f59e0b'; }
  else                { category = 'Significant learning needed'; categoryColor = '#ef4444'; }

  scoreCategory.textContent = category;
  scoreCategory.style.color = categoryColor;

  // ── Stats ───────────────────────────────────────
  statTotal.textContent   = detectedSkills.length;
  statMatched.textContent = matchedSkills.length;
  statMissing.textContent = missingSkills.length;

  // ── Skill chips – Have ──────────────────────────
  chipsHave.innerHTML = '';
  if (matchedSkills.length > 0) {
    sectionHave.style.display = 'block';
    matchedSkills.forEach(skill => {
      chipsHave.appendChild(createChip(skill, 'have', '✓'));
    });
  } else {
    sectionHave.style.display = 'none';
  }

  // ── Skill chips – Learn ─────────────────────────
  chipsLearn.innerHTML = '';
  if (missingSkills.length > 0) {
    sectionLearn.style.display = 'block';
    missingSkills.forEach(skill => {
      chipsLearn.appendChild(createChip(skill, 'learn', '○'));
    });
  } else {
    sectionLearn.style.display = 'none';
  }

  // ── Next action ─────────────────────────────────
  // Always show the card; copy top 3 missing skills to the Build Plan button
  nextActionCard.style.display = 'block';
  const top3Missing = missingSkills.slice(0, 3);

  if (top3Missing.length > 0) {
    const skillList = top3Missing.join(', ');
    nextActionText.textContent =
      `Focus on ${skillList} before applying to similar roles.`;
    btnBuildPlan.dataset.missingSkills = top3Missing.join(',');
  } else {
    // All skills matched — no gaps
    nextActionText.textContent =
      'Your skills align well with this role. Keep practising and building portfolio projects.';
    btnBuildPlan.dataset.missingSkills = '';
  }
}

function createChip(text, type, prefix) {
  const chip = document.createElement('span');
  chip.className = `chip ${type}`;
  chip.textContent = `${prefix} ${text}`;
  return chip;
}

/* ══════════════════════════════════════════════════
   UI STATE MACHINE
══════════════════════════════════════════════════ */
function setState(state) {
  initialState.style.display  = state === 'initial'  ? 'block'  : 'none';
  loadingState.style.display  = state === 'loading'  ? 'block'  : 'none';
  errorState.style.display    = state === 'error'    ? 'block'  : 'none';
  resultsState.style.display  = state === 'results'  ? 'block'  : 'none';
}

function showError(title, msg) {
  errorTitle.textContent = title;
  errorMsg.textContent   = msg;
  setState('error');
}

/* ══════════════════════════════════════════════════
   BUILD LEARNING PLAN BUTTON
══════════════════════════════════════════════════ */
btnBuildPlan.addEventListener('click', () => {
  const missing  = btnBuildPlan.dataset.missingSkills || '';
  const params   = new URLSearchParams();
  if (missing) params.set('skills', missing);
  params.set('source', 'extension');
  // Strip trailing slash before appending query string to avoid double-slash
  const base = COMPASS_WEB_APP_URL.replace(/\/$/, '');
  const url  = `${base}?${params.toString()}`;
  chrome.tabs.create({ url });
});

/* ══════════════════════════════════════════════════
   SAVE JOB (Add to My Path)
══════════════════════════════════════════════════ */
btnSaveJob.addEventListener('click', async () => {
  if (!currentAnalysis) return;

  const job = {
    jobTitle:      currentAnalysis.jobTitle || 'Unknown Role',
    company:       currentAnalysis.company  || 'Unknown Company',
    pageUrl:       currentAnalysis.url      || '',
    matchScore:    currentAnalysis.matchPercent,
    matchedSkills: currentAnalysis.matchedSkills || [],
    missingSkills: currentAnalysis.missingSkills || [],
    savedAt:       new Date().toISOString(),
  };

  const { savedJobs = [] } = await chrome.storage.local.get('savedJobs');
  // Avoid exact duplicate URLs
  const alreadySaved = savedJobs.some(j => j.pageUrl === job.pageUrl);
  if (!alreadySaved) {
    savedJobs.unshift(job);
    await chrome.storage.local.set({ savedJobs });
  }

  // Visual feedback
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
  const { savedJobs = [] } = await chrome.storage.local.get('savedJobs');

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

    // Click card → open job URL
    card.addEventListener('click', e => {
      if (e.target.closest('.saved-delete-btn')) return;
      if (job.pageUrl) chrome.tabs.create({ url: job.pageUrl });
    });

    // Delete
    card.querySelector('.saved-delete-btn').addEventListener('click', async e => {
      e.stopPropagation();
      const { savedJobs: current = [] } = await chrome.storage.local.get('savedJobs');
      current.splice(index, 1);
      await chrome.storage.local.set({ savedJobs: current });
      renderSavedJobs();
    });

    savedJobsList.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════
   PROFILE / SKILLS MANAGEMENT
══════════════════════════════════════════════════ */

/** Ensure default skills are set on first install */
async function ensureDefaultSkills() {
  const { studentSkills } = await chrome.storage.local.get('studentSkills');
  if (!studentSkills) {
    await chrome.storage.local.set({ studentSkills: DEFAULT_STUDENT_SKILLS });
  }
}

async function getStudentSkills() {
  const { studentSkills = DEFAULT_STUDENT_SKILLS } = await chrome.storage.local.get('studentSkills');
  return studentSkills;
}

/** Render profile skill chips with remove buttons */
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
    chip.querySelector('.chip-remove').addEventListener('click', async () => {
      const current = await getStudentSkills();
      current.splice(i, 1);
      await chrome.storage.local.set({ studentSkills: current });
      renderProfileSkills();
    });
    profileSkillChips.appendChild(chip);
  });
}

/** Add a new skill to the profile */
btnAddSkill.addEventListener('click', async () => {
  const raw = newSkillInput.value.trim();
  if (!raw) return;

  const current = await getStudentSkills();
  // Avoid duplicates
  if (current.some(s => s.toLowerCase() === raw.toLowerCase())) {
    newSkillInput.value = '';
    return;
  }

  current.push(raw);
  await chrome.storage.local.set({ studentSkills: current });
  newSkillInput.value = '';
  renderProfileSkills();
});

/** Allow pressing Enter in the skill input */
newSkillInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnAddSkill.click();
});

/** Save skills with visual confirmation */
btnSaveSkills.addEventListener('click', async () => {
  const skills = await getStudentSkills();
  await chrome.storage.local.set({ studentSkills: skills });
  saveConfirmation.classList.add('visible');
  setTimeout(() => saveConfirmation.classList.remove('visible'), 2000);
});

/* ══════════════════════════════════════════════════
   UTILITY HELPERS
══════════════════════════════════════════════════ */

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
