# CourseCompass Ai — Your next chapter

A career and learning navigator for students in Pakistan, spanning intermediate and O/A-level pathways through undergraduate study and job preparation.

**Explore → choose a direction → understand requirements → build skills → save a practical plan.**

- Nine cross-disciplinary degree paths with comparison and trial activities.
- University exploration with location/budget filters, source links, IBCC-aware checks and a limited sourced NET calculator.
- Pasted-job skill analysis and clearly labelled example role briefs.
- Free learning resources connected to practice tasks, progress and Markdown export.
- Contextual Gemini adviser with consent and an explicitly labelled guided fallback.
- Supabase authentication and PostgreSQL persistence with RLS; temporary guest mode when unconfigured.

Stack: React, TypeScript, Next.js, Tailwind, shadcn/Base UI, Supabase PostgreSQL, optional free-tier Gemini. A separate Vinext adapter supports Sites hosting. No paid APIs are required. No SQLite replacement or fake cloud-save success.

See [SETUP.md](SETUP.md) for configuration and boundaries, [BUILD_PROMPT.md](BUILD_PROMPT.md) for the full product brief, [DESIGN.md](DESIGN.md) for art direction, and [DEMO.md](DEMO.md) for the presentation.

```sh
npm ci
# configure .env.local using .env.example
npm run dev
npm test
npm run typecheck
npm run build
```

Repository: https://github.com/syed-haseeb-badshah/AliBabaHackathon

Official data and resource URLs are stored in `lib/catalogue.ts`. There is no live vacancy integration; example role briefs are never presented as real hiring opportunities. Admission and employment decisions remain with the institutions and employers.
