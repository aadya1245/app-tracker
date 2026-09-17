# SprintPilot

An AI-assisted implementation planner built into a full-stack task manager. Describe a feature, let the agent inspect your backlog, review a plan with acceptance criteria and dependencies, then approve selected tasks.

**Status:** working demo workflow and configurable live Anthropic adapter. Demo is a deterministic template; live inference needs your own API key and model ID. No live model quality results are claimed.

- [Research and project decision](docs/PROJECT_DECISION.md)
- [Architecture, limits, and tradeoffs](docs/ARCHITECTURE.md)

## Try SprintPilot

1. Run `npm ci` and `docker compose up -d db`.
2. Copy `api/.env.example` to `api/.env`; start `npm run dev:api`.
3. In another terminal, start `npm run dev:web` and open `http://localhost:3000`.
4. Register, enter a feature request, and choose **Demo template**.
5. Create a plan, inspect assumptions and activity, and approve the selected tasks.
6. Find the tasks in your backlog and reopen the saved plan in Recent plans.

For live AI, set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` to a model available in your Anthropic account, then restart the API and reload the page. The server sends the goal and retrieved backlog to that provider. Keys are never entered in the browser.

## Agent API

All routes below require the existing bearer token.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/agent/config` | Check live-provider availability |
| POST | `/api/v1/agent/runs` | `{goal, mode: "demo" or "live", requestId: UUID}` |
| GET | `/api/v1/agent/runs` | Most recent 20 owned runs |
| GET | `/api/v1/agent/runs/:id` | Owned run, evidence, proposal, and activity |
| POST | `/api/v1/agent/runs/:id/decision` | `{action: "approve" or "reject", selectedIndices: [0,1,2]}` |

Run-creation retries must reuse the same UUID and input. Repeated identical approvals reuse the created tasks. Review prerequisites before selecting a subset. The API initializes the additive `agent_runs` schema on startup, including for existing databases.

## Existing task-manager foundation

The application retains its existing foundation:
- Next.js (TypeScript) frontend
- Node.js + Express (TypeScript) backend
- PostgreSQL database
- JWT authentication
- Input validation, pagination, Docker, and deployment-ready setup

## Tech Stack
- Frontend: Next.js 14.2.35 + TypeScript
- Backend: Express + TypeScript
- Database: PostgreSQL (`pg`)
- Auth: JWT + bcrypt password hashing
- Validation: Zod
- Infrastructure: Docker + Docker Compose
- Deployment: Render blueprint (`render.yaml`) or AWS (ECS/Fargate + RDS)

## Project Structure

```txt
.
├── api/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── web/
│   ├── app/
│   ├── src/components/
│   ├── src/lib/
│   ├── .env.example
│   ├── Dockerfile
│   ├── next.config.mjs
│   ├── package.json
│   └── tsconfig.json
├── docker/postgres/init.sql
├── docker-compose.yml
├── render.yaml
└── README.md
```

## Features
- User registration and login with hashed passwords
- JWT-protected API endpoints
- Task CRUD scoped to authenticated user
- Paginated task listing (`page`, `limit`)
- Input validation for body/query params
- Centralized error handling
- Dockerized local dev/prod-like setup

## Environment Variables

Copy `.env.example` values into runtime envs.

### API
- `PORT` (default: `4000`)
- `NODE_ENV` (`development` | `production`)
- `DATABASE_URL` (PostgreSQL connection string)
- `JWT_SECRET` (minimum 16 chars)
- `JWT_EXPIRES_IN` (example: `1d`)
- `CORS_ORIGIN` (example: `http://localhost:3000`)

### Web
- `NEXT_PUBLIC_API_URL` (example: `http://localhost:4000/api/v1`)

## API Endpoints

Base URL: `http://localhost:4000/api/v1`

### Auth
- `POST /auth/register`
- `POST /auth/login`

### Tasks (requires `Authorization: Bearer <token>`)
- `GET /tasks?page=1&limit=10`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start PostgreSQL with Docker:
```bash
docker compose up -d db
```

3. Run API:
```bash
cp api/.env.example api/.env
npm run dev:api
```

4. Run web app:
```bash
cp web/.env.example web/.env.local
npm run dev:web
```

5. Open:
- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`

## Run Entire Stack with Docker

```bash
docker compose up --build
```

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`

## Deployment

### Vercel + Render + Neon (Recommended)
1. Create a Neon PostgreSQL database and copy its connection string.
2. Push this repository to GitHub.
3. Render:
   - Create service from `render.yaml` (backend only).
   - Set `DATABASE_URL` to Neon connection string.
   - Set `JWT_SECRET` to a strong value.
   - Keep `CORS_ORIGIN` as `https://your-project.vercel.app` (replace your-project).
4. Vercel:
   - Import this repo with Root Directory `web`.
   - Set `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api/v1`.
   - Deploy.
5. Update Render `CORS_ORIGIN` with your final Vercel production URL and redeploy backend.

### AWS (Production Path)
- Build and push API/web images to ECR.
- Run API + web on ECS Fargate.
- Use RDS PostgreSQL.
- Set env vars in ECS task definitions.
- Place ALB in front of services and configure domain + HTTPS via ACM.

## Quality Notes
- Validation handled with Zod for auth/task payloads and pagination query params.
- Task listing is paginated and returns metadata (`totalPages`, `hasNextPage`, etc.).
- Errors are normalized through centralized middleware.
- SQL queries are parameterized to avoid injection.
- API tests cover auth validation/token flow and protected paginated task listing behavior.
- Web E2E tests cover landing/auth screen rendering and auth mode switching.

## Testing

### API and agent tests (Vitest, Supertest, PGlite)

The agent integration suite uses real PostgreSQL compiled to WASM in memory. It tests SQL persistence, isolation, replay, limits, and rollback without Docker. Provider HTTP is mocked; live model quality is not measured.
```bash
npm run test:api
```

### Web E2E tests (Playwright)
1. Install Playwright browser once:
```bash
npx playwright install
```
2. The Playwright config starts the web app automatically. To run manually:
```bash
npm run dev:web
```
3. Run E2E:
```bash
npm run test:web:e2e
```

### Run all tests
```bash
npm test
```

## Useful Scripts
At repo root:
- `npm run dev:api`
- `npm run dev:web`
- `npm run build`
- `npm run lint`
- `npm run test:api`
- `npm run test:web:e2e`
- `npm test`
