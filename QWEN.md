# Qwen personalization

The existing app uses Alibaba Cloud Model Studio's `qwen-plus` for degree suggestions, curated career ranking/explanations, and new learning-plan priorities/practice suggestions. The companion, CV extraction, and pasted/fetched job-description analysis still use the existing Gemini integration.

## Configuration

Add these server-side values securely to `.env.local` or your hosting environment. Never use `NEXT_PUBLIC_` for the API key. Do not copy credential values from the repository's existing `.env.example`.

```dotenv
DASHSCOPE_API_KEY=your_key_here
QWEN_MODEL=qwen-plus
QWEN_REGION=ap-southeast-1
```

`QWEN_MODEL` defaults to `qwen-plus`. `QWEN_REGION` defaults to Singapore (`ap-southeast-1`); Beijing (`cn-beijing`) is also supported. Use a key issued for the selected region. Unknown regions fail safely rather than sending credentials to an arbitrary host. Model availability/quota depends on your Model Studio account. This is a hosted API and may consume paid quota; no request is made by the tests.

| Region | HTTPS endpoint |
| --- | --- |
| `ap-southeast-1` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions` |
| `cn-beijing` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |

Allow the chosen hostname in cloud network settings. Restart `npm run dev` after configuration. No Supabase schema migration, dependency installation, or Gemini configuration change is required.

The implementation uses bearer authorization, OpenAI-compatible `messages`, `response_format: {type: "json_object"}`, `enable_thinking: false`, and a configurable model. JSON mode is not trusted as schema enforcement: strict Zod parsing and candidate validation run locally. Requests have a 12-second overall deadline and no automatic retries. Only server endpoints import the provider at runtime; client references to engine types are erased by TypeScript.

### Official sources checked

The Alibaba documentation web host returned HTTP 403 in this environment. Its official DashScope SDK documentation and implementation were accessible and used to verify the protocol, model, JSON handling, and regional gateways:

- [Official SDK README: supported models and OpenAI-compatible protocol](https://github.com/dashscope/dashscope-sdk-python/blob/main/README.md)
- [Official SDK gateway mapping](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/v2/_config.py)
- [Official OpenAI-compatible protocol adapter](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/v2/protocols/openai.py)
- [Official generation API: qwen-plus and JSON response format](https://github.com/dashscope/dashscope-sdk-python/blob/main/dashscope/aigc/generation.py)
- [Official JSON-mode wire-format test](https://github.com/dashscope/dashscope-sdk-python/blob/main/tests/v2/protocols/test_openai_conformance.py)

These were checked on 2026-10-23. No live Qwen response was verified during implementation because no API key was configured.

## Behavior and boundaries

1. The existing catalogue and deterministic code generate candidates.
2. A minimized profile and those candidates go to Qwen. Names, contact links, raw CVs, experience biographies, project prose and certifications are excluded. Recognized CV skill names are included as uncertain evidence, not demonstrated competence. The existing profile has a NET result but no separate entry-test preference field; this integration adds no new profile fields.
3. Qwen returns strictly validated JSON. Every candidate must appear exactly once; unknown/duplicate IDs, omitted entries, invalid scores, extra fields, empty/truncated output and URLs in generated text are rejected.
4. Ranking uses **90% baseline + 10% Qwen score**, rounded to an integer. This caps score movement at ten points. Percentages are preference estimates, not admission/success probabilities. Legacy `/api/recommendations` scores keep their original scale; additive `degreeRecommendations` provides the normalized result used by the UI.
5. University data never goes through the model. Eligibility, fees, verification flags, `calculateUniversityFit`, university ordering, and the live/static catalogue flow are unchanged.
6. Career candidates remain the six existing example role briefs. Matched skills are self-reported, missing skills need evidence, and recognized CV-only mentions need confirmation. The model can explain these categories but cannot change their arrays or invent roles.
7. New plans keep the existing milestone contract, IDs, progress defaults and deterministic interview preparation. Qwen can reorder skill milestones, suggest practice/projects and select a resource ID valid for that skill. Resource URLs and metadata come from the catalogue; existing deterministic resources remain when no replacement is selected. Unsupported skills use the original generator. The current repository has no Foundations → Intermediate → Advanced → Capstone stage structure; this integration does not manufacture one or alter progress tracking.
8. Any provider/configuration/validation failure returns deterministic data and `source: "deterministic", fallbackUsed: true`. A valid model result returns `source: "qwen", fallbackUsed: false`. Plan provenance is response metadata; the existing persistence schema keeps plan content/progress and strips these extra fields. It does not label historical plans as AI-generated.

The top-level client requests recommendations once per changed profile after a short debounce. Navigation does not itself call the model. Outdated responses are discarded on profile/journey changes; local recommendations remain usable while waiting. Recommendations are advisory: generated explanations are not independent factual verification.

## Genuine model demo

Start the app with a valid Qwen key and the chosen gateway permitted. Then run:

```sh
./node_modules/.bin/tsx scripts/demo-qwen.ts
```

The script sends real requests to the running app for two different students, a career profile and a new roadmap. It prints the returned ranking/explanations and **fails if any response used fallback**. It never submits database writes or changes account/profile data. Inspect the output for meaningful personalization; structural validation alone cannot prove recommendation quality.

In the UI, complete Student onboarding without choosing a degree to see personalized Case B recommendations. Switch to Career for personalized example briefs and their skill evidence. Generate a roadmap through the existing actions to see prioritized milestones. Existing Case A university guidance remains deterministic.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run build`. The Qwen tests mock all model responses, including malformed JSON, invalid IDs/scores, duplicates, timeouts, provider failures, missing keys and valid results. They cover the API contracts, both dashboard cases, career rendering, university protection, and plan/profile schema round-trips. Existing journey tests remain unchanged. Live Supabase authentication/persistence and live model quality require separately configured services.
