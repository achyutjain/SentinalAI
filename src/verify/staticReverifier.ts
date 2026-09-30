import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chatStructured } from "../reason/llm.js";
import { config } from "../config.js";
import type { AttackChain, BusinessLogicNote, VerificationResult } from "../types.js";
import { resolveLocalImports } from "./importResolver.js";

const resultSchema = z.object({
  confirmed: z.boolean(),
  explanation: z.string(),
  citedEvidence: z.string(),
});

const SYSTEM_PROMPT = `You are the Verifier agent inside SentinelAI, doing a static (non-dynamic) re-check
of an attack chain proposed by the Planner agent. You could not run the app dynamically, so you must be
conservative: re-read the exact source code involved and confirm ONLY if you can point to specific lines
that prove the vulnerable condition (e.g. no lock/transaction/idempotency check between a read and a write
that should be atomic). If the code has a mitigation the Planner missed (a mutex, a unique constraint in a
model/schema file, a transaction, rate limiting), say confirmed=false and explain why — you are given the
flagged file's own local imports (e.g. its data model) specifically so you can catch mitigations that live
in a different file than the one with the vulnerable pattern. If a mitigation only narrows the impact
rather than eliminating it (e.g. a DB unique constraint prevents true duplicates but the code still leaks
an unhandled error), confirm=true but describe the narrower real impact precisely instead of the original
speculative one.

Respond with ONLY a JSON object (no prose, no markdown fences):
{ "confirmed": true, "explanation": "...", "citedEvidence": "quote or line reference" }`;

export async function runStaticReverifier(
  repoPath: string,
  chain: AttackChain,
  note: BusinessLogicNote | undefined
): Promise<VerificationResult> {
  const files = new Set<string>();
  if (note) {
    files.add(note.endpoint.file);
    for (const imported of resolveLocalImports(repoPath, note.endpoint.file)) {
      files.add(imported);
    }
  }

  // Budget shrinks as more files are pulled in (primary file + its local imports) to stay well
  // under typical free-tier LLM per-request token limits.
  const perFileBudget = Math.max(1500, Math.floor(12_000 / files.size));
  const codeBlocks = [...files]
    .map((f) => {
      try {
        return `--- FILE: ${f} ---\n${fs.readFileSync(path.join(repoPath, f), "utf8").slice(0, perFileBudget)}`;
      } catch {
        return `--- FILE: ${f} --- (could not read)`;
      }
    })
    .join("\n\n");

  const userPrompt = `ATTACK CHAIN:\n${JSON.stringify(chain, null, 2)}\n\nBUSINESS-LOGIC NOTE:\n${
    note ? JSON.stringify(note, null, 2) : "(none)"
  }\n\nSOURCE:\n${codeBlocks || "(none available)"}`;

  const result = await chatStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    (raw) => resultSchema.parse(raw),
    { model: config.llm.groq.reasoningModel, temperature: 0.1 }
  );

  return {
    chainId: chain.id,
    verified: result.confirmed,
    method: "static-reanalysis",
    summary: result.explanation,
    evidence: { citedEvidence: result.citedEvidence },
  };
}
