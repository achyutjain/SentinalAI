// Fetches the scanner binaries SentinelAI shells out to (gitleaks, osv-scanner) into
// .sentinelai/bin, and confirms semgrep is reachable. Safe to re-run.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TOOLS_DIR = path.resolve(".sentinelai", "bin");
const GITLEAKS_VERSION = "8.30.1";
const OSV_SCANNER_VERSION = "2.4.0";

function arch(): "x64" | "arm64" {
  return process.arch === "arm64" ? "arm64" : "x64";
}

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function ensureGitleaks() {
  const binaryName = process.platform === "win32" ? "gitleaks.exe" : "gitleaks";
  const dest = path.join(TOOLS_DIR, binaryName);
  if (fs.existsSync(dest)) {
    console.log(`[setup] gitleaks already present at ${dest}`);
    return;
  }
  fs.mkdirSync(TOOLS_DIR, { recursive: true });

  const plat = process.platform;
  const a = arch();
  const file =
    plat === "win32"
      ? `gitleaks_${GITLEAKS_VERSION}_windows_${a}.zip`
      : plat === "darwin"
        ? `gitleaks_${GITLEAKS_VERSION}_darwin_${a}.tar.gz`
        : `gitleaks_${GITLEAKS_VERSION}_linux_${a}.tar.gz`;
  const url = `https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${file}`;
  const archivePath = path.join(TOOLS_DIR, file);
  console.log(`[setup] downloading gitleaks from ${url}`);
  await download(url, archivePath);

  if (file.endsWith(".zip")) {
    // Windows: use PowerShell's Expand-Archive, always available.
    execSync(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${archivePath}' -DestinationPath '${TOOLS_DIR}'"`);
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${TOOLS_DIR}"`);
    execSync(`chmod +x "${dest}"`);
  }
  fs.rmSync(archivePath);
  console.log(`[setup] gitleaks ready at ${dest}`);
}

async function ensureOsvScanner() {
  const binaryName = process.platform === "win32" ? "osv-scanner.exe" : "osv-scanner";
  const dest = path.join(TOOLS_DIR, binaryName);
  if (fs.existsSync(dest)) {
    console.log(`[setup] osv-scanner already present at ${dest}`);
    return;
  }
  fs.mkdirSync(TOOLS_DIR, { recursive: true });

  const plat = process.platform;
  // osv-scanner's release assets use Go's arch naming (amd64), unlike gitleaks' (x64).
  const goArch = process.arch === "arm64" ? "arm64" : "amd64";
  const assetName =
    plat === "win32"
      ? `osv-scanner_windows_${goArch}.exe`
      : plat === "darwin"
        ? `osv-scanner_darwin_${goArch}`
        : `osv-scanner_linux_${goArch}`;
  const url = `https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/${assetName}`;
  console.log(`[setup] downloading osv-scanner from ${url}`);
  await download(url, dest);
  if (process.platform !== "win32") execSync(`chmod +x "${dest}"`);
  console.log(`[setup] osv-scanner ready at ${dest}`);
}

function checkSemgrep() {
  try {
    const version = execSync("semgrep --version", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    console.log(`[setup] semgrep found: v${version}`);
  } catch {
    console.warn("[setup] semgrep not found on PATH. Install with: pip install semgrep");
  }
}

async function main() {
  checkSemgrep();
  await ensureGitleaks();
  await ensureOsvScanner();
  console.log("[setup] done.");
}

main().catch((err) => {
  console.error("[setup] failed:", err);
  process.exit(1);
});
