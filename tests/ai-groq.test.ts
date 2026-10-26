import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callGroq } from '../lib/ai';
import { POST as chatPOST } from '../app/api/chat/route';
import { GET as configGET } from '../app/api/config/route';

void test('callGroq formats request for Groq chat completions with schema and parses JSON', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GROQ_API_KEY;
  const previousModel = process.env.GROQ_MODEL;

  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';

  let interceptedUrl = '';
  let interceptedBody: any = null;
  let authHeader = '';

  globalThis.fetch = async (url, init) => {
    interceptedUrl = url.toString();
    authHeader = (init?.headers as Record<string, string>)?.['Authorization'] || '';
    interceptedBody = JSON.parse(init?.body as string);
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ skills: ['Python', 'TypeScript'], experience: '5 years' })
          }
        }
      ]
    });
  };

  try {
    const result = await callGroq('You are an extractor', 'My resume text', {
      type: 'object',
      properties: { skills: { type: 'array' }, experience: { type: 'string' } }
    });

    assert.equal(interceptedUrl, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(authHeader, 'Bearer test-groq-key');
    assert.equal(interceptedBody.model, 'llama-3.3-70b-versatile');
    assert.deepEqual(interceptedBody.response_format, { type: 'json_object' });
    assert.equal(result.experience, '5 years');
    assert.deepEqual(result.skills, ['Python', 'TypeScript']);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GROQ_MODEL; else process.env.GROQ_MODEL = previousModel;
  }
});

void test('POST /api/chat returns Groq adviser response when configured and consent given', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GROQ_API_KEY;

  process.env.GROQ_API_KEY = 'test-groq-key';

  globalThis.fetch = async (_url, _init) => {
    return Response.json({
      choices: [
        {
          message: {
            content: 'Here is tailored guidance for software engineering degree.'
          }
        }
      ]
    });
  };

  try {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost'
      },
      body: JSON.stringify({
        message: 'Which degree should I choose for software?',
        goal: 'computing',
        skills: ['Python'],
        consent: true
      })
    });

    const res = await chatPOST(req);
    assert.equal(res.status, 200);
    const data = await res.json() as any;
    assert.equal(data.mode, 'Groq adviser');
    assert.match(data.reply, /software engineering degree/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previousKey;
  }
});

void test('GET /api/config reports aiConfigured: true when GROQ_API_KEY is present', async () => {
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'test-groq-key';
  try {
    const res = configGET();
    const data = await res.json() as any;
    assert.equal(data.aiConfigured, true);
  } finally {
    if (previousKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previousKey;
  }
});
