import fs from "node:fs";
import path from "node:path";
import type { RepoContext, SentinelReport } from "./types.js";
import { parseRepoInput, cloneRepo, getOctokit } from "./connect/github.js";
import { sense } from "./sense/index.js";
import { reason } from "./reason/index.js";
import { verify } from "./verify/index.js";
import { report as buildReport, type ReportOutput } from "./report/index.js";

export interface PipelineOptions {
  publishToGitHub: boolean;
  onStage?: (stage: string, detail?: string) => void;
}

/** True if `input` points at an existing local file or folder rather than a GitHub repo reference. */
function isLocalPath(input: string): boolean {
  if (input.includes("github.com") || /^https?:\/\//.test(input)) return false;
  return fs.existsSync(input);
}

export async function runPipeline(
  repoInput: string,
  opts: PipelineOptions
): Promise<{ sentinelReport: SentinelReport; output: ReportOutput }> {
  const emit = opts.onStage ?? (() => {});
  let publishToGitHub = opts.publishToGitHub;

  emit("connect", `resolving "${repoInput}"`);
  let repoCtx: RepoContext;
  let octokit: Awaited<ReturnType<typeof getOctokit>>["octokit"] | undefined;

  if (isLocalPath(repoInput)) {
    const localPath = path.resolve(repoInput);
    const stat = fs.statSync(localPath);
    const dir = stat.isDirectory() ? localPath : path.dirname(localPath);
    emit("connect", `scanning local path ${dir} (no GitHub involved)`);
    repoCtx = { owner: "local", name: path.basename(dir), ref: "local", localPath: dir };
    if (publishToGitHub) {
      emit("connect", "--publish ignored: local scans have no GitHub repo to open an issue/PR against");
      publishToGitHub = false;
    }
  } else {
    const parsed = parseRepoInput(repoInput);
    const auth = await getOctokit();
    octokit = auth.octokit;
    emit("connect", `cloning ${parsed.owner}/${parsed.name} (auth: ${auth.authMode})`);
    repoCtx = await cloneRepo(parsed);
  }

  emit("sense", "running Semgrep, Gitleaks, OSV-Scanner");
  const findings = await sense(repoCtx.localPath);
  emit("sense", `${findings.length} raw findings`);

  emit("reason", "business-logic agent reading intent");
  let notes: SentinelReport["businessLogicNotes"] = [];
  let chains: Awaited<ReturnType<typeof reason>>["chains"] = [];
  try {
    ({ notes, chains } = await reason(repoCtx.localPath, findings));
    emit("reason", `${notes.length} business-logic notes, ${chains.length} candidate attack chain(s)`);
  } catch (err: any) {
    // A single LLM call failing (rate limit, provider hiccup) shouldn't nuke the whole scan —
    // degrade to a Sense-only report rather than crashing with zero output.
    emit("reason", `skipped after an error — continuing with Sense findings only (${err.message ?? err})`);
  }

  emit("verify", `verifying ${chains.length} chain(s)`);
  let verified: SentinelReport["chains"] = chains.map((chain) => ({
    chain,
    verification: { chainId: chain.id, verified: false, method: "skipped", summary: "Verification skipped." },
  }));
  try {
    verified = await verify(repoCtx.localPath, chains, notes);
    const verifiedCount = verified.filter((v) => v.verification.verified).length;
    emit("verify", `${verifiedCount}/${chains.length} confirmed`);
  } catch (err: any) {
    emit("verify", `skipped after an error — chains will be reported as unconfirmed (${err.message ?? err})`);
  }

  const sentinelReport: SentinelReport = {
    repo: repoCtx,
    generatedAt: new Date().toISOString(),
    findings,
    businessLogicNotes: notes,
    chains: verified,
  };

  emit("report", publishToGitHub ? "writing report + publishing to GitHub" : "writing local report");
  const output = await buildReport(sentinelReport, {
    publishToGitHub,
    octokit,
  });

  return { sentinelReport, output };
}
