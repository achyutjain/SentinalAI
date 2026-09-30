import path from "node:path";

/** Normalizes a scanner-reported path to a forward-slash path relative to the repo root. */
export function toRepoRelative(repoPath: string, reportedPath: string): string {
  const abs = path.isAbsolute(reportedPath) ? reportedPath : path.resolve(repoPath, reportedPath);
  return path.relative(path.resolve(repoPath), abs).split(path.sep).join("/");
}
