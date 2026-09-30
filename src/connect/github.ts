import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { simpleGit } from "simple-git";
import { config, hasGitHubApp } from "../config.js";
import type { RepoContext } from "../types.js";

export interface ParsedRepo {
  owner: string;
  name: string;
  ref?: string;
}

/** Accepts "owner/name", a full GitHub URL, or a URL with a #ref / tree/branch suffix. */
export function parseRepoInput(input: string): ParsedRepo {
  let cleaned = input.trim().replace(/\.git$/, "");

  if (!cleaned.includes("github.com") && cleaned.split("/").length === 2) {
    const [owner, name] = cleaned.split("/");
    return { owner, name };
  }

  const url = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  const owner = parts[0];
  const name = parts[1];
  let ref: string | undefined;
  if (parts[2] === "tree" && parts[3]) {
    ref = parts.slice(3).join("/");
  }
  if (!owner || !name) {
    throw new Error(`Could not parse repository from "${input}". Use "owner/repo" or a GitHub URL.`);
  }
  return { owner, name, ref };
}

/**
 * Returns an authenticated Octokit client.
 * Prefers a GitHub App installation token (acts "as the app" for Issues/PRs),
 * falls back to a personal access token, and finally to unauthenticated (public, rate-limited) access.
 */
export async function getOctokit(): Promise<{ octokit: Octokit; authMode: "app" | "token" | "anonymous" }> {
  if (hasGitHubApp()) {
    const privateKey = fs.readFileSync(config.github.appPrivateKeyPath!, "utf8");
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.github.appId!,
        privateKey,
        installationId: config.github.appInstallationId!,
      },
    });
    return { octokit, authMode: "app" };
  }

  if (config.github.token) {
    return {
      octokit: new Octokit({ auth: config.github.token }),
      authMode: "token",
    };
  }

  return { octokit: new Octokit(), authMode: "anonymous" };
}

/** Returns a short-lived token usable in a git remote URL for cloning, if any auth is configured. */
async function getCloneToken(): Promise<string | undefined> {
  if (hasGitHubApp()) {
    const privateKey = fs.readFileSync(config.github.appPrivateKeyPath!, "utf8");
    const auth = createAppAuth({
      appId: config.github.appId!,
      privateKey,
      installationId: config.github.appInstallationId!,
    });
    const installationAuth = await auth({ type: "installation" });
    return installationAuth.token;
  }
  if (config.github.token) return config.github.token;
  return undefined;
}

export async function cloneRepo(parsed: ParsedRepo): Promise<RepoContext> {
  const token = await getCloneToken();
  const remote = token
    ? `https://x-access-token:${token}@github.com/${parsed.owner}/${parsed.name}.git`
    : `https://github.com/${parsed.owner}/${parsed.name}.git`;

  const workspaceRoot = path.join(os.tmpdir(), "sentinelai-workspaces");
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const localPath = fs.mkdtempSync(path.join(workspaceRoot, `${parsed.owner}-${parsed.name}-`));

  const git = simpleGit();
  const cloneArgs = ["--depth", "1"];
  if (parsed.ref) cloneArgs.push("--branch", parsed.ref);
  await git.clone(remote, localPath, cloneArgs);

  return {
    owner: parsed.owner,
    name: parsed.name,
    ref: parsed.ref ?? "default",
    localPath,
  };
}
