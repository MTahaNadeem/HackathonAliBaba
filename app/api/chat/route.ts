import { body, failure, ApiError, sameOrigin, config, userClient } from '@/lib/server';
import { chatSchema } from '@/lib/validation';
import { guidedReply, adviserInstructions } from '@/lib/adviser';

const buckets = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const parsed = chatSchema.safeParse(await body(req));
    if (!parsed.success) throw new ApiError(400, 'Please keep your question under 2,000 characters.');
    const p = parsed.data;
    const fallback = guidedReply(p.message, p.goal);

    if (!p.consent || !process.env.GROQ_API_KEY) {
      return Response.json({
        reply: fallback,
        mode: 'Guided adviser',
        reason: p.consent ? 'AI is not configured.' : 'AI sharing is off.'
      });
    }

    const c = config();
    let identity = 'private-guest';
    if (c.supabaseUrl && c.supabaseKey) {
      const { user } = await userClient(req);
      identity = user.id;
    }

    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.until < now) buckets.delete(k);
    }
    const bucket = buckets.get(identity) || { count: 0, until: now + 3600000 };
    if (bucket.count >= 15) {
      return Response.json({
        reply: fallback,
        mode: 'Guided adviser',
        reason: 'The hourly AI limit has been reached.'
      });
    }
    bucket.count++;
    buckets.set(identity, bucket);

    try {
      const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      if (!/^[a-zA-Z0-9._/-]+$/.test(model)) throw new Error('invalid model');

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: adviserInstructions },
            { role: 'user', content: JSON.stringify({ message: p.message, goal: p.goal, skills: p.skills }) }
          ],
          max_tokens: 1200,
          temperature: 0.5
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) throw new Error('provider unavailable');
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error('empty response');
      return Response.json({ reply: reply.slice(0, 6000), mode: 'Groq adviser' });
    } catch {
      return Response.json({
        reply: fallback,
        mode: 'Guided adviser',
        reason: 'Groq could not respond. This is a rule-based response; no paid fallback was used.'
      });
    }
  } catch (e) {
    return failure(e);
  }
}
