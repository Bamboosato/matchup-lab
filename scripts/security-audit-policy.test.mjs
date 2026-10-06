import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { evaluateAudits } from "./security-audit-policy.mjs";

const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const expires = "2026-10-20T00:00:00Z";
const versions = {
  braces: "3.0.3",
  micromatch: "4.0.8",
  "fast-glob": "3.3.1",
  "@next/eslint-plugin-next": "16.3.8",
  "eslint-config-next": "16.3.8",
};

function audit(vulnerabilities = {}) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  for (const item of Object.values(vulnerabilities)) {
    counts[item.severity]++;
    counts.total++;
  }
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}

function fixture() {
  const names = Object.keys(versions);
  return {
    full: audit(Object.fromEntries(names.map((name, index) => [name, {
      name,
      severity: "high",
      nodes: [`node_modules/${name}`],
      via: index === 0 ? [{ url: advisory, severity: "high" }] : [names[index - 1]],
    }]))),
    production: audit(),
    lock: { packages: Object.fromEntries(names.map((name) => [
      `node_modules/${name}`, { version: versions[name], dev: true },
    ])) },
    exception: {
      advisory, expires, owner: "MatchupLab maintainers", reason: "Unfixed dev-only advisory", packages: { ...versions },
    },
    now: new Date("2026-10-06T00:00:00Z"),
  };
}

test("allows the specific dev advisory and every recorded dependency-derived parent", () => {
  assert.deepEqual(evaluateAudits(fixture()), { ok: true, blocked: [], excepted: Object.keys(versions) });
});

test("passes a fully fixed tree even after the old exception expires", () => {
  const input = fixture();
  input.full = audit();
  input.now = new Date("2026-10-21T00:00:00Z");
  assert.deepEqual(evaluateAudits(input), { ok: true, blocked: [], excepted: [] });
});

for (const [label, now, expected] of [
  ["one millisecond before", new Date(Date.parse(expires) - 1), true],
  ["at", new Date(expires), false],
  ["one millisecond after", new Date(Date.parse(expires) + 1), false],
]) {
  test(`applies the expiry boundary ${label} the deadline`, () => {
    assert.equal(evaluateAudits({ ...fixture(), now }).ok, expected);
  });
}

test("blocks a new advisory on the root or a recorded parent, even at low severity", () => {
  for (const name of ["braces", "eslint-config-next"]) {
    const input = fixture();
    input.full.vulnerabilities[name].via.push({ url: "https://example.com/new-advisory", severity: "low" });
    assert.equal(evaluateAudits(input).ok, false);
  }
});

test("blocks critical root findings and critical causes using the same advisory URL", () => {
  for (const criticalItem of [false, true]) {
    const input = fixture();
    if (criticalItem) {
      input.full.vulnerabilities.braces.severity = "critical";
      input.full = audit(input.full.vulnerabilities);
    } else {
      input.full.vulnerabilities.braces.via[0].severity = "critical";
    }
    assert.equal(evaluateAudits(input).ok, false);
  }
});

test("blocks an unrelated new package without suppressing the known exception", () => {
  const input = fixture();
  input.full = audit({ ...input.full.vulnerabilities,
    next: { name: "next", severity: "critical", nodes: ["node_modules/next"], via: [{ url: "https://example.com/rce", severity: "critical" }] },
  });
  const result = evaluateAudits(input);
  assert.equal(result.ok, false);
  assert.ok(result.blocked.includes("full: next"));
  assert.equal(result.excepted.length, 5);
});

test("blocks production findings regardless of their advisory or severity", () => {
  for (const severity of ["low", "high", "critical"]) {
    const input = fixture();
    input.production = audit({ braces: { ...input.full.vulnerabilities.braces, severity } });
    const result = evaluateAudits(input);
    assert.equal(result.ok, false);
    assert.ok(result.blocked.includes("production: braces"));
  }
});

