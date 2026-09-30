// Runs Sense -> Reason -> Verify -> Report directly against fixtures/vulnerable-shop, skipping the
// Connect stage (no GitHub repo needed). Useful for a live demo and as a GitHub-independent smoke test
// of the full reasoning + verification loop described in the pitch deck.
import path from "node:path";
import chalk from "chalk";
import { sense } from "../src/sense/index.js";
import { reason } from "../src/reason/index.js";
import { verify } from "../src/verify/index.js";
import { report } from "../src/report/index.js";
import type { SentinelReport } from "../src/types.js";

const localPath = path.resolve("fixtures/vulnerable-shop");
const repoCtx = { owner: "demo", name: "vulnerable-shop", ref: "local", localPath };

console.log(chalk.bold("\nSentinelAI demo — scanning fixtures/vulnerable-shop\n"));

console.log(chalk.cyan("[Sense]"), "running Semgrep, Gitleaks, OSV-Scanner...");
const findings = await sense(localPath);
console.log(`  ${findings.length} raw findings`);

console.log(chalk.cyan("[Reason]"), "business-logic agent + planner...");
const { notes, chains } = await reason(localPath, findings);
console.log(`  ${notes.length} business-logic notes, ${chains.length} candidate attack chain(s)`);

console.log(chalk.cyan("[Verify]"), `checking ${chains.length} chain(s)...`);
const verified = await verify(localPath, chains, notes);
for (const v of verified) {
  const icon = v.verification.verified ? chalk.green("VERIFIED") : chalk.gray("not confirmed");
  console.log(`  ${icon} ${v.chain.title} (${v.verification.method})`);
}

const sentinelReport: SentinelReport = {
  repo: repoCtx,
  generatedAt: new Date().toISOString(),
  findings,
  businessLogicNotes: notes,
  chains: verified,
};

console.log(chalk.cyan("[Report]"), "writing markdown + HTML report...");
const output = await report(sentinelReport, { publishToGitHub: false });
console.log(chalk.bold(`\nDone.`));
console.log(`  Markdown: ${output.markdownPath}`);
console.log(`  HTML:     ${output.htmlPath}  ${chalk.gray("(open this in a browser)")}\n`);
