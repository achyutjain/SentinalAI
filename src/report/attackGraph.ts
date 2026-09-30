import type { VerifiedAttackChain } from "../types.js";

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function wrap(text: string, max = 60): string {
  const clean = text.replace(/"/g, "'");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Renders one attack chain as a Mermaid flowchart, suitable for embedding in a Markdown report. */
export function renderAttackGraph(vc: VerifiedAttackChain): string {
  const { chain, verification } = vc;
  const lines: string[] = ["flowchart LR"];

  chain.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((step, i) => {
      const nodeId = `S${i}`;
      lines.push(`  ${nodeId}["${step.action}: ${wrap(step.description)}"]`);
      if (i > 0) lines.push(`  S${i - 1} --> ${nodeId}`);
    });

  const outcomeId = `V_${sanitize(chain.id)}`;
  const outcomeLabel = verification.verified ? "VERIFIED EXPLOIT" : "NOT CONFIRMED";
  lines.push(`  ${outcomeId}{{"${outcomeLabel}\\n(${verification.method})"}}`);
  if (chain.steps.length > 0) {
    lines.push(`  S${chain.steps.length - 1} --> ${outcomeId}`);
  }

  if (verification.verified) {
    lines.push(`  style ${outcomeId} fill:#7f1d1d,stroke:#ef4444,color:#fff`);
  } else {
    lines.push(`  style ${outcomeId} fill:#374151,stroke:#9ca3af,color:#fff`);
  }

  return lines.join("\n");
}
