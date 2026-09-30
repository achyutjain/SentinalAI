import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { Finding } from "../types.js";

const ROUTE_PATTERNS = [
  /app\.(get|post|put|delete|patch)\s*\(/i,
  /router\.(get|post|put|delete|patch)\s*\(/i,
  /@app\.route/i,
  /@(get|post|put|delete|patch)\(/i, // FastAPI-style decorators
  /class\s+\w+View/i, // Django class-based views
];

const SOURCE_GLOBS = ["**/*.{js,jsx,ts,tsx,py,rb,go,java}"];
const IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/venv/**",
  "**/__pycache__/**",
];

export interface CodeExcerpt {
  file: string;
  content: string;
}

/**
 * Picks a bounded set of source files most likely to contain business logic —
 * prioritizing files that scanners already flagged and files that look like route handlers —
 * and returns their contents (truncated) within a total character budget for the LLM prompt.
 */
export async function collectCodeContext(
  repoPath: string,
  findings: Finding[],
  opts: { maxFiles?: number; maxTotalChars?: number; maxFileChars?: number } = {}
): Promise<CodeExcerpt[]> {
  const maxFiles = opts.maxFiles ?? 10;
  // Kept well under typical free-tier LLM per-request token budgets (e.g. Groq's on-demand TPM
  // limit) even after adding the findings summary and system prompt on top of this.
  const maxTotalChars = opts.maxTotalChars ?? 18_000;
  const maxFileChars = opts.maxFileChars ?? 4_000;

  const allFiles = await fg(SOURCE_GLOBS, { cwd: repoPath, ignore: IGNORE_GLOBS, dot: false });
  const findingFiles = new Set(findings.map((f) => f.file.replace(/\\/g, "/")));

  const scored = allFiles.map((rel) => {
    let score = 0;
    if (findingFiles.has(rel)) score += 5;
    const full = path.join(repoPath, rel);
    let text = "";
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      return { rel, score: -1, text: "" };
    }
    if (ROUTE_PATTERNS.some((p) => p.test(text))) score += 3;
    if (/coupon|discount|checkout|order|payment|refund|cart|auth|session|token/i.test(rel)) score += 2;
    return { rel, score, text };
  });

  const picked = scored
    .filter((f) => f.score >= 0 && f.text.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles);

  const excerpts: CodeExcerpt[] = [];
  let budget = maxTotalChars;
  for (const f of picked) {
    if (budget <= 0) break;
    const content = f.text.slice(0, Math.min(maxFileChars, budget));
    excerpts.push({ file: f.rel, content });
    budget -= content.length;
  }
  return excerpts;
}
