# ATHLON agent guidance

## Repository map

- `apps/api`: NestJS API, Prisma/PostgreSQL persistence, catalog, finance, orders, authentication, media, and payment integration.
- `apps/web`: Angular storefront with SSR and Armenian, Russian, and English localization.
- `infrastructure`: Docker Compose and Caddy deployment configuration.
- `scripts`: deployment, backup, notification, smoke, and operations checks.
- `docs`: operational and implementation documentation.

## Working rules

- Run `git status --short` before editing. Preserve unrelated and pre-existing changes; never reset, discard, or overwrite them.
- Follow the closest applicable `AGENTS.md` if nested guidance is added later.
- Keep changes within the assigned scope. Coordinate contract changes before modifying another agent's area.
- Use test-driven development for behavior changes. Make the smallest coherent change and add regression coverage for defects.
- Never place credentials, private keys, production environment values, customer data, or live payment details in source, chat, commands, fixtures, or logs.
- Card payments remain disabled until the exact bank integration is implemented, tested, reviewed, and explicitly approved. A browser redirect is not proof of payment.
- Repository work never implies permission to deploy, transact, change DNS, alter external settings, or mutate production.

## Verification

Run the narrowest relevant check first, then broaden verification in proportion to risk.

- Full repository verification: `pnpm verify`
- API unit tests: `pnpm --filter @athlon/api test`
- API end-to-end tests: `pnpm --filter @athlon/api test:e2e`
- Web tests: `pnpm --filter @athlon/web test`
- Type checking: `pnpm typecheck`
- Linting: `pnpm lint`
- Production builds: `pnpm build`
- Production-shaped SSR check: `pnpm test:ssr`
- Deployment and workflow fixtures: `pnpm test:ops`

Report commands actually run and their results. Do not claim a check passed unless its current output proves it.

## Multi-agent coordination

Project-scoped agent profiles live in `.codex/agents`:

- `athlon_coordinator`: decomposes work, assigns non-overlapping ownership, and synthesizes results.
- `backend_engineer`: implements `apps/api` and database-related changes.
- `frontend_engineer`: implements `apps/web` application changes.
- `qa_security_reviewer`: performs read-only correctness and security review.
- `performance_reviewer`: performs read-only measurement and performance review.
- `release_operations`: implements repository infrastructure and automation changes; external operations still require explicit approval.
- `creative_producer`: creates repository-owned visual and brand assets without integrating them into application code unless coordinated.

### Mandatory coding workflow

This workflow applies only to the primary/root agent. A spawned subagent must execute only its assigned task and must not restart this workflow or spawn another coordinator unless the primary agent explicitly assigns orchestration.

For every request that creates, modifies, fixes, refactors, or deletes code, configuration, tests, or deployment automation:

1. Spawn `athlon_coordinator` first. Ask it to identify affected surfaces, file ownership, dependencies, verification commands, and work that can safely run in parallel. Wait for its plan before assigning implementation.
2. Spawn the appropriate implementation agent:
   - `backend_engineer` for `apps/api`, Prisma, and database work.
   - `frontend_engineer` for `apps/web` application work.
   - `release_operations` for `infrastructure`, `scripts`, CI workflows, and operations documentation.
   - `creative_producer` for repository-owned visual and brand assets.
3. Run multiple implementation agents concurrently only when their file ownership does not overlap. Never allow two writable agents to edit the same files or feature surface. Keep dependent steps sequential.
4. After implementation and targeted tests, spawn `qa_security_reviewer` and `performance_reviewer` in parallel. Both reviewers remain read-only and review the resulting diff and verification evidence.
5. The primary agent must inspect the final diff, evaluate every material reviewer finding, run verification in proportion to risk, and synthesize the result. Never accept an agent's completion claim without independent evidence.

Do not invoke this workflow for explanation-only or other read-only requests unless delegation would materially improve the answer. The user's explicit instruction to use a single-agent workflow, skip a reviewer, or avoid delegation for a specific request overrides this default.
