# Cobra Studio — Backend Technical Assignment

## Scenario: Option E — Pet Adoption Board

Users browse pets available for adoption and submit applications. Staff users
manage the catalog and approve/reject applications.

### Why this scenario

It exercises every evaluation axis in the brief at once:

- **Authorization, not just authentication** — staff vs regular user role check
  on top of JWT identity, plus owner-scoped reads on applications.
- **Business logic with side effects** — approving an application has to
  update the pet's status and cascade-reject every other open application for
  that pet. That is the kind of rule that belongs in a service layer wrapped
  in a transaction, and it is easy to get wrong.
- **Data model judgment** — uniqueness constraints (one active application per
  user/pet pair), enums for pet status and application status, and useful
  indexes for the public listing.
- **Pagination + filtering** — public pet list paginated and filterable by
  species.

## Stack

| Concern        | Choice                                              | Why                                                                        |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Runtime        | Node.js 20 LTS                                      | Current LTS; native `fetch`, stable performance.                           |
| Framework      | NestJS 10                                           | Required by brief; modular DI maps cleanly to the "one concern per module" rule. |
| Language       | TypeScript 5, `strict: true`                        | Hard requirement. Also enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. |
| ORM            | Sequelize v6 + `sequelize-typescript`               | Required by brief.                                                         |
| Database       | PostgreSQL 16 (via Docker)                          | Required relational engine; enums + partial indexes help us enforce business rules at the DB layer. |
| Auth           | `@nestjs/jwt` + `bcrypt`                            | Stateless JWT, hashed passwords. Roles enforced via custom guard.          |
| Validation     | `class-validator` + `class-transformer` + global `ValidationPipe` | DTO-level validation, whitelisted properties, automatic transformation.    |
| Errors         | Global `AllExceptionsFilter` returning a structured envelope | Consistent shape across thrown HttpExceptions, validation errors, and unexpected errors. |
| Testing        | Jest (unit) + `supertest` (E2E)                     | Bonus item we opted into.                                                  |
| Frontend       | Next.js 14 (App Router) + Tailwind                  | Bonus item we opted into. Co-located in `/web`.                            |
| Lint/format    | ESLint + Prettier (Nest defaults, tightened)        | Standard.                                                                  |
| Container      | `docker-compose.yml` for Postgres only              | Keeps local setup to one command.                                          |

Skipped on purpose: Swagger. Easy to add later (a few decorators) but the user
opted out. Noted in README as a future addition.

## Repository layout

```
/
  api/                          NestJS app
    src/
      app.module.ts
      main.ts                   bootstrap, global pipes/filters
      common/
        decorators/
          current-user.decorator.ts
          roles.decorator.ts
        guards/
          jwt-auth.guard.ts
          roles.guard.ts
        filters/
          all-exceptions.filter.ts
        types/                  shared types (JwtPayload, etc.)
      config/
        env.validation.ts       Joi/zod schema for env
        database.config.ts
      modules/
        auth/                   register, login, JwtStrategy
        users/                  User model + repo (no public CRUD)
        pets/                   Pet model, controller, service, dtos
        applications/           Application model, controller, service, dtos
      database/
        seed.ts                 ts-node seed script
    test/                       E2E tests
    .env.example
    package.json
    tsconfig.json               strict + noUncheckedIndexedAccess
  web/                          Next.js frontend
    app/
      (auth)/login, (auth)/register
      pets/, pets/[id]
      applications/
      staff/
    lib/api.ts                  thin fetch wrapper with token
  docker-compose.yml            postgres only
  README.md
  CLAUDE.md                     AI workflow notes (required deliverable)
  .cursorrules                  same conventions, Cursor format
  plan.md                       this file
```

Two top-level packages (`api`, `web`) instead of a monorepo tool — the
projects are small enough that adding pnpm/turbo is overkill.

## Data model

### `users`

| column          | type                         | notes                                       |
| --------------- | ---------------------------- | ------------------------------------------- |
| `id`            | `uuid` PK                    | `gen_random_uuid()` default                 |
| `email`         | `citext` UNIQUE NOT NULL     | case-insensitive uniqueness                 |
| `password_hash` | `text` NOT NULL              | bcrypt, never returned by API               |
| `name`          | `text` NOT NULL              |                                             |
| `role`          | `enum('user','staff')` NOT NULL DEFAULT `'user'` |                                             |
| `created_at`    | `timestamptz` NOT NULL       |                                             |
| `updated_at`    | `timestamptz` NOT NULL       |                                             |

### `pets`

