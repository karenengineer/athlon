# ATHLON: Armenian default, administration, and continuous deployment

## Approved direction

Domain: `athlonsport.am`, with `www.athlonsport.am` supported. Extend the existing Angular SSR / NestJS / PostgreSQL monorepo. Reuse the current administrative API and cookie sessions. No cart, checkout, orders, payments, or additional hosting services.

## Armenian default

The root URL redirects to `/hy`; unsupported locale fallbacks and the initial translation-service locale become HY. Explicit `/ru` and `/en` links remain unchanged. Public pages derive their locale from the route. Backend locale defaults must be inspected for consistency without removing translated RU/EN data. Tests cover the root redirect, invalid locale handling, and explicit supported locales. SSR and browser behavior must agree.

## Administrative frontend

Register `/admin` before the public `:locale` route. Lazy-load administrative components; do not ship their forms in the public initial bundle. Routes:

- `/admin/login`
- `/admin` (dashboard)
- `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`
- `/admin/categories`, `/admin/categories/new`, `/admin/categories/:id/edit`
- `/admin/brands`, `/admin/brands/new`, `/admin/brands/:id/edit`

Dashboard shows persisted catalog counts and links, not invented analytics. Administration uses the same black/red brand identity with readable light forms, responsive navigation, keyboard access, visible focus, associated labels, and actionable validation errors. Interface defaults to HY and supports RU/EN through existing translation conventions. Forms provide HY/RU/EN translation tabs.

Product editor covers fields supported by the current schema: identity/slug/SKU, category and brand, AMD price, availability, publication, featured, isNew, display order, translations, specifications, and images. Category and brand editors cover their existing model fields and translations. Inspect DTOs/schema before implementation; add only API capabilities necessary for these screens, not a parallel data model.

Lists use server-side search, relevant filters, sorting, validated pagination, and URL state. Add these capabilities to existing admin list endpoints where currently absent. Server excludes deleted/unpublished data according to existing public API rules. CRUD operations display loading, empty, success, and error states. Deletion requires a named confirmation and handles dependency conflicts without cascading unexpected data loss.

Preview renders unsaved form data locally using shared presentation patterns; draft data must not be exposed by unauthenticated public endpoints. Published products can additionally link to their public page. Warn before leaving dirty forms. Image tools upload, display, edit localized alt text if supported, reorder, and delete with confirmation. Validate file size/type in the UI and enforce actual content decoding, limits, ownership, and safe names on the server; arbitrary SVG/HTML must not be accepted.

## Authentication and security

Use `/api/v1/admin/auth/login`, `me`, `refresh`, and `logout`. Access/refresh tokens remain HttpOnly cookies; never copy them into localStorage or expose them to Angular. Attach the readable CSRF cookie value as `x-csrf-token` only to same-origin administrative mutations. Match the configurable server cookie name; do not silently invent a second CSRF protocol. Login errors do not disclose whether an email exists.

An Angular guard checks the session, but every administrative endpoint remains independently protected by NestJS guards. A single in-flight refresh handles expired sessions, retries a request at most once, and redirects to login on failure. Return URLs must be restricted to local admin paths. No secret or privileged user state is serialized into shared SSR responses. Admin pages render client-side or a neutral shell with no private data, include noindex metadata, and are excluded from public sitemap.

Tests cover unauthorized and CSRF rejection, expired sessions, logout, CRUD validation, publication behavior, pagination/filtering, upload security, and route precedence. Do not change production passwords or seed production during this work.

## GitHub Actions deployment

Use GitHub Actions, not a server-side GitHub webhook. Pull requests run checks without deployment secrets. Pushes to protected `main` run the same checks and then deploy; provide a manual workflow_dispatch option. Pin third-party Actions to reviewed immutable commits. Use least permissions (`contents: read` by default), a production environment, finite timeouts, and a production concurrency group with cancellation disabled so migrations/deployments cannot overlap.

CI pins Node/pnpm to project requirements, installs from the frozen lockfile, and runs `pnpm verify`. If checks fail, no production mutation occurs. For deployment, use an explicitly configured SSH host/user/path and a dedicated deployment key stored in GitHub environment secrets. Pin the SSH host key from a trusted connection: never disable StrictHostKeyChecking or trust a freshly fetched network key automatically. Avoid handing the general-purpose personal Lightsail key to CI if a dedicated key can be provisioned.

Reuse reviewed Docker Compose deployment behavior, adapting the deploy script for CI. Bootstrap is an explicit provisioning operation, not something repeated by each release. Exclude `.git`, `.superpowers`, credentials, local environments, dependencies/build outputs, uploads, and backups from synchronization. Production `.env` stays server-side and must not be overwritten. Run a database backup before migrations, build images, apply migrations, start services, and check service health. Do not use seed or remove volumes. Record the successful commit in `/opt/athlon/REVISION` only after checks pass. Preserve previous image tags for operator rollback; destructive database rollback is never automatic.

Smoke tests validate trusted HTTPS, HTTP-to-HTTPS redirect, API health, HY/RU/EN pages, and localized products through the public domain. A failed deployment is reported as failed, not as success merely because SSH exited. Existing single-server architecture may have brief restart downtime; zero-downtime/high availability is outside scope.

## Telegram notifications

Use a bot's sendMessage API over HTTPS. Store `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in GitHub production secrets; never commit them, pass them in chat, echo them, or include them in error output. Send start, success, and failure notifications with project/environment, short commit, safe commit metadata, and GitHub run URL. Use plain text or correctly escaped formatting so commit messages cannot inject markup.

Notification failure must not mask deployment failure or falsely mark a successful release as failed. Validate HTTP/API success, enforce short timeouts, and emit a sanitized warning. Missing configuration is explicitly visible. Workflows must not send secrets to untrusted PR code or notify arbitrary chat IDs supplied by repository input.

## Verification and rollout

Implement language correction first, then admin authentication/layout, CRUD/media, CI deployment, and Telegram. Run frontend/backend tests, lint/typecheck, production builds, and relevant deployment-script behavior tests. Review the complete changes independently before production rollout.

External setup is required: production branch/environment configuration, a dedicated SSH key and trusted host fingerprint, Telegram bot token and chat ID. The user enters secrets through GitHub Settings, not repository files or this conversation. Publishing commits, changing access controls, and provisioning CI credentials require specific approval at the action boundary. Automatic deployment starts only after the verified code is integrated into `main` and the production secrets are installed.

Known limitations: one Lightsail server, no automatic destructive migration rollback, no guarantee of a fixed deployment duration, and no notifications before Telegram is configured. The current public TLS issue must be verified separately; never bypass certificate verification to declare production healthy.
