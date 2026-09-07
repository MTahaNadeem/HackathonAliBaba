/* ════════════════════════════════════════════════════
   background.js – CourseAI Compass (Manifest V3 service worker)
   Minimal background worker. Handles install event and
   badge/context setup. No complex logic lives here —
   the popup and content scripts handle all work directly.
════════════════════════════════════════════════════ */

chrome.runtime.onInstalled.addListener(() => {
  // Set initial badge to indicate the extension is ready
  chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
});
