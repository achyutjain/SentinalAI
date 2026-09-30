import type { Finding, BusinessLogicNote, AttackChain } from "../types.js";
import { chatStructured } from "./llm.js";
import { plannerResponseSchema } from "./schemas.js";
import { PLANNER_SYSTEM_PROMPT } from "./prompts.js";
import { config } from "../config.js";
import { formatFindingsBlock } from "./findingsBudget.js";

export async function runPlannerAgent(
  findings: Finding[],
  notes: BusinessLogicNote[]
): Promise<AttackChain[]> {
  if (notes.length === 0 && findings.length === 0) return [];

  const findingsBlock = formatFindingsBlock(findings, 25);

  const notesBlock = notes
    .map(
      (n, i) =>
        `- [note-${i}] ${n.endpoint.method ?? ""} ${n.endpoint.route} (${n.endpoint.file}:${n.endpoint.line ?? "?"})\n` +
        `  intended rule: ${n.intendedRule}\n  concern: ${n.concern}\n  related: ${n.relatedFindingIds.join(", ") || "none"}`
    )
    .join("\n");

  const userPrompt = `SCANNER FINDINGS:\n${findingsBlock || "(none)"}\n\nBUSINESS-LOGIC NOTES (index is the array position, use it for businessLogicNoteIndex):\n${notesBlock || "(none)"}`;

  const response = await chatStructured(
    [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    (raw) => plannerResponseSchema.parse(raw),
    { model: config.llm.groq.plannerModel, temperature: 0.3 }
  );

  return response.chains;
}
