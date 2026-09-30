import fs from "node:fs";
import path from "node:path";

const IMPORT_PATTERNS = [
  /\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?['"](\.[^'"]+)['"]/g,
  /\brequire\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g,
];

const CANDIDATE_SUFFIXES = ["", ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", "/index.js", "/index.ts"];

function resolveOnDisk(repoPath: string, fromFileDir: string, importPath: string): string | undefined {
  const base = path.resolve(repoPath, fromFileDir, importPath);
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = base + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(repoPath, candidate).split(path.sep).join("/");
    }
  }
  return undefined;
}

/**
 * Best-effort static import resolution (JS/TS): scans a file's source for relative
 * import/require/dynamic-import specifiers and resolves each to a real file on disk.
 * Used so the Verifier can see referenced model/schema files, not just the flagged route file —
 * without this, checks like a Mongoose `unique: true` constraint living in a separate model file
 * are invisible to it.
 */
export function resolveLocalImports(repoPath: string, filePath: string, opts: { max?: number } = {}): string[] {
  const max = opts.max ?? 4;
  const fullPath = path.join(repoPath, filePath);
  let content: string;
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch {
    return [];
  }

  const fromDir = path.dirname(filePath);
  const resolved = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      if (resolved.size >= max) break;
      const importPath = match[1];
      const hit = resolveOnDisk(repoPath, fromDir, importPath);
      if (hit && hit !== filePath) resolved.add(hit);
    }
  }

  return [...resolved].slice(0, max);
}
