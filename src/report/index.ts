import fs from "node:fs";
import path from "node:path";
import type { Octokit } from "@octokit/rest";
import type { SentinelReport } from "../types.js";
import { buildMarkdownReport } from "./markdownReport.js";
import { buildHtmlReport } from "./htmlReport.js";
import { createReportIssue, createFixPullRequest } from "./githubReport.js";
import { draftPatch } from "./patchAgent.js";

export interface ReportOutput {
  markdownPath: string;
  markdown: string;
  htmlPath: string;
  issueUrl?: string;
  prUrls: string[];
}

export async function report(
  sentinelReport: SentinelReport,
  opts: { publishToGitHub: boolean; octokit?: Octokit; outDir?: string }
): Promise<ReportOutput> {
  const markdown = buildMarkdownReport(sentinelReport);
  const html = buildHtmlReport(sentinelReport);

  const outDir = opts.outDir ?? "reports";
  fs.mkdirSync(outDir, { recursive: true });
  const baseName = `${sentinelReport.repo.owner}-${sentinelReport.repo.name}-${Date.now()}`;
  const markdownPath = path.join(outDir, `${baseName}.md`);
  const htmlPath = path.join(outDir, `${baseName}.html`);
  fs.writeFileSync(markdownPath, markdown, "utf8");
  fs.writeFileSync(htmlPath, html, "utf8");

  const result: ReportOutput = { markdownPath, markdown, htmlPath, prUrls: [] };

  if (opts.publishToGitHub && opts.octokit) {
    result.issueUrl = await createReportIssue(opts.octokit, sentinelReport.repo, markdown);

    for (const vc of sentinelReport.chains) {
      if (!vc.verification.verified) continue;
      const note =
        vc.chain.businessLogicNoteIndex != null
          ? sentinelReport.businessLogicNotes[vc.chain.businessLogicNoteIndex]
          : undefined;
      const patch = await draftPatch(sentinelReport.repo.localPath, vc.chain, note);
      if (patch.applicable && patch.file && patch.newContent) {
        const prUrl = await createFixPullRequest(
          opts.octokit,
          sentinelReport.repo,
          vc.chain,
          patch.file,
          patch.newContent,
          patch.explanation
        );
        result.prUrls.push(prUrl);
      }
    }
  }

  return result;
}
