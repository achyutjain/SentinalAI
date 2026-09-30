import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
import { toRepoRelative } from "./paths.js";

const execFileAsync = promisify(execFile);

const SEVERITY_MAP: Record<string, Finding["severity"]> = {
  CRITICAL: "critical",
  HIGH: "high",
  MODERATE: "medium",
  MEDIUM: "medium",
  LOW: "low",
};

interface OsvVulnerability {
  id: string;
  summary?: string;
  aliases?: string[];
  database_specific?: { severity?: string };
}

interface OsvPackageResult {
  package: { name: string; version: string; ecosystem: string };
  vulnerabilities?: OsvVulnerability[];
}

interface OsvSourceResult {
  source: { path: string; type: string };
  packages?: OsvPackageResult[];
}

interface OsvOutput {
  results?: OsvSourceResult[];
}

function resolveOsvScannerBinary(): string {
  const localBinName = process.platform === "win32" ? "osv-scanner.exe" : "osv-scanner";
  const local = path.resolve(".sentinelai", "bin", localBinName);
  if (fs.existsSync(local)) return local;
  return "osv-scanner"; // fall back to PATH
}

function toFindings(repoPath: string, parsed: OsvOutput): Finding[] {
  const findings: Finding[] = [];
  let i = 0;
  for (const source of parsed.results ?? []) {
    const file = toRepoRelative(repoPath, source.source.path);
    for (const pkg of source.packages ?? []) {
      for (const vuln of pkg.vulnerabilities ?? []) {
        const cve = vuln.aliases?.find((a) => a.startsWith("CVE-"));
        const rawSeverity = vuln.database_specific?.severity ?? "MEDIUM";
        findings.push({
          id: `osv-${i++}-${vuln.id}`,
          tool: "osv-scanner",
          category: "dependency",
          ruleId: cve ?? vuln.id,
          severity: SEVERITY_MAP[rawSeverity] ?? "medium",
          file,
          message: `${pkg.package.name}@${pkg.package.version} (${pkg.package.ecosystem}): ${vuln.summary ?? vuln.id}`,
          snippet: vuln.id,
        });
      }
    }
  }
  return findings;
}

/**
 * Recursively finds and scans every dependency manifest/lockfile in the repo (npm, pip, Go,
 * Maven/Gradle, Cargo, RubyGems, NuGet, and more) against the OSV vulnerability database —
 * unlike a single `npm audit` at the repo root, this also catches manifests nested in
 * subdirectories (e.g. a `Backend/` + `Frontend/` monorepo layout).
 */
export async function runOsvScanner(repoPath: string): Promise<Finding[]> {
  const binary = resolveOsvScannerBinary();
  try {
    const { stdout } = await execFileAsync(binary, ["scan", "source", "-r", repoPath, "--format", "json"], {
      maxBuffer: 1024 * 1024 * 64,
    });
    return toFindings(repoPath, JSON.parse(stdout || "{}"));
  } catch (err: any) {
    // osv-scanner exits non-zero when vulnerabilities are found; JSON is still on stdout.
    if (err.stdout) {
      try {
        return toFindings(repoPath, JSON.parse(err.stdout || "{}"));
      } catch {
        // fall through to warning below
      }
    }
    console.warn(
      `[sense:osv-scanner] skipped — ${err.message ?? err}. Run "npm run setup:tools" to install osv-scanner.`
    );
    return [];
  }
}
