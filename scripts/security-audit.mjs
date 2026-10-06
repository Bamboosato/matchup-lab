import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateAudits } from "./security-audit-policy.mjs";

const reportDirectory = ".security-audit";

function audit(npmCli, name, args) {
  const result = spawnSync(process.execPath, [npmCli, "audit", "--json", "--audit-level=low", ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  // Save the unfiltered report before interpreting status or applying the exception.
  writeFileSync(`${reportDirectory}/${name}.json`, result.stdout || "{}\n");
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit (${name}) did not complete: ${result.error?.message || result.status}`);
  }
  return JSON.parse(result.stdout);
}

try {
  const npmCli = process.env.npm_execpath;
  mkdirSync(reportDirectory, { recursive: true });
  // Reset only our reports so a later failure cannot upload a previous success.
  for (const name of ["production", "full"]) writeFileSync(`${reportDirectory}/${name}.json`, "{}\n");
  writeFileSync(`${reportDirectory}/policy.json`, '{"ok":false,"state":"running"}\n');
  if (!npmCli) throw new Error("Run this check with npm run audit:security");
  const production = audit(npmCli, "production", ["--omit=dev"]);
  const full = audit(npmCli, "full", ["--include=dev"]);
  const exception = JSON.parse(readFileSync("security-audit-exception.json", "utf8"));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const result = evaluateAudits({ full, production, lock, exception });
  writeFileSync(`${reportDirectory}/policy.json`, `${JSON.stringify({
    ...result,
    checkedAt: new Date().toISOString(),
    advisory: exception.advisory,
    expires: exception.expires,
  }, null, 2)}\n`);

  console.log("Production vulnerabilities:", production.metadata?.vulnerabilities);
  console.log("All dependency vulnerabilities:", full.metadata?.vulnerabilities);
  if (result.excepted.length) {
    console.log(`Temporary development exception until ${exception.expires}: ${exception.advisory}`);
    console.log("Excepted packages:", result.excepted.join(", "));
  }
  if (!result.ok) {
    console.error("Blocking audit findings:", result.blocked.join(", "));
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Security audit failed:", error.message);
  try {
    writeFileSync(`${reportDirectory}/policy.json`, `${JSON.stringify({ ok: false, error: error.message })}\n`);
  } catch {
    // Reporting errors must not turn a failed audit into success.
  }
  process.exitCode = 1;
}
