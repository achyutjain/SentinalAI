import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { chatStructured } from "../reason/llm.js";
import { config } from "../config.js";
import type { AttackChain, BusinessLogicNote } from "../types.js";

export const requestSpecSchema = z.object({
  bootable: z.boolean(),
  reason: z.string().optional(),
  startCommand: z.string().optional(), // e.g. "node server.js" or "npm start"
  portEnvVar: z.string().default("PORT"),
  prerequisite: z
    .object({
      method: z.string(),
      path: z.string(),
      body: z.record(z.any()).optional(),
    })
    .nullable(),
  tokenExtract: z
    .object({
      from: z.enum(["json-body", "set-cookie-header"]),
      field: z.string().optional(), // json field name, when from = json-body
    })
    .nullable(),
  target: z.object({
    method: z.string(),
    path: z.string(),
    body: z.record(z.any()).optional(),
    tokenInjection: z.enum(["authorization-bearer", "cookie", "none"]),
  }),
  successStatusBelow: z.number().default(300),
});

export type RequestSpec = z.infer<typeof requestSpecSchema>;

const SYSTEM_PROMPT = `You are the Verifier agent's request-synthesizer inside SentinelAI.

You are given a proposed race-condition attack chain and the source code of the relevant endpoint(s).
Your job is to produce a concrete, minimal HTTP request plan that a verifier could execute against a
LIVE local instance of this app to test whether the race condition is real. This will run in a disposable
sandbox — it is safe to attempt.

If the app looks bootable as a plain Node/Express-style HTTP server (has a package.json with a start
script, or a clear entrypoint like server.js/app.js/index.js listening on process.env.PORT), set
bootable=true and give a startCommand. If you cannot tell how to boot it, or it's not a Node HTTP server,
set bootable=false and explain why in "reason" — do not guess.

The scenario to test: get ONE session/token via an optional prerequisite request (e.g. a guest-session
endpoint), then the verifier will fire MANY CONCURRENT copies of the "target" request reusing that same
session/token, and count how many are treated as successful. Populate body fields with plausible minimal
values based on what the handler code reads from req.body / req.query.

Respond with ONLY a JSON object matching this shape (no prose, no markdown fences):
{
  "bootable": true,
  "startCommand": "node server.js",
  "portEnvVar": "PORT",
  "prerequisite": { "method": "POST", "path": "/session/guest", "body": {} },
  "tokenExtract": { "from": "json-body", "field": "token" },
  "target": { "method": "POST", "path": "/coupon/redeem", "body": { "code": "SAVE10" }, "tokenInjection": "authorization-bearer" },
  "successStatusBelow": 300
}
If no prerequisite/session step exists, set "prerequisite" and "tokenExtract" to null and "tokenInjection" to "none".`;

export async function synthesizeRequestSpec(
  repoPath: string,
  chain: AttackChain,
  note: BusinessLogicNote | undefined
): Promise<RequestSpec> {
  const files = new Set<string>();
  if (note) files.add(note.endpoint.file);

  let packageJson = "";
  const pkgPath = path.join(repoPath, "package.json");
  if (fs.existsSync(pkgPath)) packageJson = fs.readFileSync(pkgPath, "utf8").slice(0, 2000);

  const codeBlocks = [...files]
    .map((f) => {
      try {
        return `--- FILE: ${f} ---\n${fs.readFileSync(path.join(repoPath, f), "utf8").slice(0, 4000)}`;
      } catch {
        return `--- FILE: ${f} --- (could not read)`;
      }
    })
    .join("\n\n");

  const userPrompt =
    `ATTACK CHAIN:\n${JSON.stringify(chain, null, 2)}\n\n` +
    `BUSINESS-LOGIC NOTE:\n${note ? JSON.stringify(note, null, 2) : "(none)"}\n\n` +
    `package.json:\n${packageJson || "(none found)"}\n\n` +
    `RELEVANT SOURCE:\n${codeBlocks || "(none found)"}`;

  return chatStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    (raw) => requestSpecSchema.parse(raw),
    { model: config.llm.groq.plannerModel, temperature: 0.1 }
  );
}
