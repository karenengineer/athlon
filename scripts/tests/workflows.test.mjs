import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
  statSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseDocument } from "yaml";

const root = new URL("../../", import.meta.url);
function workflow(name) {
  const document = parseDocument(
    readFileSync(new URL(`.github/workflows/${name}.yml`, root), "utf8"),
    { uniqueKeys: true },
  );
  assert.deepEqual(document.errors, []);
  return document.toJS();
}
const actionPins = new Set([
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
  "pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413",
]);

// These boundary tests catch privilege/trigger drift, bypassed gates, wrong
// revision and notification masking. They parse real YAML, not a custom grammar.
function assertCiContract(ci) {
  assert.equal(
    ci.on.workflow_call.outputs.revision.value,
    "${{ jobs.verify.outputs.revision }}",
  );
  assert.deepEqual(Object.keys(ci.on).sort(), [
    "pull_request",
    "workflow_call",
  ]);
  assert.deepEqual(ci.permissions, { contents: "read" });
  assert(!JSON.stringify(ci).includes("secrets."));
  assert(!JSON.stringify(ci).includes("environment"));
  const job = ci.jobs.verify;
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 30);
  const steps = job.steps;
  const run = steps.filter((step) => step.run).map((step) => step.run);
  const requiredCommands = [
    "pnpm install --frozen-lockfile",
    "pnpm verify",
    "pnpm test:ops",
    "bash scripts/tests/native-flock.test.sh",
    "pnpm --filter @athlon/api test:e2e --testPathPatterns=catalog-postgres.e2e-spec",
  ];
  assert.deepEqual(
    run.filter((command) => requiredCommands.includes(command)),
    requiredCommands,
  );
  for (const step of steps.filter((step) =>
    requiredCommands.includes(step.run),
  )) {
    assert(
      !Object.hasOwn(step, "if"),
      `required gate is conditional: ${step.run}`,
    );
    assert(
      !step["continue-on-error"],
      `required gate allows failure: ${step.run}`,
    );
  }
  const postgres = steps.find(
    (step) => step.env?.ATHLON_PG_INTEGRATION === "1",
  );
  assert.equal(
    postgres.run,
    "pnpm --filter @athlon/api test:e2e --testPathPatterns=catalog-postgres.e2e-spec",
  );
  assert(!postgres.env.DATABASE_URL);
  assert(
    steps.some(
      (step) => step.run === "bash scripts/tests/native-flock.test.sh",
    ),
  );
  assert.equal(
    steps.find((step) => step.id === "checkout").with.ref,
    "${{ github.sha }}",
  );
  assert.equal(job.outputs.revision, "${{ steps.revision.outputs.sha }}");
}

test("PR checks are secret-free and the reusable checks run every release gate", () => {
  assertCiContract(workflow("ci"));
});

test("CI contract rejects broken reusable output, reordered gates and conditional bypasses", () => {
  const ci = workflow("ci");
  const changedOutput = structuredClone(ci);
  changedOutput.on.workflow_call.outputs.revision.value =
    "${{ jobs.other.outputs.revision }}";
  assert.throws(
    () => assertCiContract(changedOutput),
    "broken reusable output accepted",
  );

  const reordered = structuredClone(ci);
  [reordered.jobs.verify.steps[5], reordered.jobs.verify.steps[8]] = [
    reordered.jobs.verify.steps[8],
    reordered.jobs.verify.steps[5],
  ];
  assert.throws(() => assertCiContract(reordered), "reordered gates accepted");

  for (const index of [4, 5, 6, 7, 8]) {
    const bypassed = structuredClone(ci);
    bypassed.jobs.verify.steps[index].if = "false";
    assert.throws(
      () => assertCiContract(bypassed),
      `conditional gate ${index} accepted`,
    );
  }
});

