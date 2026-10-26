import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

void test('Extension background worker runs in real Chrome environment where storage.local.setAccessLevel is undefined', async () => {
  const store: Record<string, unknown> = {};
  let sessionAccessLevel = '';
  let listener: ((message: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean) | null = null;

  // Real Chrome environment:
  // chrome.storage.local has NO setAccessLevel
  // chrome.storage.session HAS setAccessLevel
  const chrome = {
    storage: {
      session: {
        setAccessLevel: async (x: { accessLevel: string }) => {
          sessionAccessLevel = x.accessLevel;
        },
      },
      local: {
        // Notice: NO setAccessLevel here, exactly like real Chrome
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (val: Record<string, unknown>) => Object.assign(store, val),
        remove: async (key: string) => { delete store[key]; },
      },
    },
    runtime: {
      id: 'extension-test-id',
      getURL: (path: string) => `chrome-extension://extension-test-id/${path}`,
      onInstalled: { addListener: () => {} },
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
    action: { setBadgeBackgroundColor: () => {} },
  };

  // Evaluating background.js must NOT throw TypeError in real Chrome!
  assert.doesNotThrow(() => {
    vm.runInNewContext(
      readFileSync('courseai-compass-extension/background.js', 'utf8'),
      {
        chrome,
        fetch: async (url: string, init?: RequestInit) => {
          if (url.endsWith('/auth')) {
            const body = JSON.parse(init?.body as string || '{}');
            if (body.action === 'login') {
              if (body.password === 'wrong') {
                return new Response(JSON.stringify({ error: 'Invalid login credentials' }), { status: 401 });
              }
              return new Response(JSON.stringify({
                access_token: 'valid_access_token',
                refresh_token: 'valid_refresh_token',
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user: { id: 'usr-123', email: body.email },
              }), { status: 200 });
            }
            if (body.action === 'logout') {
              return new Response(JSON.stringify({ signedOut: true }), { status: 200 });
            }
          }
          if (url.includes('/api/extension/profile')) {
            return new Response(JSON.stringify({
              email: 'test@example.com',
              skills: ['React', 'TypeScript'],
              learnedSkills: ['React'],
              inProgressSkills: ['TypeScript'],
              plans: [],
            }), { status: 200 });
          }
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
        AbortSignal,
        Date,
        Promise,
        Error,
      }
    );
  });

  // Verify listener was registered
  assert.ok(listener, 'chrome.runtime.onMessage listener must be registered');
  assert.equal(sessionAccessLevel, 'TRUSTED_CONTEXTS', 'session.setAccessLevel must be called with TRUSTED_CONTEXTS');

  const sendMessage = (msg: unknown, url = 'chrome-extension://extension-test-id/popup.html') =>
    new Promise<{ ok: boolean; data?: unknown; error?: string; status?: number }>((resolve) => {
      const keptAlive = listener!(msg, { id: 'extension-test-id', url }, (r) =>
        resolve(r as { ok: boolean; data?: unknown; error?: string; status?: number }),
      );
      assert.equal(keptAlive, true, 'MV3 listener must return true for async sendResponse');
    });

  // 1. Initial state: not logged in
  const sessionRes = await sendMessage({ action: 'session' });
  assert.equal(sessionRes.ok, true);
  assert.equal(sessionRes.data, null, 'Unauthenticated session must return null, not error');

  // 2. Login with wrong password
  const failLogin = await sendMessage({ action: 'login', email: 'test@example.com', password: 'wrong' });
  assert.equal(failLogin.ok, false);
  assert.equal(failLogin.error, 'Invalid login credentials');
  assert.equal(failLogin.status, 401);
  assert.equal(store.compassSession, undefined, 'Failed login must not create session');

  // 3. Login with correct password
  const successLogin = await sendMessage({ action: 'login', email: 'test@example.com', password: 'correct_password' });
  assert.equal(successLogin.ok, true);
  assert.equal(JSON.stringify(successLogin.data), JSON.stringify({ email: 'test@example.com', userId: 'usr-123' }));
  assert.ok(store.compassSession, 'Successful login must persist session in chrome.storage.local');

  // 4. Session restoration after popup reopen
  const restoredSession = await sendMessage({ action: 'session' });
  assert.equal(restoredSession.ok, true);
  assert.equal(JSON.stringify(restoredSession.data), JSON.stringify({ email: 'test@example.com', userId: 'usr-123' }));

  // 5. Authenticated API call (/api/extension/profile)
  const profileRes = await sendMessage({ action: 'api', path: '/api/extension/profile', method: 'GET' });
  assert.equal(profileRes.ok, true);
  const profileData = profileRes.data as { skills: string[]; learnedSkills: string[] };
  assert.equal(JSON.stringify(profileData.skills), JSON.stringify(['React', 'TypeScript']));
  assert.equal(JSON.stringify(profileData.learnedSkills), JSON.stringify(['React']));

  // 6. Logout
  const logoutRes = await sendMessage({ action: 'logout' });
  assert.equal(logoutRes.ok, true);
  assert.equal(store.compassSession, undefined, 'Logout must remove session from chrome.storage.local');

  // 7. Session after logout
  const postLogout = await sendMessage({ action: 'session' });
  assert.equal(postLogout.ok, true);
  assert.equal(postLogout.data, null);
});

void test('Extension popup script does not display connection error on initial load or unsupported tab', async () => {
  const popupHtml = readFileSync('courseai-compass-extension/popup.html', 'utf8');
  assert.ok(popupHtml.includes('id="loginError"'), 'popup.html has loginError element');
  assert.ok(popupHtml.includes('id="loginSection"'), 'popup.html has loginSection element');
  assert.ok(popupHtml.includes('id="loggedInSection"'), 'popup.html has loggedInSection element');

  // Verify catch block syntax in popup.js has (err) binding
  const popupJs = readFileSync('courseai-compass-extension/popup.js', 'utf8');
  assert.doesNotMatch(popupJs, /\}\s*catch\s*\{[^}]*err\.message/, 'popup.js must not reference err without catch (err)');
});
