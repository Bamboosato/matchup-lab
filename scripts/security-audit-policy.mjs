const RECORDED_ADVISORY = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const RECORDED_PACKAGES = [
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
];
const SEVERITIES = ["info", "low", "moderate", "high", "critical"];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validAudit(report) {
  if (!isRecord(report) || report.error || report.auditReportVersion !== 2 ||
      !isRecord(report.vulnerabilities) || !isRecord(report.metadata?.vulnerabilities)) return false;

  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]));
  for (const [name, item] of Object.entries(report.vulnerabilities)) {
    if (!isRecord(item) || item.name !== name || !SEVERITIES.includes(item.severity) ||
        !Array.isArray(item.via) || !Array.isArray(item.nodes) ||
        item.nodes.some((node) => typeof node !== "string") ||
        new Set(item.nodes).size !== item.nodes.length) return false;
    counts[item.severity]++;
  }
  const totals = report.metadata.vulnerabilities;
  return SEVERITIES.every((key) => Number.isSafeInteger(totals[key]) && totals[key] === counts[key]) &&
    totals.total === Object.keys(report.vulnerabilities).length;
}

function validException(exception) {
  if (!isRecord(exception) || exception.advisory !== RECORDED_ADVISORY ||
      typeof exception.expires !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(exception.expires) ||
      !Number.isFinite(Date.parse(exception.expires)) ||
      new Date(exception.expires).toISOString().replace(".000Z", "Z") !== exception.expires ||
      typeof exception.owner !== "string" || !exception.owner.trim() ||
      typeof exception.reason !== "string" || !exception.reason.trim() ||
      !isRecord(exception.packages)) return false;
  return Object.keys(exception.packages).length === RECORDED_PACKAGES.length &&
    RECORDED_PACKAGES.every((name) => Object.hasOwn(exception.packages, name) &&
      typeof exception.packages[name] === "string" && /^\d+\.\d+\.\d+$/.test(exception.packages[name]));
}

export function evaluateAudits({ full, production, lock, exception, now = new Date() }) {
  if (!validAudit(full) || !validAudit(production)) {
    return { ok: false, blocked: ["Invalid or unavailable npm audit response"], excepted: [] };
  }
  if (!isRecord(lock?.packages) || !validException(exception) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return { ok: false, blocked: ["Invalid lockfile, exception configuration, or audit time"], excepted: [] };
  }

  // Production findings are always blocking, even if the full audit could except them.
  const blocked = Object.keys(production.vulnerabilities).map((name) => `production: ${name}`);
  const excepted = [];
  const exceptionActive = now.getTime() < Date.parse(exception.expires);

  function allowed(name, seen = new Set()) {
    const item = full.vulnerabilities[name];
    if (!exceptionActive || !item || seen.has(name) ||
        !Object.hasOwn(exception.packages, name) || item.severity === "critical" ||
        item.nodes.length === 0 || item.via.length === 0) return false;
    if (!item.nodes.every((path) => path === `node_modules/${name}` &&
        lock.packages[path]?.dev === true &&
        lock.packages[path].version === exception.packages[name])) return false;

    // Resolve dependency-derived findings all the way to the specific advisory.
    const visited = new Set(seen).add(name);
    return item.via.every((cause) => typeof cause === "string"
      ? allowed(cause, visited)
      : isRecord(cause) && cause.url === exception.advisory &&
        SEVERITIES.includes(cause.severity) && cause.severity !== "critical");
  }

  for (const name of Object.keys(full.vulnerabilities)) {
    if (allowed(name)) excepted.push(name);
    else blocked.push(`full: ${name}`);
  }
  return { ok: blocked.length === 0, blocked, excepted };
}
