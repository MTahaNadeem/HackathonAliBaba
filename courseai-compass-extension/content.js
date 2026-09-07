/* ════════════════════════════════════════════════════
   content.js – CourseAI Compass
   Injected into every page to extract job description text.
   Returns a structured object via chrome.runtime messaging.
════════════════════════════════════════════════════ */

/**
 * Listen for the "EXTRACT_JOB_DATA" message from popup.js.
 * Runs in the context of the active tab page.
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== 'EXTRACT_JOB_DATA') return;

  try {
    const data = extractJobData();
    sendResponse({ success: true, data });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }

  // Return true to keep the message channel open for async (not needed here
  // but required if sendResponse could be called asynchronously).
  return true;
});

/* ── Main extraction function ──────────────────── */
function extractJobData() {
  const title = document.title || '';
  const url   = window.location.href;

  // Detect company and job title from structured metadata or common patterns
  const company  = detectCompany();
  const jobTitle = detectJobTitle();

  // Pull raw text from the most relevant parts of the page
  const bodyText = extractBodyText();

  return { title, url, company, jobTitle, bodyText };
}

/* ── Company detection ─────────────────────────── */
function detectCompany() {
  // Try Open Graph / meta tags first
  const og = document.querySelector('meta[property="og:site_name"]');
  if (og && og.content) return og.content.trim();

  // LinkedIn specific
  const liCompany = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .topcard__org-name-link');
  if (liCompany) return liCompany.textContent.trim();

  // Indeed / Glassdoor
  const indeedCompany = document.querySelector('[data-testid="inlineHeader-companyName"], .companyName, [class*="company"]');
  if (indeedCompany) return indeedCompany.textContent.trim().split('\n')[0];

  // Schema.org JSON-LD
  const ld = getSchemaLD();
  if (ld?.hiringOrganization?.name) return ld.hiringOrganization.name.trim();

  // Fallback: hostname
  try {
    const host = new URL(window.location.href).hostname.replace(/^www\./, '');
    return host || '';
  } catch {
    return '';
  }
}

/* ── Job title detection ───────────────────────── */
function detectJobTitle() {
  // Schema.org JSON-LD (most reliable)
  const ld = getSchemaLD();
  if (ld?.title) return ld.title.trim();

  // Open Graph title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.content) return cleanJobTitle(ogTitle.content);

  // LinkedIn
  const liTitle = document.querySelector(
    '.job-details-jobs-unified-top-card__job-title h1, .topcard__title'
  );
  if (liTitle) return liTitle.textContent.trim();

  // Indeed
  const indeedTitle = document.querySelector(
    '[data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title'
  );
  if (indeedTitle) return indeedTitle.textContent.trim().split('\n')[0];

  // Generic: first <h1>
  const h1 = document.querySelector('h1');
  if (h1) return cleanJobTitle(h1.textContent.trim());

  return cleanJobTitle(document.title);
}

function cleanJobTitle(raw) {
  // Remove " | Company" or " - Site" suffix patterns
  return raw.replace(/\s*[|\-–]\s*.+$/, '').trim().slice(0, 120);
}

/* ── Schema.org JSON-LD helper ─────────────────── */
function getSchemaLD() {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      const json = JSON.parse(s.textContent);
      const data = Array.isArray(json) ? json[0] : json;
      if (data['@type'] === 'JobPosting' || data.title) return data;
    }
  } catch {
    // ignore malformed JSON-LD
  }
  return null;
}

/* ── Body text extraction ──────────────────────── */
function extractBodyText() {
  const MAX_CHARS = 10000;

  // Prioritize known job description containers
  const jobContainerSelectors = [
    // LinkedIn
    '.job-details-jobs-unified-top-card__primary-description-container',
    '.jobs-description__content',
    '.jobs-box__html-content',
    // Indeed
    '#jobDescriptionText',
    '[data-testid="jobsearch-JobComponent-description"]',
    // Glassdoor
    '.JobDetails_jobDescription__6VeBn',
    // Generic
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[class*="job_description"]',
    '[id*="job-description"]',
    '[id*="jobDescription"]',
    'article',
    'main',
    '[role="main"]',
  ];

  let container = null;
  for (const sel of jobContainerSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.length > 200) {
      container = el;
      break;
    }
  }

  // If no specific container found, fall back to the full body minus nav/footer
  if (!container) {
    container = document.body;
  }

  // Build a clean text corpus from the container
  const parts = [];

  // Headings — strong signal for skills sections
  for (const tag of ['h1','h2','h3','h4']) {
    container.querySelectorAll(tag).forEach(el => {
      const t = el.innerText.trim();
      if (t) parts.push(t);
    });
  }

  // Paragraphs
  container.querySelectorAll('p').forEach(el => {
    const t = el.innerText.trim();
    if (t.length > 20) parts.push(t);
  });

  // List items — requirements/qualifications are almost always here
  container.querySelectorAll('li').forEach(el => {
    const t = el.innerText.trim();
    if (t.length > 5) parts.push(t);
  });

  // Divs / spans that may contain inline text not in p/li
  if (parts.length < 10) {
    container.querySelectorAll('div, span').forEach(el => {
      // Only leaf-ish nodes
      if (el.children.length < 3) {
        const t = el.innerText.trim();
        if (t.length > 20 && t.length < 600) parts.push(t);
      }
    });
  }

  // Deduplicate and join
  const seen = new Set();
  const unique = parts.filter(t => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  return unique.join('\n').slice(0, MAX_CHARS);
}
