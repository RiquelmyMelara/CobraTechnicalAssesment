# GitHub Copilot — repo instructions

The full guide for AI tools working in this repo is in
[`CLAUDE.md`](../CLAUDE.md) at the root. Read it before suggesting
non-trivial changes. Architectural decisions live in
[`plan.md`](../plan.md).

Quick reminders for Copilot:

- **TypeScript strict mode is non-negotiable** (`strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noUnusedLocals`, `noUnusedParameters`). Prefer narrowing over `as`
  / `any`. There are zero `any` types in production code; keep it
  that way.
- **One concern per module.** New domain features go in
  `api/src/modules/<feature>/` with controller, service, model, DTOs.
- **Validation at the boundary.** Every request body and query is a
  class decorated with `class-validator`. The global `ValidationPipe`
  is configured with `whitelist`, `forbidNonWhitelisted`, `transform`.
  Don't bypass it.
- **Authorization in services and guards, not controllers.** Owner
  scoping (`/applications/me`) filters by `user_id` in the *service*
  query, not after fetching everything.
- **Errors are structured.** Throw `HttpException` subclasses; let
  `AllExceptionsFilter` shape the envelope. No raw
  `res.status(...).json(...)`.
- **No `console.log` in production paths.** Use the Nest `Logger`.
  Delete dead code rather than commenting it out.
- **Multi-row writes inside a Sequelize transaction.** The application
  approve-cascade is the canonical example.
- **Commits never include AI co-author trailers.** Author is
  `Riquelmy Melara <riquelmy.melara@tecniastudio.com>`.

See [`CLAUDE.md`](../CLAUDE.md) for the layout, common commands, the
"do not touch" list, and the JWT role staleness trade-off note.
