import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
import { toRepoRelative } from "./paths.js";

const execFileAsync = promisify(execFile);

interface GitleaksFinding {
  RuleID: string;
  File: string;
  StartLine: number;
  Description: string;
  Match?: string;
  Secret?: string;
}

function resolveGitleaksBinary(): string {
  const localBinName = process.platform === "win32" ? "gitleaks.exe" : "gitleaks";
  const local = path.resolve(".sentinelai", "bin", localBinName);
  if (fs.existsSync(local)) return local;
  return "gitleaks"; // fall back to PATH
}

export async function runGitleaks(repoPath: string): Promise<Finding[]> {
  const binary = resolveGitleaksBinary();
  const reportPath = path.join(repoPath, ".sentinelai-gitleaks-report.json");
  try {
    await execFileAsync(
      binary,
      ["detect", "--source", repoPath, "--no-git", "--report-format", "json", "--report-path", reportPath, "--exit-code", "0"],
      { maxBuffer: 1024 * 1024 * 64 }
    );
    if (!fs.existsSync(reportPath)) return [];
    const raw = fs.readFileSync(reportPath, "utf8").trim();
    fs.rmSync(reportPath, { force: true });
    if (!raw) return [];
    const findings: GitleaksFinding[] = JSON.parse(raw);
    return findings.map((f, i) => ({
      id: `gitleaks-${i}-${f.RuleID}`,
      tool: "gitleaks" as const,
      category: "secret" as const,
      ruleId: f.RuleID,
      severity: "critical" as const,
      file: toRepoRelative(repoPath, f.File),
      line: f.StartLine,
      message: f.Description,
      snippet: f.Match ? f.Match.replace(f.Secret ?? "", "«redacted»") : undefined,
    }));
  } catch (err: any) {
    console.warn(
      `[sense:gitleaks] skipped — ${err.message ?? err}. Run "npm run setup:tools" to install gitleaks.`
    );
    return [];
  }
}
