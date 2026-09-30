import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SentinelReport, VerifiedAttackChain, Finding } from "../types.js";
import { renderAttackGraph } from "./attackGraph.js";
import { escapeHtml, REPORT_CSS } from "./htmlTemplate.js";

// Two directories up from this file lands at the package root in both `src/report/` (tsx/dev)
// and the mirrored `dist/report/` (built) layouts.
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let cachedMermaidBundleB64: string | undefined;

/**
 * Returns the Mermaid bundle as base64. Embedding minified third-party JS as literal <script>
 * text is fragile — it (and its own bundled dependencies, e.g. DOMPurify) can contain byte
 * sequences like "</script" or "<script" buried in string literals/comments that make the
 * browser's HTML parser end our tag early, dumping the rest as visible page text. Base64's
 * alphabet cannot produce a "<" character at all, so this sidesteps the entire bug class rather
 * than chasing individual sequences. The base64 text sits inert inside a non-executing
 * <script type="text/plain"> tag, and a tiny bootstrap decodes + injects it as real script via
 * the DOM (textContent), which never goes through HTML parsing.
 */
function loadMermaidBundleBase64(): string {
  if (cachedMermaidBundleB64) return cachedMermaidBundleB64;
  const bundlePath = path.join(PACKAGE_ROOT, "node_modules", "mermaid", "dist", "mermaid.min.js");
  cachedMermaidBundleB64 = fs.readFileSync(bundlePath).toString("base64");
  return cachedMermaidBundleB64;
}

function renderChain(vc: VerifiedAttackChain, verified: boolean): string {
  const { chain, verification } = vc;
  const cardClass = verified ? "chain" : "chain unconfirmed";
  const stampClass = verified ? "stamp verified" : "stamp unconfirmed";
  const stampLabel = verified ? "Verified" : "Not confirmed";
  const verifyLineClass = verified ? "verify-line" : "verify-line unconfirmed";

  const fixHint = chain.suggestedFix.diffHint
    ? `<pre class="mono">${escapeHtml(chain.suggestedFix.diffHint)}</pre>`
    : "";

  return `
  <article class="${cardClass}">
    <div class="chain-head">
      <div><h3 class="chain-title">${escapeHtml(chain.title)}</h3></div>
      <span class="${stampClass}">${stampLabel}</span>
    </div>
    <div class="impact-line"><b>Impact —</b> ${escapeHtml(chain.impact)}</div>
    <p class="narrative">${escapeHtml(chain.narrative)}</p>
    <div class="diagram-panel">
      <div class="cap">Attack graph</div>
      <pre class="mermaid">${escapeHtml(renderAttackGraph(vc))}</pre>
    </div>
    <div class="${verifyLineClass}">
      <span class="tag">Verification · ${escapeHtml(verification.method)}</span>
      ${escapeHtml(verification.summary)}
    </div>
    <div class="fix-line">
      <span class="k">Suggested fix</span>
      ${escapeHtml(chain.suggestedFix.summary)}
      ${fixHint}
    </div>
  </article>`;
}

function severityClass(sev: Finding["severity"]): string {
  if (sev === "critical") return "critical";
  if (sev === "high") return "high";
  if (sev === "medium") return "medium";
  return "low";
}

function renderFindingsTable(findings: Finding[]): string {
  if (findings.length === 0) {
    return `<div class="table-wrap"><div class="empty-note">No raw findings — Semgrep, Gitleaks, and OSV-Scanner found nothing pattern-matchable. Any chains above are business-logic bugs, invisible to rule-based scanners by design; that's the gap the Reason stage exists to close.</div></div>`;
  }
  const rows = findings
    .map(
      (f) => `
        <tr>
          <td><span class="sev ${severityClass(f.severity)}"></span>${escapeHtml(f.severity)}</td>
          <td>${escapeHtml(f.tool)}</td>
          <td class="path">${escapeHtml(f.file)}${f.line ? ":" + f.line : ""}</td>
          <td>${escapeHtml(f.ruleId)}</td>
          <td>${escapeHtml(f.message)}</td>
        </tr>`
    )
    .join("");
  return `
  <div class="table-wrap">
    <table class="evidence-table">
      <thead><tr><th>Severity</th><th>Tool</th><th>Location</th><th>Rule</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export function buildHtmlReport(report: SentinelReport): string {
  const verifiedChains = report.chains.filter((c) => c.verification.verified);
  const unverifiedChains = report.chains.filter((c) => !c.verification.verified);
  const generatedDate = new Date(report.generatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const verifiedSection =
    verifiedChains.length > 0
      ? verifiedChains.map((vc) => renderChain(vc, true)).join("\n")
      : `<div class="table-wrap"><div class="empty-note">None of the candidate chains could be dynamically or statically confirmed this run.</div></div>`;

  const unverifiedSection =
    unverifiedChains.length > 0
      ? `<h2 class="section">Candidate chains — not confirmed</h2>\n` +
        unverifiedChains.map((vc) => renderChain(vc, false)).join("\n")
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SentinelAI Report — ${escapeHtml(report.repo.owner)}/${escapeHtml(report.repo.name)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="page">

  <header class="casefile">
    <div class="top-row">
      <div class="brand"><span class="mark"></span><span class="eyebrow">SentinelAI &nbsp;·&nbsp; Case File</span></div>
      <span class="eyebrow" style="color: var(--ink-faint);">${escapeHtml(generatedDate)}</span>
    </div>
    <h1 class="title serif">Attack chain report</h1>
    <div class="repo-path mono">${escapeHtml(report.repo.owner)}/${escapeHtml(report.repo.name)}</div>
    <div class="meta-row">
      <div class="stat"><span class="n">${report.findings.length}</span><span class="l">Raw findings</span></div>
      <div class="stat"><span class="n">${report.chains.length}</span><span class="l">Candidate chains</span></div>
      <div class="stat"><span class="n hit">${verifiedChains.length}</span><span class="l">Verified</span></div>
    </div>
  </header>

  <h2 class="section">Verified attack stories</h2>
  ${verifiedSection}

  ${unverifiedSection}

  <h2 class="section">Raw findings — Sense stage</h2>
  ${renderFindingsTable(report.findings)}

  <footer>
    Generated locally by SentinelAI · Connect → Sense → Reason → Verify → Report. Diagrams render via a
    bundled, offline copy of Mermaid — no network connection needed to view this file.
  </footer>

</div>
<script id="sentinelai-mermaid-b64" type="text/plain">${loadMermaidBundleBase64()}</script>
<script>
(function () {
  var b64 = document.getElementById("sentinelai-mermaid-b64").textContent;
  var code = atob(b64);
  var s = document.createElement("script");
  s.textContent = code; // DOM text assignment, not HTML parsing — no tag-closing risk here
  document.body.appendChild(s);
  window.mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "base",
    themeVariables: { fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif" } });
})();
</script>
</body>
</html>`;
}
