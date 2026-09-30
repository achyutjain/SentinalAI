#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { runPipeline } from "./pipeline.js";
import { config, hasGitHubApp } from "./config.js";

const program = new Command();

program
  .name("sentinelai")
  .description("Autonomous AI security analyst — chains scanner findings into verified attack stories.")
  .version("0.1.0");

program
  .command("scan")
  .description("Run the full Connect → Sense → Reason → Verify → Report pipeline against a repo or a local folder")
  .argument("<target>", 'A GitHub repo ("owner/name" or a full URL), or a local folder path — no GitHub setup needed for local scans')
  .option("--publish", "Open the report as a GitHub issue (and verified fixes as PRs). Requires a GitHub repo target, not a local one.", false)
  .action(async (repo: string, options: { publish: boolean }) => {
    let spinner = ora();
    try {
      const { output } = await runPipeline(repo, {
        publishToGitHub: options.publish,
        onStage: (stage, detail) => {
          spinner.stop();
          spinner = ora({ text: `${chalk.bold(stage)}${detail ? ` — ${detail}` : ""}` }).start();
        },
      });
      spinner.succeed("Pipeline complete");

      console.log("");
      console.log(chalk.bold(`Markdown report: ${output.markdownPath}`));
      console.log(chalk.bold(`HTML report:     ${output.htmlPath}`) + chalk.gray("  (open this in a browser — diagrams render offline)"));
      if (output.issueUrl) console.log(chalk.green(`GitHub issue: ${output.issueUrl}`));
      for (const pr of output.prUrls) console.log(chalk.green(`Fix PR opened: ${pr}`));
      if (options.publish && output.prUrls.length === 0) {
        console.log(chalk.yellow("No verified chain produced a safe single-file patch — no PR opened."));
      }
    } catch (err: any) {
      spinner.fail("Pipeline failed");
      console.error(chalk.red(err.stack ?? err.message ?? err));
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Check that SentinelAI's dependencies (LLM provider, GitHub auth, scanners) are configured")
  .action(async () => {
    console.log(chalk.bold("SentinelAI environment check\n"));

    console.log(`LLM provider: ${config.llm.provider}`);
    if (config.llm.provider === "groq") {
      console.log(config.llm.groq.apiKey ? chalk.green("  ✓ GROQ_API_KEY set") : chalk.red("  ✗ GROQ_API_KEY missing"));
    } else {
      console.log(`  Ollama base URL: ${config.llm.ollama.baseUrl} (model: ${config.llm.ollama.model})`);
    }

    console.log("\nGitHub auth:");
    if (hasGitHubApp()) {
      console.log(chalk.green("  ✓ GitHub App configured (acts as the app for issues/PRs)"));
    } else if (config.github.token) {
      console.log(chalk.yellow("  ~ Using GITHUB_TOKEN (personal access token) fallback"));
    } else {
      console.log(chalk.yellow("  ~ No auth configured — read-only access to public repos only"));
    }

    console.log("\nRun `npm run setup:tools` to fetch/verify Semgrep + Gitleaks.");
  });

program.parseAsync(process.argv);
