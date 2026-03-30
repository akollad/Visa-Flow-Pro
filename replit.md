# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Joventy.cd

Premium visa assistance SaaS for the Democratic Republic of Congo (RDC/DRC).

**Demo accounts:**
- Admin: `admin@joventy.cd` / `admin123`
- Client: `client@joventy.cd` / `admin123`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Forms**: react-hook-form + @hookform/resolvers
- **Charts**: recharts
- **Animations**: framer-motion

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── joventy/            # Joventy.cd frontend (React + Vite) — served at /
│   └── api-server/         # Express API server — served at /api
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Joventy.cd Features

### Authentication (session-based, HTTP-only cookies)
- `POST /api/auth/register` — register new client
- `POST /api/auth/login` — login
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — get current user

### Roles
- `client` — can manage their own visa applications, chat with admin
- `admin` — can see all applications, update statuses, chat with clients

### Pages

**Public:**
- `/` — Landing page (French, premium institutional design)
- `/login` — Login
- `/register` — Registration

**Client (`/dashboard/*`):**
- `/dashboard` — Overview with active applications
- `/dashboard/applications` — List of applications
- `/dashboard/applications/new` — Multi-step application form
- `/dashboard/applications/:id` — Application detail + chat

**Admin (`/admin/*`):**
- `/admin` — Stats dashboard (recharts)
- `/admin/applications` — All applications with filters
- `/admin/applications/:id` — Detail, status update, chat
- `/admin/clients` — Client list

### Destinations & Visa Types
- **USA**: B1/B2, F1, K1, H1B, J1
- **Dubai**: Touriste 30j, Touriste 60j, Résidence, Affaires
- **Turkey**: Touriste, Affaires, Étudiant
- **India**: e-Visa Touriste, Affaires, Médical

### Application Statuses
`draft` → `submitted` → `in_review` → `appointment_scheduled` → `approved/rejected`

## Database Schema

### Tables
- `users` — id, email, password_hash, first_name, last_name, phone, role (client|admin)
- `applications` — id, user_id, applicant_name, destination, visa_type, status, appointment_date, notes, admin_notes, passport_number, travel_date, return_date, purpose, price, is_paid
- `messages` — id, application_id, user_id, content, is_from_admin, is_read

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/joventy` (`@workspace/joventy`)
React + Vite frontend. Served at `/`.

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server. Routes in `src/routes/`.
- Auth: `src/routes/auth.ts`
- Applications + Messages: `src/routes/applications.ts`
- Admin: `src/routes/admin.ts`
- Middleware: `src/middlewares/requireAuth.ts`
- Password hashing: `src/lib/auth.ts` (Node.js crypto/scrypt)

### `lib/db` (`@workspace/db`)
Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec + Orval codegen config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