test("blocks a recorded dependency becoming runtime or losing its lock entry", () => {
  for (const mode of ["runtime", "missing-dev", "missing-entry"]) {
    const input = fixture();
    if (mode === "runtime") input.lock.packages["node_modules/braces"].dev = false;
    if (mode === "missing-dev") delete input.lock.packages["node_modules/braces"].dev;
    if (mode === "missing-entry") delete input.lock.packages["node_modules/braces"];
    assert.equal(evaluateAudits(input).ok, false);
  }
});

test("requires review after a recorded version changes", () => {
  const input = fixture();
  input.lock.packages["node_modules/braces"].version = "3.0.4";
  assert.equal(evaluateAudits(input).ok, false);
});

test("blocks an additional nested copy even when its version is identical", () => {
  const input = fixture();
  const path = "node_modules/other/node_modules/braces";
  input.lock.packages[path] = { version: "3.0.3", dev: true };
  input.full.vulnerabilities.braces.nodes.push(path);
  assert.equal(evaluateAudits(input).ok, false);
});

test("blocks unknown, cyclic, empty, and malformed dependency causes", () => {
  for (const via of [["unknown"], ["braces"], [], [null], [{ url: advisory, severity: "unknown" }]]) {
    const input = fixture();
    input.full.vulnerabilities.braces.via = via;
    assert.equal(evaluateAudits(input).ok, false);
  }
  const input = fixture();
  input.full.vulnerabilities.braces.nodes = [];
  assert.equal(evaluateAudits(input).ok, false);
});

test("fails closed for unavailable, mismatched, or unsupported audit reports", () => {
  const valid = fixture().full;
  const invalidReports = [undefined, {}, [], { error: { code: "ECONNRESET" } },
    { ...valid, auditReportVersion: 1 },
    { ...valid, metadata: { vulnerabilities: { ...valid.metadata.vulnerabilities, total: 0 } } },
    { ...valid, metadata: { vulnerabilities: { ...valid.metadata.vulnerabilities, high: -1 } } },
  ];
  for (const report of invalidReports) {
    assert.equal(evaluateAudits({ ...fixture(), full: report }).ok, false);
    assert.equal(evaluateAudits({ ...fixture(), production: report }).ok, false);
  }
  const input = fixture();
  input.full.vulnerabilities.braces.name = "different-package";
  assert.equal(evaluateAudits(input).ok, false);
});

test("rejects missing or broadened exception configuration", () => {
  const valid = fixture().exception;
  for (const exception of [undefined, {},
    { ...valid, advisory: "https://example.com/another-advisory" },
    { ...valid, expires: "2026-02-30T00:00:00Z" },
    { ...valid, expires: "invalid" },
    { ...valid, owner: "" },
    { ...valid, reason: "" },
    { ...valid, packages: { ...versions, extra: "1.0.0" } },
    { ...valid, packages: { ...versions, braces: "*" } },
  ]) {
    assert.equal(evaluateAudits({ ...fixture(), exception }).ok, false);
  }
});

test("rejects invalid lockfiles and dates rather than silently excepting findings", () => {
  assert.equal(evaluateAudits({ ...fixture(), lock: {} }).ok, false);
  assert.equal(evaluateAudits({ ...fixture(), now: new Date("invalid") }).ok, false);
});

