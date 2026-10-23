// Server entry points only. Never import this module from a client component.
import process from 'node:process';
import { z } from 'zod';

export type GroqRequest = (prompt: string, input: unknown) => Promise<unknown>;
export class GroqFailure extends Error {
  constructor(public readonly code: 'missing_key' | 'configuration' | 'timeout' | 'network' | 'rate_limit' | 'provider' | 'invalid_output') {
    super(code);
  }
}

export function groqConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';
  if (!/^[a-zA-Z0-9._/-]+$/.test(model)) throw new GroqFailure('configuration');
  return { endpoint: 'https://api.groq.com/openai/v1/chat/completions', model, apiKey: env.GROQ_API_KEY };
}

const envelope = z.object({
  choices: z.array(z.object({
    finish_reason: z.literal('stop'),
    message: z.object({ content: z.string().min(1).max(50000) }),
  })).min(1)
});

export function createGroqRequest(options: {
  env?: Readonly<Record<string, string | undefined>>; fetcher?: typeof fetch; timeoutMs?: number;
} = {}): GroqRequest {
  return async (prompt, input) => {
    if (typeof window !== 'undefined') throw new GroqFailure('configuration');
    const config = groqConfig(options.env);
    if (!config.apiKey) throw new GroqFailure('missing_key');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The deadline covers fetching AND reading the body. No retries that multiply latency/cost.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new GroqFailure('timeout')); }, options.timeoutMs ?? 12000);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await (options.fetcher ?? fetch)(config.endpoint, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model, messages: [
              { role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(input) },
            ], response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 4000
          }),
        });
        if (!response.ok) throw new GroqFailure(response.status === 429 ? 'rate_limit' : 'provider');
        const raw = await response.text();
        if (raw.length > 100000) throw new GroqFailure('invalid_output');
        try {
          const parsed = envelope.parse(JSON.parse(raw));
          let content = parsed.choices[0].message.content.trim();
          if (content.startsWith('```')) {
            content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          }
          return JSON.parse(content) as unknown;
        } catch { throw new GroqFailure('invalid_output'); }
      })()]);
    } catch (error) {
      throw error instanceof GroqFailure ? error : new GroqFailure('network');
    } finally { clearTimeout(timer); }
  };
}
export const requestGroq = createGroqRequest();
export function logFallback(error: unknown) {
  // Never log raw provider errors, prompts, responses, profile fields or credentials.
  console.warn('[Groq] deterministic fallback:', error instanceof GroqFailure ? error.code : 'invalid_output');
}

// Aliases for backward compatibility during transition
export {
  groqConfig as qwenConfig,
  createGroqRequest as createQwenRequest,
  requestGroq as requestQwen,
  GroqFailure as QwenFailure,
};
export type { GroqRequest as QwenRequest };
