import { config } from './server';

export async function callGemini(systemPrompt: string, userContent: string, schema?: object) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI is not configured. GEMINI_API_KEY is missing.');
  
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  
  const body: any = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.2,
    }
  };

  if (schema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = schema;
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Gemini error:', text);
    
    // Hackathon fallback if AI quota is reached or key is invalid
    if (schema) {
      console.warn('Falling back to mock data due to AI provider error.');
      if ((schema as any)?.properties?.skills) {
        return {
          skills: ["JavaScript", "React", "Node.js", "Problem Solving"],
          experience: "Software Developer with 3 years of experience building web applications.",
          projects: "Built a full-stack e-commerce platform.",
          certifications: "AWS Certified Developer",
          links: "github.com/example"
        };
      }
      return {};
    }
    throw new Error('AI provider unavailable.');
  }

  const data = await response.json() as any;
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!reply) throw new Error('Empty AI response.');
  
  if (schema) {
    try {
      return JSON.parse(reply);
    } catch (e) {
      throw new Error('AI returned malformed JSON.');
    }
  }
  
  return reply;
}
