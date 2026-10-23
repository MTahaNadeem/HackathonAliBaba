// Server entry points only. Never import this module from a client component.
import { z } from 'zod';

const endpoints = {
  'ap-southeast-1': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
  'cn-beijing': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
} as const;
export type QwenRequest = (prompt: string, input: unknown) => Promise<unknown>;
export class QwenFailure extends Error {
  constructor(public readonly code: 'missing_key' | 'configuration' | 'timeout' | 'network' | 'rate_limit' | 'provider' | 'invalid_output') {
    super(code);
  }
}

export function qwenConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  const region = env.QWEN_REGION || 'ap-southeast-1';
  if (!(region in endpoints)) throw new QwenFailure('configuration');
  const model = env.QWEN_MODEL || 'qwen-plus';
  if (!/^qwen-[a-zA-Z0-9.-]+$/.test(model)) throw new QwenFailure('configuration');
  return { endpoint: endpoints[region as keyof typeof endpoints], model, apiKey: env.DASHSCOPE_API_KEY };
}

const envelope = z.object({ choices: z.array(z.object({
  finish_reason: z.literal('stop'),
  message: z.object({ content: z.string().min(1).max(50000) }),
})).length(1) });

export function createQwenRequest(options: {
  env?: Readonly<Record<string, string | undefined>>; fetcher?: typeof fetch; timeoutMs?: number;
} = {}): QwenRequest {
  return async (prompt, input) => {
    if (typeof window !== 'undefined') throw new QwenFailure('configuration');
    const config = qwenConfig(options.env);
    if (!config.apiKey) throw new QwenFailure('missing_key');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The deadline covers fetching AND reading the body. No retries that multiply latency/cost.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new QwenFailure('timeout')); }, options.timeoutMs ?? 12000);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await (options.fetcher ?? fetch)(config.endpoint, {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: config.model, messages: [
            { role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(input) },
          ], response_format: { type: 'json_object' }, enable_thinking: false, temperature: 0.2, max_tokens: 4000 }),
        });
        if (!response.ok) throw new QwenFailure(response.status === 429 ? 'rate_limit' : 'provider');
        const raw = await response.text();
        if (raw.length > 100000) throw new QwenFailure('invalid_output');
        try {
          const parsed = envelope.parse(JSON.parse(raw));
          return JSON.parse(parsed.choices[0].message.content) as unknown;
        } catch { throw new QwenFailure('invalid_output'); }
      })()]);
    } catch (error) {
      throw error instanceof QwenFailure ? error : new QwenFailure('network');
    } finally { clearTimeout(timer); }
  };
}
export const requestQwen = createQwenRequest();
export function logFallback(error: unknown) {
  // Never log raw provider errors, prompts, responses, profile fields or credentials.
  console.warn('[Qwen] deterministic fallback:', error instanceof QwenFailure ? error.code : 'invalid_output');
}
