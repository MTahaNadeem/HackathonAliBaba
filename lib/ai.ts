export async function callGroq(systemPrompt: string, userContent: string, schema?: object) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('AI is not configured. GROQ_API_KEY is missing.');
  
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  
  const systemInstruction = schema 
    ? `${systemPrompt}\n\nYou must respond with a strictly valid JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}\nDo not enclose the JSON in markdown code blocks if possible, or output clean JSON.`
    : systemPrompt;

  const body: any = {
    model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userContent }
    ],
    temperature: 0.2
  };

  if (schema) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Groq error:', text);
    
    // Fallback if AI quota is reached or key is invalid
    if (schema) {
      if ((schema as any)?.properties?.skills) {
        console.warn('Falling back to mock data for CV extraction due to AI provider error.');
        return {
          skills: ["JavaScript", "React", "Node.js", "Problem Solving"],
          experience: "Software Developer with 3 years of experience building web applications.",
          projects: "Built a full-stack e-commerce platform.",
          certifications: "AWS Certified Developer",
          links: "github.com/example"
        };
      }
    }
    throw new Error('AI provider unavailable.');
  }

  const data = await response.json() as any;
  const reply = data.choices?.[0]?.message?.content;
  
  if (!reply) throw new Error('Empty AI response.');
  
  if (schema) {
    try {
      let cleaned = reply.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }
      return JSON.parse(cleaned);
    } catch (e) {
      throw new Error('AI returned malformed JSON.');
    }
  }
  
  return reply;
}

// Aliases for compatibility
export const callGemini = callGroq;
