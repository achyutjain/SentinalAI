import type { Finding, BusinessLogicNote } from "../types.js";
import { collectCodeContext } from "./codeContext.js";
import { chatStructured } from "./llm.js";
import { businessLogicResponseSchema } from "./schemas.js";
import { BUSINESS_LOGIC_SYSTEM_PROMPT } from "./prompts.js";
import { config } from "../config.js";
import { formatFindingsBlock } from "./findingsBudget.js";

export async function runBusinessLogicAgent(
  repoPath: string,
  findings: Finding[]
): Promise<BusinessLogicNote[]> {
  const excerpts = await collectCodeContext(repoPath, findings);
  if (excerpts.length === 0) return [];

  const findingsBlock = formatFindingsBlock(findings, 25);

  const codeBlock = excerpts
    .map((e) => `--- FILE: ${e.file} ---\n${e.content}`)
    .join("\n\n");

  const userPrompt = `SCANNER FINDINGS:\n${findingsBlock || "(none)"}\n\nSOURCE FILES:\n${codeBlock}`;

  const response = await chatStructured(
    [
      { role: "system", content: BUSINESS_LOGIC_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    (raw) => businessLogicResponseSchema.parse(raw),
    { model: config.llm.groq.reasoningModel, temperature: 0.1 }
  );

  return response.notes;
}