| column         | type                                                   | notes                                       |
| -------------- | ------------------------------------------------------ | ------------------------------------------- |
| `id`           | `uuid` PK                                              |                                             |
| `name`         | `text` NOT NULL                                        |                                             |
| `species`      | `text` NOT NULL                                        | indexed; freeform string for flexibility    |
| `breed`        | `text`                                                 |                                             |
| `age_years`    | `int` NOT NULL CHECK >= 0                              |                                             |
| `description`  | `text` NOT NULL                                        |                                             |
| `status`       | `enum('available','pending','adopted')` NOT NULL DEFAULT `'available'` | indexed                                     |
| `created_at`   | `timestamptz`                                          |                                             |
| `updated_at`   | `timestamptz`                                          |                                             |

Index: `(status, species)` — covers the public list query.

### `adoption_applications`

| column         | type                                                  | notes                                       |
| -------------- | ----------------------------------------------------- | ------------------------------------------- |
| `id`           | `uuid` PK                                             |                                             |
| `pet_id`       | `uuid` FK → pets.id ON DELETE CASCADE                 |                                             |
| `user_id`      | `uuid` FK → users.id ON DELETE CASCADE                |                                             |
| `status`       | `enum('pending','approved','rejected')` NOT NULL DEFAULT `'pending'` |                                             |
| `message`      | `text`                                                | optional applicant note                     |
| `decided_at`   | `timestamptz`                                         | set when approved/rejected                  |
| `decided_by`   | `uuid` FK → users.id                                  | the staff user who decided                  |
| `created_at`   | `timestamptz`                                         |                                             |
| `updated_at`   | `timestamptz`                                         |                                             |

Constraints:

- **Partial unique index** on `(pet_id, user_id) WHERE status = 'pending'` →
  enforces "no duplicate active application by the same user on the same pet"
  at the DB layer. Service layer also checks for a friendlier error.
- **Partial unique index** on `(pet_id) WHERE status = 'pending'` would be too
  strict — the brief says the *pet* may have only one active application, but
  re-reading: "A pet may only have one active (pending) application at a time."
  So yes, this constraint is correct. Add it.
- Plain index on `user_id` for "view my applications".

## Endpoints

All protected routes require `Authorization: Bearer <jwt>`. Staff-only routes
additionally require `role = 'staff'`.

### Auth

- `POST /auth/register` — `{email, password, name}` → `{user, accessToken}`
- `POST /auth/login` — `{email, password}` → `{user, accessToken}`

### Pets

- `GET /pets` — public. Query: `species?`, `status?` (default `available`),
  `page?` (default 1), `pageSize?` (default 20, max 100). Returns
  `{data, page, pageSize, total}`.
- `GET /pets/:id` — public. 404 if not found.
- `POST /pets` — staff. `{name, species, breed?, ageYears, description}`.
- `PATCH /pets/:id` — staff. Partial update; status transitions validated.

### Applications

- `POST /applications` — authenticated. `{petId, message?}`.
  Rejects if pet not `available`, if the user already has an application for
  this pet (pending or otherwise — see business rules below), or if there is
  already a pending application from anyone on this pet.
- `GET /applications/me` — authenticated. Lists the caller's applications.
- `GET /applications` — staff. Lists all applications, filterable by
  `status` and `petId`.
- `POST /applications/:id/approve` — staff. Triggers the cascade.
- `POST /applications/:id/reject` — staff.

## Auth & authorization

- `JwtAuthGuard` applied at controller or method level via `@UseGuards`.
- `RolesGuard` reads metadata from `@Roles('staff')` decorator. Throws
  `ForbiddenException` (403) when role mismatches.
- `@CurrentUser()` parameter decorator extracts the authenticated user from
  the request — service methods then enforce ownership where relevant
  (`/applications/me` filters by `user_id`).
- Passwords are hashed with bcrypt at cost 10 in dev, configurable via env.
- JWT secret and expiry from env. Default expiry 1 day.
- The `User` model has a `toJSON` override that strips `password_hash`. We
  also never select it in non-auth queries.

## Business logic (the part that will be read carefully)

### Submit application — `ApplicationsService.submit(user, dto)`

Inside a transaction:

1. Lock pet row (`SELECT ... FOR UPDATE`). 404 if missing.
2. Reject (409) if pet status is not `available`.
3. Reject (409) if the user already has *any* application for this pet
   (even if previously rejected — the brief says "A user cannot apply for the
   same pet twice").
4. Reject (409) if a different user already has a `pending` application — the
   brief allows only one active application per pet.
5. Insert the application with status `pending`.
6. *Do not* change the pet status here. The pet remains `available` until
   approval. (Alternative: flip to `pending` on first application. Brief is
   ambiguous; leaving it `available` keeps the listing useful and matches the
   wording "marks the pet as adopted" only on approval.) Document this
   decision in README.

### Approve — `ApplicationsService.approve(staff, applicationId)`

Inside a transaction:

1. Load application + lock pet row.
2. 404 if application missing. 409 if not in `pending` state.
3. Set application: `status = 'approved'`, `decided_at = now()`,
   `decided_by = staff.id`.
4. Set pet: `status = 'adopted'`.
5. Bulk update every *other* application on this pet still in `pending` →
   `status = 'rejected'`, with `decided_at`/`decided_by` set, and a system
   note in `message` if helpful (TBD).

### Reject — `ApplicationsService.reject(staff, applicationId)`

Just flips this single application. No effect on the pet.

### Edge cases the tests will cover

- Duplicate apply by same user → 409.
- Two users apply, first stays pending, second blocked → 409.
- Approval cascade actually rejects siblings.
- Non-staff calling `POST /pets` → 403 (not 401, which would just say "log in").
- User A reading user B's applications → 404, not 403, to avoid leaking
  existence.
- Pet status validation: cannot manually flip an `adopted` pet back to
  `available` via PATCH (state machine in service).

## Error response shape

```json
{
  "error": {
    "code": "APPLICATION_DUPLICATE",
    "message": "You have already applied to this pet.",
    "details": null,
    "requestId": "..."
  }
}
```

`AllExceptionsFilter` maps `HttpException` → that envelope, validation errors
into `details`, and unknown errors into a 500 with a generic message (logged
server-side with the requestId).

## Testing

Bonus item — opted in.

- **Unit tests** for `ApplicationsService`: every business rule above with the
  Sequelize layer mocked or running against a transactional in-memory-ish
  setup using a real Postgres test DB.
- **E2E happy paths** with `supertest`:
  - register → login → list pets → apply → see in `/applications/me`.
  - staff login → create pet → approve application → assert cascade.
- Auth/authorization smoke: 401 on missing token, 403 on wrong role.

We will not chase 100% coverage — the goal is to prove the rules with the
fewest, clearest tests.

## Frontend (bonus)

Minimal Next.js app under `/web`. Pages:

- `/login`, `/register`
- `/pets` — grid of available pets, species filter dropdown
- `/pets/[id]` — detail + "Apply" button
- `/applications` — my applications
- `/staff` — visible only to staff: pending applications with approve/reject

State kept simple: token in `localStorage`, fetched into a tiny context. No
state library. Tailwind for styling, no component library — keep it light.

## Seed data

`api/src/database/seed.ts` runs after migrations on `npm run seed`:

- 1 staff user (`staff@cobra.local` / `staffpass`)
- 3 regular users
- ~10 pets across species (dog, cat, rabbit, parrot) and statuses
- A few applications, including:
  - one pending application that demonstrates approval cascade
  - one already-approved pet to show the `adopted` state
  - one rejected application

Seed is idempotent: drops & recreates the schema in dev, sync only.

## Milestones

1. **Plan + scaffold** — this file, then `nest new`, deps, strict TS, env, DB
   compose, lint/format. *Get to a green `npm run start:dev`.*
2. **Auth + users** — model, register/login, JWT, guards, roles decorator.
3. **Pets** — model, CRUD endpoints, public list with pagination/filter.
4. **Applications** — model + the business-logic service + transactional
   tests as we go. This is the chunk that earns most of the score.
5. **Error filter + validation pipe + structured logging.**
6. **Seed script.**
7. **Tests** — fill out the cases listed above.
8. **README + CLAUDE.md + .cursorrules.**
9. **Frontend** — Next.js pages, deliberately minimal.
10. **Verification pass** — lint, build, test, manual smoke.

## Notable decisions to write up in README

- Why we leave pet status as `available` while applications are pending.
- Why uniqueness for "no duplicate apply" is enforced at both DB (partial
  unique index) and service (friendly error code) layers.
- Why we chose UUID PKs (no enumeration via sequential IDs in URLs).
- Why we kept the role list to two values (`user`, `staff`) instead of a
  separate roles table — keeps the brief's scope, easy to extend later.
- Why we skipped Swagger for now and how to add it.

## Out of scope

- Email verification / password reset.
- Refresh tokens (single short-lived JWT is fine for the assignment).
- Image uploads for pets.
- Audit log table.
- Rate limiting (a one-liner with `@nestjs/throttler` if asked).
- i18n.
