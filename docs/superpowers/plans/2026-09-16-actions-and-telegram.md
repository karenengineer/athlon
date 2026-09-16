# ATHLON Actions and Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Checked pushes to main deploy to Lightsail and report start/success/failure to Telegram.

**Architecture:** GitHub Actions runs repository verification and invokes reviewed SSH/Compose scripts. Secrets remain in GitHub production environment; server `.env` and persistent volumes remain untouched. Notifications are isolated from deployment result.

**Tech Stack:** GitHub Actions, Bash, Docker Compose, SSH/rsync, Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-09-16-admin-and-continuous-deployment-design.md`

## Global Constraints

- Domain: `athlonsport.am`, with `www.athlonsport.am` supported.
- CI pins Node/pnpm to project requirements, installs from the frozen lockfile, and runs `pnpm verify`.
- Production `.env` stays server-side and must not be overwritten.
- Do not use seed or remove volumes.
- Notification failure must not mask deployment failure or falsely mark a successful release as failed.
- Publishing commits, changing access controls, and provisioning CI credentials require specific approval at the action boundary.

## Contracts and files

`.github/workflows/ci.yml` owns pull-request checks. `deploy.yml` owns main push/manual verification, production environment and ordered deployment. `scripts/deploy-production.sh` keeps local compatibility, but CI mode requires existing provisioned server/env; bootstrap becomes explicit. `scripts/notify-telegram.sh` consumes `TELEGRAM_BOT_TOKEN,TELEGRAM_CHAT_ID,DEPLOY_STATUS,DEPLOY_COMMIT,DEPLOY_RUN_URL`; outputs no credentials. `scripts/smoke-production.sh` exits nonzero if public TLS/API/localized pages fail. Shell tests under `scripts/tests/` use isolated stubs and never access real production.

### Task 1: CI-safe deployment and public smoke tests

**Files:** Modify `scripts/deploy-production.sh`; create `scripts/smoke-production.sh`, `scripts/tests/deploy-ci.test.sh`; update README rollback/provisioning instructions.

**Interfaces:** Preserve `ATHLON_SSH_KEY`; add CI env `ATHLON_SSH_HOST`, `ATHLON_SSH_USER`, `ATHLON_KNOWN_HOSTS`, `ATHLON_DEPLOY_REVISION`, `ATHLON_SKIP_BOOTSTRAP=1`. CI requires nonempty revision/known hosts and no seed; local documented bootstrap invocation remains available. Fixed remote app path `/opt/athlon`; allow only safe host/user/revision formats, not arbitrary remote commands.

- [ ] Extend stub-based shell tests with assertions before implementation:

```bash
if ATHLON_SKIP_BOOTSTRAP=1 ATHLON_DEPLOY_REVISION=fixture bash scripts/deploy-production.sh --seed; then
  printf 'CI seed must be rejected\n' >&2; exit 1
fi
```

Additional captured-command assertions: no bootstrap in CI, known-host enforcement present, no `.env` synchronization, backup before migrate, no volume deletion, revision write after successful smoke only.

- [ ] Run `bash scripts/tests/deploy-ci.test.sh`; confirm expected failure, not accidental missing stub/tool.
- [ ] Implement CI argument validation and SSH host pinning (`StrictHostKeyChecking=yes`, trusted `UserKnownHostsFile`). Exclude `.superpowers/`, `.worktrees/`, editor state and existing secret/build exclusions. Serialize remote release operations with a release lock. Run existing backup script before migrations; preserve prior images before new build/up; commands that consume stdin must retain `--interactive=false`/`-T`. Fail pipeline on health errors. Write REVISION using nonsecret file-safe operation only after public smoke succeeds.
- [ ] Implement smoke commands with bounded timeouts and no `-k`:

```bash
curl --fail --silent --show-error --max-time 30 https://athlonsport.am/api/v1/health/live
for locale in hy ru en; do
  curl --fail --silent --show-error --max-time 30 --output /dev/null "https://athlonsport.am/$locale"
