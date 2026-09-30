import fs from "node:fs";
import path from "node:path";
import type { AttackChain, BusinessLogicNote, VerificationResult } from "../types.js";
import { config } from "../config.js";
import { synthesizeRequestSpec, type RequestSpec } from "./requestSpec.js";
import { makeDisposableCopy, cleanupSandbox } from "./sandbox.js";
import { getFreePort, startProcess, killProcessTree, waitForHttpReady } from "./processUtil.js";
import { fireStatus } from "./httpClient.js";

async function fetchJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getToken(baseUrl: string, spec: RequestSpec): Promise<{ token?: string; cookie?: string }> {
  if (!spec.prerequisite || !spec.tokenExtract) return {};
  const res = await fetch(`${baseUrl}${spec.prerequisite.path}`, {
    method: spec.prerequisite.method,
    headers: { "content-type": "application/json" },
    body: spec.prerequisite.body ? JSON.stringify(spec.prerequisite.body) : undefined,
  });
  if (spec.tokenExtract.from === "set-cookie-header") {
    return { cookie: res.headers.get("set-cookie") ?? undefined };
  }
  const body = await fetchJsonOrText(res);
  if (typeof body === "object" && body !== null && spec.tokenExtract.field) {
    const token = (body as Record<string, unknown>)[spec.tokenExtract.field];
    if (typeof token === "string") return { token };
  }
  return {};
}

function buildHeaders(spec: RequestSpec, auth: { token?: string; cookie?: string }): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (spec.target.tokenInjection === "authorization-bearer" && auth.token) {
    headers.authorization = `Bearer ${auth.token}`;
  }
  if (spec.target.tokenInjection === "cookie" && auth.cookie) {
    headers.cookie = auth.cookie;
  }
  return headers;
}

export async function runDynamicRaceVerifier(
  repoPath: string,
  chain: AttackChain,
  note: BusinessLogicNote | undefined
): Promise<VerificationResult> {
  const spec = await synthesizeRequestSpec(repoPath, chain, note);

  if (!spec.bootable) {
    return {
      chainId: chain.id,
      verified: false,
      method: "skipped",
      summary: `Dynamic verification skipped: ${spec.reason ?? "app was not identified as a bootable local HTTP server"}.`,
    };
  }

  const sandboxPath = makeDisposableCopy(repoPath);
  let child: ReturnType<typeof startProcess> | undefined;

  try {
    if (fs.existsSync(path.join(sandboxPath, "package.json")) && !fs.existsSync(path.join(sandboxPath, "node_modules"))) {
      const install = startProcess(sandboxPath, "npm", ["install", "--no-audit", "--no-fund"], process.env);
      await new Promise<void>((resolve) => install.on("exit", () => resolve()));
    }

    const port = await getFreePort();
    const env = { ...process.env, [spec.portEnvVar]: String(port), PORT: String(port) };
    const [cmd, ...args] = spec.startCommand!.split(" ");
    child = startProcess(sandboxPath, cmd, args, env);

    const baseUrl = `http://127.0.0.1:${port}`;
    const ready = await waitForHttpReady(baseUrl, config.verify.bootTimeoutSeconds);
    if (!ready) {
      return {
        chainId: chain.id,
        verified: false,
        method: "skipped",
        summary: `Dynamic verification skipped: sandboxed app did not become ready within ${config.verify.bootTimeoutSeconds}s.`,
      };
    }

    const auth = await getToken(baseUrl, spec);
    const headers = buildHeaders(spec, auth);
    const concurrency = config.verify.raceConcurrency;

    const body = spec.target.body ? JSON.stringify(spec.target.body) : undefined;
    // Fired without a concurrency limiter on purpose — the whole point is to hit the endpoint
    // with every request landing inside the same unlocked check-then-commit window.
    const requests = Array.from({ length: concurrency }, () =>
      fireStatus(`${baseUrl}${spec.target.path}`, { method: spec.target.method, headers, body })
    );
    const statuses = await Promise.all(requests);
    const successCount = statuses.filter((s) => s < spec.successStatusBelow).length;

    const raceConfirmed = successCount > 1;
    return {
      chainId: chain.id,
      verified: raceConfirmed,
      method: "dynamic-race-check",
      summary: raceConfirmed
        ? `Confirmed: fired ${concurrency} concurrent requests against ${spec.target.method} ${spec.target.path} reusing one session — ${successCount} were treated as successful when the business rule implies only 1 should be.`
        : `Not confirmed: fired ${concurrency} concurrent requests against ${spec.target.method} ${spec.target.path} — only ${successCount} succeeded, consistent with the endpoint being properly guarded.`,
      evidence: { concurrency, successCount, sampleStatuses: statuses.slice(0, 20) },
    };
  } catch (err: any) {
    return {
      chainId: chain.id,
      verified: false,
      method: "skipped",
      summary: `Dynamic verification errored, falling back to static re-analysis: ${err.message ?? err}`,
    };
  } finally {
    if (child) killProcessTree(child);
    cleanupSandbox(sandboxPath);
  }
}
