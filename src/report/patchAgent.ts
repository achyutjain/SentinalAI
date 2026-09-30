import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { chatStructured } from "../reason/llm.js";
import { config } from "../config.js";
import type { AttackChain, BusinessLogicNote } from "../types.js";

const patchSchema = z.object({
  applicable: z.boolean(),
  file: z.string().optional(),
  newContent: z.string().optional(),
  explanation: z.string(),
});

const SYSTEM_PROMPT = `You are the patch-drafting step of SentinelAI's Report stage. You are given a
VERIFIED attack chain and the current content of the single file most responsible for it. Produce the
smallest possible fix (e.g. add an idempotency key / DB transaction / unique constraint check) that closes
the gap described in the chain, while preserving all unrelated behavior and formatting.

If a safe, minimal, single-file fix is not something you can confidently produce (e.g. the fix needs a
schema migration or spans multiple files), set applicable=false and explain why in "explanation" — do not
guess destructively.

Respond with ONLY a JSON object (no prose, no markdown fences):
{ "applicable": true, "file": "src/routes/coupon.js", "newContent": "<entire new file content>", "explanation": "one-sentence summary of the fix for a PR description" }`;

export async function draftPatch(
  repoPath: string,
  chain: AttackChain,
  note: BusinessLogicNote | undefined
): Promise<z.infer<typeof patchSchema>> {
  if (!note) {
    return { applicable: false, explanation: "No single business-logic note/file associated with this chain." };
  }
  const filePath = path.join(repoPath, note.endpoint.file);
  if (!fs.existsSync(filePath)) {
    return { applicable: false, explanation: `File ${note.endpoint.file} not found in repo.` };
  }
  const original = fs.readFileSync(filePath, "utf8");

  const userPrompt = `ATTACK CHAIN:\n${JSON.stringify(chain, null, 2)}\n\nBUSINESS-LOGIC NOTE:\n${JSON.stringify(
    note,
    null,
    2
  )}\n\nCURRENT FILE (${note.endpoint.file}):\n${original}`;

  return chatStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    (raw) => patchSchema.parse(raw),
    { model: config.llm.groq.reasoningModel, temperature: 0.1 }
  );
}
