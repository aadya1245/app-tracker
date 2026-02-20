# Intern Application Tracker (Portfolio Project)

A full-stack project built for SWE internship applications when you have no prior work experience.

## Why this project
This project mirrors what gets noticed in internship portfolios:
- End-to-end ownership: frontend, backend, database, auth, and API design.
- Real product workflow: register/login, create/read/update/delete, and status tracking.
- Measurable outcomes: stats endpoint and dashboard counts.
- Clean engineering signals: TypeScript, environment variables, modular code, and clear setup docs.

## Online research summary (what people use)
Current sources consistently point to building deployed, full-stack projects using mainstream stacks and showing product thinking, not just algorithm repos.

1. GitHub Octoverse 2025 reports TypeScript reached #1 by monthly contributors on GitHub, with JavaScript and Python also dominant.
   - [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)
2. Stack Overflow's 2024 Developer Survey still shows JavaScript as the most-used language and TypeScript in the top group.
   - [Stack Overflow 2024 Survey Press Summary](https://stackoverflow.co/company/press/archive/stack-overflow-2024-developer-survey-gap-between-ai-use-trust/)
3. Current 2026 SWE intern postings frequently list React, TypeScript, Node.js, REST APIs, and SQL among preferred/required skills.
   - [Tripadvisor SWE Intern (2026)](https://www.newyork-tech.com/software-engineering-internship-summer-2026-needham-ma/)
   - [Roblox SWE Intern (2026)](https://www.newyork-tech.com/software-engineer-intern-2026/)
4. The `project-based-learning` and `build-your-own-x` repos (widely used by students) reflect strong demand for projects that ship complete products and demonstrate systems depth.
   - [project-based-learning](https://github.com/practical-tutorials/project-based-learning)
   - [build-your-own-x](https://github.com/codecrafters-io/build-your-own-x)
5. Student experience threads repeatedly mention internship outcomes from deployed CRUD/full-stack apps and practical tools they could explain deeply.
   - [r/csMajors discussion](https://www.reddit.com/r/csMajors/comments/jz3r7s/)
   - [r/cscareerquestions discussion](https://www.reddit.com/r/cscareerquestions/comments/v5si2w)

## Tech stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: SQLite (`better-sqlite3`)
- Auth: JWT + bcrypt password hashing

## Features
- Email/password registration and login
- JWT-protected API routes
- CRUD for internship applications
- Status board (`applied`, `oa`, `interview`, `offer`, `rejected`)
- Pipeline stats endpoint and dashboard snapshot

## Local setup

```bash
npm install
cp server/.env.example server/.env
npm run dev:server
npm run dev:client
```

- API runs at `http://localhost:4000`
- Client runs at `http://localhost:5173`

## API overview
- `POST /auth/register`
- `POST /auth/login`
- `GET /applications` (auth required)
- `POST /applications` (auth required)
- `PATCH /applications/:id` (auth required)
- `DELETE /applications/:id` (auth required)
- `GET /stats` (auth required)

## Testing
```bash
npm test
```

- Backend tests: registration/login/auth guards + CRUD/stats flow.
- Frontend tests: logged-out auth screen smoke test.

## CI
- GitHub Actions workflow: `/Users/aadyamadgula/Documents/New project/.github/workflows/ci.yml`
- Runs on every push and pull request:
  1. `npm ci`
  2. `npm test`
  3. `npm run build`

If your repo does not yet include `package-lock.json`, run `npm install` once locally and commit the lockfile so `npm ci` works in CI.

## How to present this on your resume
- Built and shipped a full-stack internship-tracking dashboard with React, TypeScript, Express, and SQLite.
- Implemented JWT auth and secure password hashing, plus protected CRUD APIs for application lifecycle management.
- Designed analytics endpoints and board-style UI to visualize funnel conversion from applied to offer.

## Next upgrades (to stand out more)
1. Add automated tests (API integration + UI smoke tests).
2. Add CI (GitHub Actions) to run build/tests on pull requests.
3. Deploy client + API and add a live demo URL.
4. Add OAuth (Google/GitHub) and role-based permissions.
