import type { AttackChain, BusinessLogicNote, VerifiedAttackChain } from "../types.js";
import { runDynamicRaceVerifier } from "./dynamicRaceVerifier.js";
import { runStaticReverifier } from "./staticReverifier.js";

export async function verify(
  repoPath: string,
  chains: AttackChain[],
  notes: BusinessLogicNote[]
): Promise<VerifiedAttackChain[]> {
  const results: VerifiedAttackChain[] = [];

  for (const chain of chains) {
    const note = chain.businessLogicNoteIndex != null ? notes[chain.businessLogicNoteIndex] : undefined;

    let verification = await tryDynamic(repoPath, chain, note);
    if (verification.method === "skipped") {
      verification = await runStaticReverifier(repoPath, chain, note);
    }
    results.push({ chain, verification });
  }

  return results;
}

async function tryDynamic(repoPath: string, chain: AttackChain, note: BusinessLogicNote | undefined) {
  if (chain.type !== "race-condition") {
    return { chainId: chain.id, verified: false, method: "skipped" as const, summary: "Not a race-condition chain; using static re-analysis." };
  }
  return runDynamicRaceVerifier(repoPath, chain, note);
}
