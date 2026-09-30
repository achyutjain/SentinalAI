import type { Finding, BusinessLogicNote, AttackChain } from "../types.js";
import { runBusinessLogicAgent } from "./businessLogicAgent.js";
import { runPlannerAgent } from "./plannerAgent.js";

export interface ReasonResult {
  notes: BusinessLogicNote[];
  chains: AttackChain[];
}

export async function reason(repoPath: string, findings: Finding[]): Promise<ReasonResult> {
  const notes = await runBusinessLogicAgent(repoPath, findings);
  const chains = await runPlannerAgent(findings, notes);
  return { notes, chains };
}
