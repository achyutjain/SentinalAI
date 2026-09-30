import type { Finding } from "../types.js";
import { runSemgrep } from "./semgrep.js";
import { runGitleaks } from "./gitleaks.js";
import { runOsvScanner } from "./osvScanner.js";

/** Runs all sensors in parallel. Each sensor fails soft — a missing tool never aborts the pipeline. */
export async function sense(repoPath: string): Promise<Finding[]> {
  const [semgrepFindings, gitleaksFindings, depFindings] = await Promise.all([
    runSemgrep(repoPath),
    runGitleaks(repoPath),
    runOsvScanner(repoPath),
  ]);
  return [...semgrepFindings, ...gitleaksFindings, ...depFindings];
}