// Exercise the real command runner with a local npm stub: no registry or wall-clock dependency.
function runAuditStub({ full = JSON.stringify(audit()), production = JSON.stringify(audit()),
  exit = 0, omitFile, npmMissing = false, reportPathIsFile = false } = {}) {
  const temporaryRoot = resolve(tmpdir());
  const directory = mkdtempSync(resolve(temporaryRoot, "matchuplab-security-test-"));
  try {
    for (const name of ["security-audit.mjs", "security-audit-policy.mjs"]) {
      copyFileSync(new URL(`./${name}`, import.meta.url), resolve(directory, name));
    }
    const input = fixture();
    // Boundary timing is covered by fixed-time policy tests; this fixture tests process handling.
    input.exception.expires = "2099-01-01T00:00:00Z";
    writeFileSync(resolve(directory, "package-lock.json"), JSON.stringify(input.lock));
    writeFileSync(resolve(directory, "security-audit-exception.json"), JSON.stringify(input.exception));
    writeFileSync(resolve(directory, "production-input.json"), production);
    writeFileSync(resolve(directory, "full-input.json"), full);
    const stub = resolve(directory, "npm-stub.mjs");
    writeFileSync(stub, `import { readFileSync } from "node:fs";
      const args = process.argv.slice(2);
      if (args[0] !== "audit" || !args.includes("--json") || !args.includes("--audit-level=low")) process.exit(3);
      process.stdout.write(readFileSync(args.includes("--omit=dev") ? "production-input.json" : "full-input.json"));
      process.exit(${exit});`);
    if (omitFile) rmSync(resolve(directory, omitFile));
    if (reportPathIsFile) {
      writeFileSync(resolve(directory, ".security-audit"), "not a directory");
    } else {
      mkdirSync(resolve(directory, ".security-audit"));
      for (const name of ["policy", "production", "full"]) {
        writeFileSync(resolve(directory, `.security-audit/${name}.json`), '{"ok":true,"stale":true}');
      }
    }
    const env = { ...process.env, npm_execpath: stub };
    if (npmMissing) delete env.npm_execpath;
    const command = spawnSync(process.execPath, ["security-audit.mjs"], {
      cwd: directory, env, encoding: "utf8", timeout: 15_000,
    });
    assert.ifError(command.error);
    return { status: command.status, stderr: command.stderr,
      reports: reportPathIsFile ? null : Object.fromEntries(["policy", "production", "full"].map((name) => [
        name, readFileSync(resolve(directory, `.security-audit/${name}.json`), "utf8"),
      ])) };
  } finally {
    // Only remove the unique directory this test created inside the known temp root.
    assert.ok(resolve(directory).startsWith(`${temporaryRoot}${sep}matchuplab-security-test-`));
    rmSync(directory, { recursive: true, force: true });
  }
}

test("runner accepts zero findings and saves both unfiltered audit reports", () => {
  const result = runAuditStub();
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.reports.policy).ok, true);
  assert.equal(result.reports.production, JSON.stringify(audit()));
  assert.equal(result.reports.full, JSON.stringify(audit()));
});

test("runner evaluates npm exit 1 rather than ignoring its vulnerability findings", () => {
  const full = JSON.stringify(fixture().full);
  const result = runAuditStub({ full, exit: 1 });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.reports.policy).excepted.length, 5);
  assert.equal(result.reports.full, full);
});

test("runner fails on npm communication/process errors and clears previous success reports", () => {
  const result = runAuditStub({ exit: 2 });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.reports.policy).ok, false);
  assert.deepEqual(JSON.parse(result.reports.full), {});
  assert.ok(!Object.values(result.reports).some((report) => report.includes("stale")));
});

test("runner fails on invalid JSON while retaining the original response for diagnosis", () => {
  const result = runAuditStub({ production: "invalid JSON" });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.reports.policy).ok, false);
  assert.equal(result.reports.production, "invalid JSON");
});

test("runner fails when npm returns a JSON error response", () => {
  const result = runAuditStub({ full: '{"error":{"code":"ECONNRESET"}}', exit: 1 });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.reports.policy).ok, false);
});

for (const omitFile of ["security-audit-exception.json", "package-lock.json"]) {
  test(`runner fails when required ${omitFile} is missing`, () => {
    const result = runAuditStub({ omitFile });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.reports.policy).ok, false);
  });
}

test("runner fails without npm invocation and does not preserve old success", () => {
  const result = runAuditStub({ npmMissing: true });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.reports.policy).ok, false);
  assert.deepEqual(JSON.parse(result.reports.production), {});
});

test("runner remains failed even when it cannot create its report directory", () => {
  assert.equal(runAuditStub({ reportPathIsFile: true }).status, 1);
});
