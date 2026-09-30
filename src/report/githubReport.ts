import type { Octokit } from "@octokit/rest";
import type { AttackChain, RepoContext } from "../types.js";

export async function createReportIssue(
  octokit: Octokit,
  repo: RepoContext,
  markdownBody: string
): Promise<string> {
  const { data } = await octokit.issues.create({
    owner: repo.owner,
    repo: repo.name,
    title: "SentinelAI: verified attack chain report",
    body: markdownBody,
    labels: ["security", "sentinelai"],
  });
  return data.html_url;
}

export async function createFixPullRequest(
  octokit: Octokit,
  repo: RepoContext,
  chain: AttackChain,
  file: string,
  newContent: string,
  explanation: string
): Promise<string> {
  const { data: repoData } = await octokit.repos.get({ owner: repo.owner, repo: repo.name });
  const baseBranch = repoData.default_branch;

  const { data: baseRef } = await octokit.git.getRef({
    owner: repo.owner,
    repo: repo.name,
    ref: `heads/${baseBranch}`,
  });

  const branchName = `sentinelai/fix-${chain.id}-${Date.now()}`;
  await octokit.git.createRef({
    owner: repo.owner,
    repo: repo.name,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.object.sha,
  });

  const { data: existingFile } = await octokit.repos.getContent({
    owner: repo.owner,
    repo: repo.name,
    path: file,
    ref: branchName,
  });
  const sha = Array.isArray(existingFile) ? undefined : existingFile.sha;

  await octokit.repos.createOrUpdateFileContents({
    owner: repo.owner,
    repo: repo.name,
    path: file,
    message: `fix: ${chain.suggestedFix.summary}\n\nSentinelAI verified "${chain.title}" and drafted this fix.`,
    content: Buffer.from(newContent, "utf8").toString("base64"),
    branch: branchName,
    sha,
  });

  const { data: pr } = await octokit.pulls.create({
    owner: repo.owner,
    repo: repo.name,
    title: `Fix: ${chain.title}`,
    head: branchName,
    base: baseBranch,
    body:
      `**SentinelAI verified this attack chain and drafted a fix.**\n\n` +
      `**Attack story:** ${chain.narrative}\n\n**Impact:** ${chain.impact}\n\n**Fix:** ${explanation}\n\n` +
      `_Review carefully before merging — this patch was generated automatically._`,
  });

  return pr.html_url;
}
