# Full-Stack Task Manager (Production Quality)

A portfolio-ready full-stack task manager built to demonstrate real-world fundamentals:
- Next.js (TypeScript) frontend
- Node.js + Express (TypeScript) backend
- PostgreSQL database
- JWT authentication
- Input validation, pagination, Docker, and deployment-ready setup

## Tech Stack
- Frontend: Next.js 14 + TypeScript
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
   - Keep `CORS_ORIGIN` as `https://your-project.vercel.app,https://*.vercel.app` (replace your-project).
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

### API integration tests (Vitest + Supertest)
```bash
npm run test:api
```

### Web E2E tests (Playwright)
1. Install Playwright browser once:
```bash
npx playwright install
```
2. Start web app (and API if your test scenario needs backend):
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
