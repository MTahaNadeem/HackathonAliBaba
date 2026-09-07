# CourseAI Compass – Job Analyzer

> **Understand the job before you apply.**  
> A Chrome Extension that instantly analyzes any job listing against your personal skill set — no API key required.

---

## How to Load in Chrome

1. Open Chrome and go to **`chrome://extensions`**
2. Enable **Developer Mode** (toggle in the top-right corner)
3. Click **"Load Unpacked"**
4. Select the **`courseai-compass-extension`** folder (this folder)
5. The extension will appear in your toolbar — pin it for easy access

---

## How to Use

1. Navigate to any job listing (LinkedIn, Indeed, Glassdoor, company career pages, internship sites)
2. Click the **CourseAI Compass** icon in your toolbar
3. The popup shows the detected page title, company, and role
4. Click **"Analyze This Job"**
5. View your **Match Score**, skills you already have, and skills to learn
6. Click **"Build Learning Plan"** to open the web app with your missing skills pre-filled
7. Click **"Add to My Path"** to save the job for later reference

---

## Updating the Web App URL

The "Build Learning Plan" button opens your web app and passes missing skills as query parameters.

To change the destination URL, open **`popup.js`** and update this constant near the top of the file:

```js
// Line ~20 in popup.js
const COMPASS_WEB_APP_URL = 'https://courseai-compass.vercel.app/';
```

Replace the URL with your deployed app. The extension will automatically append:
```
?skills=React,Docker,REST%20APIs&source=extension
```

---

## File Structure

```
courseai-compass-extension/
├── manifest.json       ← Chrome Extension Manifest V3 config
├── popup.html          ← Extension popup UI (all views)
├── popup.css           ← Premium styles (Linear/Notion-inspired)
├── popup.js            ← All popup logic: analysis, matching, storage
├── content.js          ← Injected into pages to extract job text
├── background.js       ← Minimal service worker (badge color on install)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           ← This file
```

---

## How the Analysis Flow Works

```
User clicks "Analyze This Job"
        │
        ▼
popup.js sends { action: 'EXTRACT_JOB_DATA' } to content.js
        │
        ▼
content.js reads the active tab:
  • Page title, headings, paragraphs, list items
  • Tries known selectors (LinkedIn, Indeed, Glassdoor, generic)
  • Falls back to full body text
  • Returns up to 10,000 characters of cleaned text
        │
        ▼
popup.js runs extractSkillsFromText():
  • Searches for ~70 skills from SKILL_DICTIONARY
  • Case-insensitive, word-boundary aware regex matching
  • Returns array of detected skills
        │
        ▼
Compare against student's chrome.storage.local profile:
  • matchedSkills  = detected ∩ student skills
  • missingSkills  = detected − student skills
  • matchPercent   = (matched / detected) × 100
        │
        ▼
Render results:
  • Animated circular score ring
  • Green chips for skills you have
  • Amber chips for skills to learn
  • Recommended next step (top 3 missing skills)
  • "Build Learning Plan" → opens web app with ?skills=...
  • "Add to My Path" → saves job to chrome.storage.local
```

---

## LinkedIn & Dynamic Page Limitations

| Site | Status | Notes |
|------|--------|-------|
| **Company career pages** | ✅ Works well | Static HTML, clean extraction |
| **Indeed** | ✅ Works well | Standard selectors match |
| **Glassdoor** | ✅ Good | Class names may change with updates |
| **LinkedIn** | ⚠️ Partial | LinkedIn loads job descriptions dynamically via JavaScript. The extension reads what is rendered in the DOM at the time of analysis. **Open the full job description** (click "See more") before analyzing for best results. |
| **LinkedIn (logged out)** | ❌ Limited | Most content is gated behind login |

**Tip for LinkedIn:** After navigating to a job posting, wait for the page to fully load, scroll down to see the full description, then open the extension and click Analyze.

---

## Permissions Used

| Permission | Why |
|-----------|-----|
| `activeTab` | Read the current tab's URL and title |
| `scripting` | Inject content script programmatically if needed |
| `storage` | Save student skills and job history locally |
| `host_permissions: <all_urls>` | Allow content script to run on any job site |

---

## Student Profile (Default Skills)

Out of the box, the extension starts with this skill profile:

`JavaScript` · `HTML` · `CSS` · `Java` · `C++` · `C#` · `SQL` · `Git` · `GitHub` · `Supabase` · `Python`

Edit your skills anytime by clicking the **person icon** in the extension header.

---

## Disclaimer

> CourseAI Compass guides your preparation. Hiring decisions remain with employers.  
> Match scores reflect skill alignment with the job description only and do not predict hiring outcomes.
