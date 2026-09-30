import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
import { toRepoRelative } from "./paths.js";

const execFileAsync = promisify(execFile);

const SEVERITY_MAP: Record<string, Finding["severity"]> = {
  ERROR: "high",
  WARNING: "medium",
  INFO: "low",
};

interface SemgrepResult {
  results: Array<{
    check_id: string;
    path: string;
    start: { line: number };
    extra: {
      severity: string;
      message: string;
      lines?: string;
    };
  }>;
}

function toFindings(repoPath: string, parsed: SemgrepResult): Finding[] {
  return parsed.results.map((r, i) => ({
    id: `semgrep-${i}-${r.check_id}`,
    tool: "semgrep" as const,
    category: "sast" as const,
    ruleId: r.check_id,
    severity: SEVERITY_MAP[r.extra.severity] ?? "medium",
    file: toRepoRelative(repoPath, r.path),
    line: r.start.line,
    message: r.extra.message,
    snippet: r.extra.lines,
  }));
}

export async function runSemgrep(repoPath: string): Promise<Finding[]> {
  try {
    const { stdout } = await execFileAsync(
      "semgrep",
      [
        "scan",
        "--config",
        "p/security-audit",
        "--config",
        "p/owasp-top-ten",
        "--config",
        "p/ci",
        "--json",
        "--quiet",
        "--timeout",
        "120",
        repoPath,
      ],
      { maxBuffer: 1024 * 1024 * 64 }
    );
    return toFindings(repoPath, JSON.parse(stdout));
  } catch (err: any) {
    // semgrep exits non-zero when findings exist under some configs; stdout still has JSON.
    if (err.stdout) {
      try {
        return toFindings(repoPath, JSON.parse(err.stdout));
      } catch {
        // fall through to warning below
      }
    }
    console.warn(`[sense:semgrep] skipped — ${err.message ?? err}`);
    return [];
  }
}