test("operations syntax gate rejects malformed later files in every matched group", () => {
  const command = JSON.parse(
    readFileSync(new URL("package.json", root), "utf8"),
  ).scripts["test:ops"].split(" && ")[0];
  const fixture = mkdtempSync(join(tmpdir(), "athlon-syntax-test-"));
  const paths = [
    "scripts/a.sh",
    "scripts/z.sh",
    "scripts/tests/z.sh",
    "scripts/tests/fixtures/z",
  ];
  try {
    mkdirSync(join(fixture, "scripts/tests/fixtures"), { recursive: true });
    const execute = () =>
      spawnSync("bash", ["-c", command], {
        cwd: fixture,
        encoding: "utf8",
        timeout: 5000,
      });
    for (const path of paths) writeFileSync(join(fixture, path), "true\n");
    assert.equal(execute().status, 0);
    for (const path of paths.slice(1)) {
      writeFileSync(join(fixture, path), "if\n");
      const result = execute();
      assert.equal(result.status, 2, `later malformed file accepted: ${path}`);
      assert(result.stderr.includes(path));
      writeFileSync(join(fixture, path), "true\n");
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("main-only checked release uses the production environment and serialization", () => {
  const deploy = workflow("deploy");
  assert.deepEqual(Object.keys(deploy.on).sort(), [
    "push",
    "workflow_dispatch",
  ]);
  assert.deepEqual(deploy.on.push.branches, ["main"]);
  assert.equal(deploy.on.workflow_dispatch, null);
  assert.deepEqual(deploy.permissions, { contents: "read" });
  assert.deepEqual(deploy.concurrency, {
    group: "athlon-production",
    "cancel-in-progress": false,
  });
  assert.equal(deploy.jobs.verify.uses, "./.github/workflows/ci.yml");
  assert.equal(
    deploy.jobs.verify.if,
    "github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')",
  );
  assert(!deploy.jobs.verify.secrets);
  const job = deploy.jobs.deploy;
  assert.equal(job.needs, "verify");
  assert.equal(
    job.if,
    "github.ref == 'refs/heads/main' && needs.verify.result == 'success'",
  );
  assert.equal(job.environment, "production");
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 60);
  assert.equal(
    job.steps.find((step) => step.id === "checkout").with.ref,
    "${{ needs.verify.outputs.revision }}",
  );
  assert.equal(job.env.DEPLOY_COMMIT, "${{ needs.verify.outputs.revision }}");
  const release = job.steps.find((step) => step.id === "release");
  assert.equal(release.run, "bash scripts/deploy-production.sh");
  assert.equal(release.env.ATHLON_SKIP_BOOTSTRAP, "1");
  assert.equal(
    release.env.ATHLON_DEPLOY_REVISION,
    "${{ needs.verify.outputs.revision }}",
  );
  assert.equal(release.env.ATHLON_SSH_HOST, "${{ vars.DEPLOY_HOST }}");
  assert.equal(release.env.ATHLON_SSH_USER, "${{ vars.DEPLOY_USER }}");
  assert(!release["continue-on-error"]);
  const final = job.steps.find((step) => step.id === "notify-final");
  assert.equal(final.if, "always()");
  assert.equal(
    final.env.DEPLOY_STATUS,
    "${{ steps.release.outcome == 'success' && 'success' || 'failure' }}",
  );
  assert.equal(final["continue-on-error"], true);
  assert.equal(
    job.steps.find((step) => step.id === "notify-start").env.DEPLOY_STATUS,
    "started",
  );
  assert.equal(job.steps.find((step) => step.id === "cleanup").if, "always()");
});

test("only reviewed immutable Actions and notifier failures are allowed", () => {
  for (const name of ["ci", "deploy"]) {
    const value = workflow(name);
    for (const job of Object.values(value.jobs)) {
      assert(!job["continue-on-error"]);
      for (const step of job.steps ?? []) {
        if (step.uses) {
          assert(actionPins.has(step.uses), `unreviewed Action: ${step.uses}`);
          if (step.uses.startsWith("actions/checkout@"))
            assert.equal(step.with["persist-credentials"], false);
          if (step.uses.startsWith("actions/setup-node@"))
            assert.equal(step.with["node-version"], "22.22.2");
          if (step.uses.startsWith("pnpm/action-setup@"))
            assert.equal(step.with.version, "11.19.0");
        }
        if (step["continue-on-error"])
          assert.match(step.run, /bash scripts\/notify-telegram\.sh/);
        if (step.run) {
          assert(
            !step.run.includes("${{"),
            "expressions must enter shell via environment data",
          );
          assert(
            !/--seed|--bootstrap|ssh-keyscan|StrictHostKeyChecking=no|--insecure|\bcurl -k\b|set -x/.test(
              step.run,
            ),
          );
        }
      }
    }
  }
});

test("credential materialization is private and always cleanup removes only owned files", () => {
  const steps = workflow("deploy").jobs.deploy.steps;
  const materialize = steps.find((step) => step.id === "credentials");
  const cleanup = steps.find((step) => step.id === "cleanup");
  const fixture = mkdtempSync(join(tmpdir(), "athlon-workflow-test-"));
  try {
    const output = join(fixture, "output");
    const execute = (run, env) =>
      spawnSync("bash", ["-euo", "pipefail", "-c", run], {
        env: {
          ...process.env,
          RUNNER_TEMP: fixture,
          GITHUB_OUTPUT: output,
          ...env,
        },
        encoding: "utf8",
        timeout: 5000,
      });
    const result = execute(materialize.run, {
      DEPLOY_SSH_PRIVATE_KEY: "fixture-private-key",
      DEPLOY_KNOWN_HOSTS: "fixture-vetted-hosts",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert(!result.stderr.includes("fixture-private-key"));
    const directory = readFileSync(output, "utf8")
      .trim()
      .slice("directory=".length);
    assert.equal(statSync(join(directory, "key")).mode & 0o777, 0o600);
    assert.equal(statSync(join(directory, "known_hosts")).mode & 0o777, 0o600);
    assert.equal(
      readFileSync(join(directory, "key"), "utf8"),
      "fixture-private-key\n",
    );
    assert.equal(
      readFileSync(join(directory, "known_hosts"), "utf8"),
      "fixture-vetted-hosts\n",
    );
    writeFileSync(join(fixture, "key"), "unowned-key-sentinel");
    writeFileSync(join(fixture, "known_hosts"), "unowned-host-sentinel");
    assert.equal(
      execute(cleanup.run, { CREDENTIAL_DIRECTORY: fixture }).status,
      1,
    );
    assert(existsSync(directory));
    assert.equal(
      readFileSync(join(fixture, "key"), "utf8"),
      "unowned-key-sentinel",
    );
    assert.equal(
      readFileSync(join(fixture, "known_hosts"), "utf8"),
      "unowned-host-sentinel",
    );
    assert.equal(
      execute(cleanup.run, { CREDENTIAL_DIRECTORY: directory }).status,
      0,
    );
    assert(!existsSync(directory));
    assert.equal(execute(cleanup.run, { CREDENTIAL_DIRECTORY: "" }).status, 0);
    const missing = execute(materialize.run, {
      DEPLOY_SSH_PRIVATE_KEY: "",
      DEPLOY_KNOWN_HOSTS: "fixture-vetted-hosts",
    });
    assert.equal(missing.status, 1);
    const failed = execute(materialize.run, {
      DEPLOY_SSH_PRIVATE_KEY: "fixture-private-key",
      DEPLOY_KNOWN_HOSTS: "fixture-vetted-hosts",
      GITHUB_OUTPUT: fixture, // Force setup failure after mktemp, before files.
    });
    assert.equal(failed.status, 1);
    assert(!failed.stderr.includes("fixture-private-key"));
    assert(
      !readdirSync(fixture).some((path) => path.startsWith("athlon-deploy.")),
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("release guard refuses unchecked revisions and changed targets before secret use", () => {
  const guard = workflow("deploy").jobs.deploy.steps.find(
    (step) => step.name === "Confirm verified checkout and approved target",
  );
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.trim();
  const execute = (env) =>
    spawnSync("bash", ["-euo", "pipefail", "-c", guard.run], {
      cwd: root,
      env: {
        ...process.env,
        DEPLOY_COMMIT: head,
        EXPECTED_REVISION: head,
        DEPLOY_HOST: "18.158.105.59",
        DEPLOY_USER: "ubuntu",
        ...env,
      },
      encoding: "utf8",
      timeout: 5000,
    });
  assert.equal(execute({}).status, 0);
  assert.equal(execute({ DEPLOY_COMMIT: "a".repeat(40) }).status, 1);
  assert.equal(execute({ EXPECTED_REVISION: "b".repeat(40) }).status, 1);
  assert.equal(execute({ DEPLOY_HOST: "evil.example" }).status, 1);
  assert.equal(execute({ DEPLOY_USER: "root" }).status, 1);
});
