# Groq AI Integration

All AI features in CourseCompass AI are powered by Groq's high-speed inference engine using OpenAI-compatible API endpoints. Gemini and Alibaba Cloud models have been fully replaced.

## Features Powered by Groq
1. **AI Career & Study Companion Chat** (`/api/chat`)
2. **CV & Resume Extraction** (`/api/profile/extract`)
3. **Job Description Gap Analysis** (`/api/jobs/analyse`)
4. **Personalized Degree & Career Ranking** (`/api/recommendations`)
5. **Personalized Learning Roadmap Milestones** (`/api/plans/generate`)

## Configuration

Add these values to `.env.local` or your production deployment environment:

```dotenv
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

### Supported Models on Groq
- `openai/gpt-oss-120b` (Default recommended: high-accuracy 120B reasoning, structured JSON support)
- `qwen/qwen3.8-27b` (High-speed 27B model)
- Any active model listed on your Groq Console dashboard.

### Protocol Details
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Authentication: `Bearer <GROQ_API_KEY>`
- Structured JSON outputs: `response_format: { type: "json_object" }` validated with local strict Zod schemas and deterministic safety fallbacks.
