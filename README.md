# Cobra Studio Backend Assessment — Pet Adoption Board

A REST API built for the Cobra Studio backend developer technical assignment.
The chosen scenario is **Option E — Pet Adoption Board**: users browse
adoptable pets and submit applications; staff manage the catalog and
approve or reject applications.

The architecture, choices, and reasoning live in [`plan.md`](./plan.md).
The AI workflow notes live in [`CLAUDE.md`](./CLAUDE.md) and
[`.cursorrules`](./.cursorrules) — the brief explicitly asks for these.

## Table of contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Data model](#data-model)
- [API endpoints](#api-endpoints)
- [Auth & authorization](#auth--authorization)
- [Business logic](#business-logic)
- [Tests](#tests)
- [Frontend (bonus)](#frontend-bonus)
- [Notable design decisions](#notable-design-decisions)
- [Out of scope](#out-of-scope)

## Quick start

Prereqs: **Node 20+**, **npm 10+**, **Docker** (for Postgres).

```bash
# 1. Postgres in Docker
docker compose up -d

# 2. Backend
cd api
cp .env.example .env
npm install
npm run seed         # drops + recreates schema, inserts sample data
npm run start:dev    # http://localhost:3000

# 3. (Optional) Frontend
cd ../web
cp .env.local.example .env.local
npm install
npm run dev          # http://localhost:3001
```

Demo credentials after `npm run seed`:

| Role  | Email                | Password     |
| ----- | -------------------- | ------------ |
| Staff | `staff@cobra.local`  | `Password1!` |
| User  | `alice@cobra.local`  | `Password1!` |
| User  | `bob@cobra.local`    | `Password1!` |
| User  | `carol@cobra.local`  | `Password1!` |

## Environment variables

Defined in `api/.env.example` and validated at boot via `joi` — the app
refuses to start if anything is missing or malformed.

| Variable             | Required | Default       | Notes                                    |
| -------------------- | -------- | ------------- | ---------------------------------------- |
| `NODE_ENV`           | no       | `development` | `development` \| `test` \| `production`  |
| `PORT`               | no       | `3000`        |                                          |
| `DATABASE_HOST`      | yes      | —             | `localhost` for the bundled compose      |
| `DATABASE_PORT`      | no       | `5432`        |                                          |
| `DATABASE_USER`      | yes      | —             | `cobra` for the bundled compose          |
| `DATABASE_PASSWORD`  | yes      | —             | `cobra` for the bundled compose          |
| `DATABASE_NAME`      | yes      | —             | `cobra_pets` for the bundled compose     |
| `JWT_SECRET`         | yes      | —             | At least 16 chars                        |
| `JWT_EXPIRES_IN`     | no       | `1d`          | Standard JWT duration string             |
| `BCRYPT_COST`        | no       | `10`          | Integer 4–15                             |

The frontend reads `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`)
from `web/.env.local`.

## Data model

Three entities, all UUID primary keys, all `snake_case` columns
(`underscored: true` on every model).

```
users (1)─┐
          ├─< adoption_applications >─┐
pets  (1)─┘                           │
                              decided_by ─→ users
```

### `users`

| column        | type                               | notes                              |
| ------------- | ---------------------------------- | ---------------------------------- |
| id            | `uuid` PK (default `uuidv4`)       |                                    |
| email         | `varchar(255)` UNIQUE              | normalised to lowercase in service |
| password_hash | `varchar(255)`                     | bcryptjs, never returned by API    |
| name          | `varchar(120)`                     |                                    |
| role          | `enum('user','staff')`             | defaults to `user` at the DB layer |
| created_at    | `timestamptz`                      |                                    |
| updated_at    | `timestamptz`                      |                                    |

`User.toJSON` strips `passwordHash` before serialization so it never
escapes the boundary even if a future endpoint forgets to project.

### `pets`

| column      | type                                            | notes |
| ----------- | ----------------------------------------------- | ----- |
| id          | `uuid` PK                                       |       |
| name        | `varchar(120)`                                  |       |
| species     | `varchar(80)`                                   | indexed (composite below) |
| breed       | `varchar(120)` NULL                             |       |
| age_years   | `int` (CHECK ≥ 0)                               |       |
| description | `text`                                          |       |
| status      | `enum('available','pending','adopted')`         | indexed |

Composite index `(status, species)` — covers the public list query.

### `adoption_applications`

| column      | type                                          | notes |
| ----------- | --------------------------------------------- | ----- |
| id          | `uuid` PK                                     |       |
| pet_id      | `uuid` FK → `pets.id`                         | indexed |
| user_id     | `uuid` FK → `users.id`                        | indexed |
| status      | `enum('pending','approved','rejected')`       | default `pending` |
| message     | `text` NULL                                   |       |
| decided_at  | `timestamptz` NULL                            | set on approve/reject |
| decided_by  | `uuid` FK → `users.id` NULL                   | the staff who decided |

**Two partial unique indexes** enforce the business rules at the DB
layer — they make the bad states physically impossible, not just
unlikely:

```sql
CREATE UNIQUE INDEX applications_unique_pending_per_user_pet
  ON adoption_applications (pet_id, user_id) WHERE status = 'pending';

CREATE UNIQUE INDEX applications_unique_pending_per_pet
  ON adoption_applications (pet_id) WHERE status = 'pending';
```

The service layer also checks for these and throws a friendlier 409
*before* the DB hit, so clients get useful error codes
(`CONFLICT` / `APPLICATION_DUPLICATE`-style messages).

## API endpoints

All protected routes require `Authorization: Bearer <jwt>`. Staff-only
routes additionally require `role = 'staff'`.

| Method | Path                                | Auth   | Notes                                            |
| ------ | ----------------------------------- | ------ | ------------------------------------------------ |
| POST   | `/auth/register`                    | public | `{ email, password, name }`                      |
| POST   | `/auth/login`                       | public | `{ email, password }`                            |
| GET    | `/pets`                             | public | `?species=&status=&page=&pageSize=` (status defaults to `available`) |
| GET    | `/pets/:id`                         | public | 404 if missing                                   |
| POST   | `/pets`                             | staff  | `{ name, species, breed?, ageYears, description }` |
| PATCH  | `/pets/:id`                         | staff  | partial update; `adopted` is a one-way state     |
| POST   | `/applications`                     | user   | `{ petId, message? }`                            |
| GET    | `/applications/me`                  | user   | owner-scoped                                     |
| GET    | `/applications`                     | staff  | `?status=&petId=&page=&pageSize=`                |
| POST   | `/applications/:id/approve`         | staff  | triggers the cascade                             |
| POST   | `/applications/:id/reject`          | staff  | flips a single application                       |

### Interactive docs (Swagger / OpenAPI)

When the API is running, point a browser at **http://localhost:3000/docs**.
You'll get a Swagger UI with every endpoint, request/response shapes
(introspected from the `class-validator` DTOs), and an "Authorize"
button — paste a token from `POST /auth/login` and you can hit the
protected endpoints right from the docs page.

### Error envelope

Every error response is wrapped consistently by `AllExceptionsFilter`:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "You have already applied to this pet.",
    "details": null,
    "requestId": "1a2b3c…"
  }
}
```

`code` is the canonical HTTP status name (`NOT_FOUND`, `CONFLICT`,
`UNAUTHORIZED`, …). For `class-validator` failures, `message` becomes
the constant string `"Validation failed."` and `details` carries the
array of field-level messages. Unknown errors are logged server-side
keyed by `requestId` and the client gets a generic 500.

## Auth & authorization

- Registration hashes the password with `bcryptjs` (configurable cost
  via `BCRYPT_COST`) and returns `{ user, accessToken }`.
- Login uses an identical `UnauthorizedException` for both "no such
  user" and "wrong password", and runs a dummy `bcrypt.compare` on the
  missing-user path so timing doesn't leak which emails are registered.
- The JWT payload is `{ sub, email, role }`. `JwtStrategy.validate`
  defensively re-checks the shape after passport-jwt's signature check.
- `JwtAuthGuard` and `RolesGuard` are applied via `@UseGuards`, with
  `@Roles('staff')` providing role-based gates.
- Owner-scoped reads (e.g. `GET /applications/me`) filter by `user_id`
  in the **service** query, never via controller logic.

## Business logic

The `ApplicationsService` carries the rules. All write paths run inside
a single Sequelize transaction with the relevant pet row locked
`FOR UPDATE`, so concurrent submissions on the same pet can't race past
the checks.

### Submit

1. Lock the pet row. 404 if missing.
2. 409 if pet status ≠ `available`.
3. 409 if the same user already has *any* application for this pet
   (regardless of past status — "a user cannot apply for the same pet
   twice").
4. 409 if a different user already has a `pending` application — "a pet
   may only have one active application at a time".
5. Insert with status `pending`. The pet stays `available`. (See
   *Notable design decisions* for the rationale.)

### Approve (the cascade)

1. Load + lock the application and the pet.
2. 409 if the application is no longer pending.
3. Set application: `status = 'approved'`, `decided_at = now()`,
   `decided_by = staff.id`.
4. Set pet: `status = 'adopted'`.
5. Bulk-update every other pending application for the pet:
   `status = 'rejected'` with the same `decided_at` / `decided_by`.

### Reject

Just flips the single application; no effect on the pet.

## Tests

```bash
cd api
npm test          # 17 unit specs
npm run test:e2e  # full happy-path E2E (skips with a warning if no Postgres)
```

- **Unit** specs mock the Sequelize layer and pin every plan rule for
  `ApplicationsService` (cascade, duplicate, race) and `AuthService`
  (hash, normalisation, dual-error login).
- **E2E** runs `register → apply → second-apply rejected → rival
  rejected → staff approves → pet adopted`. It uses the live Postgres
  pointed at by `DATABASE_*`; point it at a *separate* test database
  because it `sync({force:true})`s the schema. The suite skips itself
  cleanly if Postgres isn't reachable, so unit-only CI runs stay green.

## Frontend (bonus)

A minimal Next.js 14 App Router app under `web/`:

- `/`, `/login`, `/register`
- `/pets` — paginated grid with species filter
- `/pets/[id]` — detail + Apply form (gated on auth + pet status)
- `/applications` — owner-scoped list of my applications
- `/staff` — pending queue with one-click Approve / Reject

Token in `localStorage` via a tiny `AuthProvider` context. Vanilla CSS
themed to match the Cobra dark/red brand. No state library, no
component kit — kept deliberately small to leave the focus on the
backend.

## Notable design decisions

- **Pet stays `available` while pending applications exist.** The brief
  only explicitly says *approval* marks the pet `adopted`. Keeping it
  `available` keeps the public catalog useful, and the partial unique
  indexes already prevent duplicate or competing pending applications.
  Easy to flip the convention later — it's a single line in
  `ApplicationsService.submit`.
- **Uniqueness enforced at *both* layers.** The DB carries partial
  unique indexes so bad data is physically impossible; the service
  pre-checks so clients get a friendly `CONFLICT` instead of a raw
  Sequelize error. Defence-in-depth, two cheap checks.
- **UUID primary keys.** No enumeration via sequential IDs in URLs.
- **Two roles instead of a roles table.** `user` and `staff` cover the
  brief; a roles table would be over-engineering for a 24-hour
  assessment. Easy to extend.
- **`bcryptjs` instead of native `bcrypt`.** Pure-JS so the install is
  portable across machines (no `node-gyp`, no prebuilt binary). Cost 10
  is plenty here; tunable via env.
- **JWT role is trusted for the token's lifetime.** `JwtStrategy.validate`
  reads `role` from the payload rather than re-fetching the user on every
  request. A user demoted from staff to user keeps staff access until
  their token expires (default 1d). Trade-off: zero DB round-trips per
  request vs. a small staleness window. Mitigations if this matters:
  shorten `JWT_EXPIRES_IN`, swap the strategy to do a DB lookup, or add
  a revocation list. Marked here so reviewers don't have to spelunk for
  it.
- **`sync({force:true})` in dev, no migrations.** Migrations would be
  the right call for production; for an assessment-grade project, the
  seed script's drop-and-recreate flow is faster to iterate on. Plan
  notes how to add migrations when this graduates.
- **`.js` extensions in TS imports.** `tsconfig` uses
  `module: nodenext`. Jest's `moduleNameMapper` strips the suffix so
  the same source imports work for both the build and the tests.
- **Swagger via the `@nestjs/swagger` CLI plugin.** Rather than
  decorating every DTO field with `@ApiProperty` by hand, we enable
  the plugin in `nest-cli.json`. It introspects the existing
  `class-validator` decorators at build time and feeds them into the
  generated OpenAPI document, so the DTOs stay clean and the spec
  stays accurate without duplication.

## Out of scope

Deliberately omitted with no half-implementations left behind:

- Email verification / password reset
- Refresh tokens (single short-lived JWT is fine for this scope)
- Pet image uploads
- Audit log table
- Rate limiting (one-liner with `@nestjs/throttler` if asked)
- i18n

## AI workflow

Per the brief, this repo includes the AI tool config files used during
development: [`CLAUDE.md`](./CLAUDE.md) (the canonical guide) and
[`.cursorrules`](./.cursorrules). Commits are authored by Riquelmy
Melara — no AI co-author trailers. Each module landed in its own
commit so the history reads as the logical progression, not as a
`git push -f` lump.

## Repository layout

```
plan.md                           architecture decisions, source of truth
CLAUDE.md                         AI workflow notes (also .cursorrules)
README.md                         this file
docker-compose.yml                Postgres 16 for local dev
api/                              NestJS app
  src/
    main.ts                       bootstrap + global pipe + global filter
    app.module.ts                 root module + DB wiring
    common/
      decorators/                 @CurrentUser, @Roles
      enums/                      role / pet-status / application-status
      filters/                    AllExceptionsFilter
      guards/                     JwtAuthGuard, RolesGuard
      types/                      AuthUser, JwtPayload
    config/                       env validation (joi) + DB factory
    database/seed.ts              ts-built drop-and-recreate seed
    modules/
      auth/                       register, login, JWT strategy, DTOs
      users/                      User model + module
      pets/                       model, service, controller, DTOs
      applications/               the business-logic-heavy module
  test/app.e2e-spec.ts            full happy-path E2E
web/                              Next.js 14 frontend (bonus)
```