done
```

Also check www trusted HTTPS, HTTP redirect, HSTS and localized products API. Validate health JSON, not just status. Backup retention is documented/operator-managed; no automatic broad deletion. Update rollback documentation to match actual saved tags.

- [ ] Run shell behavior tests, `bash -n` scripts, shellcheck if installed, and compose config using dummy values; record absent tools. Commit `feat(deploy): support verified CI releases`.

### Task 2: Telegram notifier without secret leakage

**Files:** Create `scripts/notify-telegram.sh`, `scripts/tests/notify-telegram.test.sh`; document GitHub production secrets in README.

**Interfaces:** Environment contract above; notifier fails with sanitized error when delivery is unconfirmed. Workflow calls it as a nonblocking step. Text uses plain formatting; no parse_mode, no token in logged commands or process arguments where avoidable (curl config via stdin).

- [ ] Write curl-stub tests verifying JSON text, run URL/status, missing configuration, HTTP failure, API `{ok:false}`, and timeout. Assert captured stdout/stderr excludes fixture token.

```bash
if TELEGRAM_BOT_TOKEN=secret-fixture TELEGRAM_CHAT_ID=1 DEPLOY_STATUS=success scripts/notify-telegram.sh 2>"$test_dir/error"; then exit 1; fi
if rg -q 'secret-fixture' "$test_dir/error"; then exit 1; fi
```

- [ ] Run test and confirm failure for missing notifier behavior.
- [ ] Build message from bounded status/short commit/run URL using a JSON serializer available on runner, not shell string interpolation. Post via curl with finite connect/max timeout and sanitized errors; never `set -x`. Parse API success explicitly. Status names: `started`, `success`, `failure`; missing env returns an actionable configuration warning without secret values.
- [ ] Run tests and `bash -n`; commit `feat(deploy): notify Telegram of release status`.

### Task 3: GitHub workflows and activation guide

**Files:** Create `.github/workflows/{ci,deploy}.yml`; create `scripts/tests/workflows.test.mjs`; modify README and `.env.example` documentation only where relevant (Telegram tokens never belong in app env).

**Interfaces:** Production environment secrets: `DEPLOY_SSH_PRIVATE_KEY`, `DEPLOY_KNOWN_HOSTS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; variables: `DEPLOY_HOST=18.158.105.59`, `DEPLOY_USER=ubuntu`. Run URL from trusted GitHub context. No PR workflow consumes these secrets.

- [ ] Write workflow-structure tests using a YAML parser dependency explicitly pinned in dev tooling if needed: main-only deployment, PR check only, concurrency cancel-in-progress false, least permissions, prod environment, always final notification, immutable action refs, no seed/no TLS bypass. Run tests and observe absent workflow failure.
- [ ] Research current official Action repositories and GitHub documentation for immutable commit references; verify each selected SHA and supported Node runtime instead of copying unverified hashes. Use Node matching Docker Node22 requirement and pnpm11.19.0. Install frozen lockfile; execute `pnpm verify` before deployment job. Avoid privileged pull_request_target.
- [ ] Implement deployment job with timeout and concurrency:

```yaml
permissions:
  contents: read
concurrency:
  group: athlon-production
  cancel-in-progress: false
```

The job checks out verified commit, sends started notification, materializes SSH key/known hosts in runner temp mode600 without log output, runs reviewed deploy script with pinned host, and cleans temp credentials in always step. Success/failure notification uses actual deploy result and an always condition; notification steps use continue-on-error and sanitized warnings. Verify/manual trigger runs checks identically. Use environment secrets only after successful checks.

- [ ] Document dedicated CI key provisioning, trusted SSH fingerprint capture, branch protection and production environment setup, bot creation and obtaining chat_id without sharing token, GitHub Actions email preferences and manual release. Explain commit/push vs admin-data edits: admin CRUD persists immediately in database, no Git deployment required. Explain queue/smoke duration not guaranteed, rollback constraints and no credentials in chat.
- [ ] Run workflow tests, actionlint if available, all shell tests and `pnpm verify`; independently review full plan. Commit `ci: deploy checked releases with Telegram notifications`.

### Task 4: Authorized activation and production acceptance

**Files:** Operational evidence in this plan's SDD report; no secret files committed.

**Interfaces:** Consumes user-authorized branch integration and secrets configured through GitHub Settings; produces tested release commit and notification.

- [ ] Ask specific approval before provisioning deployment credential, setting GitHub access controls, integrating/pushing main. Do not request tokens in chat. User installs Telegram secrets privately; confirm configuration presence by metadata only.
- [ ] Check public DNS/TLS; if caches/certificate remain unresolved, diagnose rather than disable TLS checks. Trigger authorized main/manual workflow and inspect run logs with redaction; verify started/success Telegram receipt with user. Test failure notification safely via a nondeploying controlled test, not by breaking production.
- [ ] Verify `/` selects HY, favicon is provided asset, admin login route renders and unauthenticated protected API returns 401, public catalog in all three locales, existing admin count and data unchanged. Check recorded revision equals successful workflow commit; backup remains recoverable.
- [ ] Record duration as measured for this run, not a future SLA; summarize executed commands, missing tooling, remaining single-server/rollback constraints, and unresolved user setup. No automatic destructive rollback or volume cleanup.
