import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

/** Makes a disposable copy of the repo so the verifier can boot/mutate it without touching the analyzed clone. */
export function makeDisposableCopy(repoPath: string): string {
  const root = path.join(os.tmpdir(), "sentinelai-sandboxes");
  fs.mkdirSync(root, { recursive: true });
  const dest = fs.mkdtempSync(path.join(root, "run-"));
  copyDir(repoPath, dest);
  return dest;
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

export function cleanupSandbox(sandboxPath: string): void {
  try {
    fs.rmSync(sandboxPath, { recursive: true, force: true });
  } catch {
    // best-effort cleanup — leftover temp dirs are harmless
  }
}
