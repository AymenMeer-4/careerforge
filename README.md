# CareerForge AI

**An AI-powered career-readiness platform that turns a Saudi student's profile into a live, market-aware roadmap to employment.**

CareerForge scores a student across 7 readiness dimensions, generates a personalised roadmap with Claude, and recalibrates it in real time as employers post jobs — connecting students and Saudi employers on one flywheel.

---

## Live demo

- **Live demo URL:** https://careerforge-9pjer93tn-aymen-s-projects4.vercel.app/


## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | `demo.student@careerforge.sa` | `DemoPass123` |
| Corporate | `demo.corp@careerforge.sa` | `CorpPass123` |

Both are created by the seed script (see Setup). The student is fully onboarded with a roadmap, skills, and a verified certificate; the corporate ("Tuwaiq Academy") is verified with 15 seeded jobs.

---

## Features built

| Feature | Status |
|---|---|
| Student signup, onboarding, profile, 7-dimension readiness scoring | ✅ |
| Claude-generated personalised roadmap (timeline view) | ✅ |
| Skills page with AI descriptions + 3-question validation mini-check | ✅ |
| Dynamic simulator (live boost matrix from real jobs) | ✅ |
| Insights, mock interview with AI scoring | ✅ |
| Jobs board, job detail with dual readiness, AI "close the gap" path | ✅ |
| Corporate portal: signup, dashboard, post-job, applicants, AI fit summary | ✅ |
| Certificate AI inspection (Claude Vision) | ✅ |
| Transcript AI extraction (Claude Vision) | ✅ |
| Live market recalibration (corporate posting → student roadmaps + simulator) | ✅ |
| Structured rejection → roadmap gap promotion | ✅ |
| Bilingual UI (English + Arabic) | ✅ |
| Mobile-responsive layout | ❌ Out of scope |
| Real Credly / Wathq API integration | ❌ Out of scope (format validation only) |
| Kanban roadmap view, WebSocket live updates, voice mock interview | ❌ Out of scope |
| Medicine / Engineering cluster content | ❌ Data model supports them; only Tech is seeded |

See [`CareerForge_Build_Spec.md`](./CareerForge_Build_Spec.md) §13 for the full list of explicit cuts.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, TypeScript |
| Database | PostgreSQL (Neon), accessed via `postgres` (postgres.js) |
| Auth | `iron-session` cookies, `bcryptjs` password hashing |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) — Claude Sonnet |
| Email | Resend (interview / offer notifications) |
| Validation | Zod |

## Architecture

CareerForge is a single Next.js app. Route handlers under `app/api/` implement the API; core scoring logic lives in `lib/` (`readiness.ts`, `role-match.ts`, `simulator.ts`, `job-vector.ts`, `points.ts`); Claude prompts live in `lib/prompts/`. The full design — schema, algorithms, and formulas — is documented in [`CareerForge_Build_Spec.md`](./CareerForge_Build_Spec.md).

---

## Setup

```bash
# 1. Clone
git clone https://github.com/AymenMeer-4/careerforge.git
cd careerforge

# 2. Install dependencies
npm install

# 3. Configure environment — copy the template and fill in real values
cp .env.example .env.local

# 4. Apply database migrations to your Neon database
npm run migrate

# 5. Seed demo data (start the dev server first so the roadmap step can run)
npm run dev      # in one terminal
npm run seed     # in another

# 6. Open the app
# http://localhost:3000
```

### Environment variables (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key — powers all Claude integrations |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `RESEND_FROM` | Verified sender address (falls back to `onboarding@resend.dev`) |
| `SESSION_PASSWORD` | `iron-session` cookie encryption secret (min 32 chars) |
| `SEED_BASE_URL` | Dev server origin used by the seed script (default `http://localhost:3000`) |

## Database schema

The schema is defined and versioned as SQL migrations in [`db/migrations/`](./db/migrations). They are idempotent (`IF NOT EXISTS`) and applied in order by `npm run migrate`.

---

## Claude AI integrations

All nine Claude calls and where they live:

| # | Integration | File |
|---|---|---|
| 1 | Roadmap generation | `lib/prompts/roadmap.ts` |
| 2 | Transcript Vision extraction | `lib/prompts/transcript.ts` |
| 3 | Mock interview scoring | `lib/prompts/mock-interview.ts` |
| 4 | AI insight explanation | `lib/prompts/insight-explanation.ts` |
| 5 | Skill description generation | `lib/prompts/skill-description.ts` |
| 6 | Job-specific path suggestion | `lib/prompts/job-path.ts` |
| 7 | Certificate inspection (Vision) | `lib/prompts/cert-inspection.ts` |
| 8 | Skill validation mini-check | `lib/prompts/skill-validation.ts` |
| 9 | Applicant fit summary | `lib/prompts/applicant-fit-summary.ts` |

Shared client and retry/validation helpers: `lib/claude.ts`, `lib/claude-retry.ts`.

---

## Vision 2030 alignment

Saudi Vision 2030 sets a national goal of raising employment and equipping young Saudis for a diversified, technology-driven economy. CareerForge serves that goal directly: it gives students an honest, data-grounded picture of their employment readiness, a concrete roadmap to close real gaps, and a live connection to Saudi employers — while giving those employers a structured, AI-assisted view of local talent. Every readiness number is computed from real evidence (verified certificates, transcripts, validated skills) and recalibrates against actual market demand, so the platform strengthens the student–employer pipeline the Vision depends on.

## License

Released under the [MIT License](./LICENSE).
