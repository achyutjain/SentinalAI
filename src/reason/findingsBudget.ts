import type { Finding } from "../types.js";

const SEVERITY_WEIGHT: Record<Finding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * Caps the findings handed to an LLM prompt so a large repo (hundreds of dependency CVEs, say)
 * can't blow past the provider's per-request token limit and crash the whole run. Keeps the
 * highest-severity findings, and spreads the cap across tools so one noisy scanner (osv-scanner
 * commonly returns many entries for one repeatedly-vulnerable package) can't crowd out the others.
 */
export function capFindingsForPrompt(findings: Finding[], max = 40): { kept: Finding[]; omitted: number } {
  if (findings.length <= max) return { kept: findings, omitted: 0 };

  const byTool = new Map<string, Finding[]>();
  for (const f of findings) {
    const bucket = byTool.get(f.tool) ?? [];
    bucket.push(f);
    byTool.set(f.tool, bucket);
  }
  for (const bucket of byTool.values()) {
    bucket.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);
  }

  const tools = [...byTool.keys()];
  const perTool = Math.max(1, Math.floor(max / tools.length));
  const kept: Finding[] = [];
  for (const tool of tools) {
    kept.push(...(byTool.get(tool) ?? []).slice(0, perTool));
  }
  kept.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);

  const finalKept = kept.slice(0, max);
  return { kept: finalKept, omitted: findings.length - finalKept.length };
}

export function formatFindingsBlock(findings: Finding[], max = 40): string {
  const { kept, omitted } = capFindingsForPrompt(findings, max);
  const lines = kept.map(
    (f) => `- [${f.id}] (${f.severity}, ${f.category}) ${f.file}:${f.line ?? "?"} — ${f.message}`
  );
  if (omitted > 0) {
    lines.push(`… and ${omitted} more lower-priority findings omitted for space.`);
  }
  return lines.join("\n") || "(none)";
}
