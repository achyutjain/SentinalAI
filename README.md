# SentinelAI

Autonomous AI security analyst — built for **InnovaHack Chapter 1 (Elite Forums, Cybersecurity domain)**.

SentinelAI reasons about a codebase the way an attacker would: it runs proven open-source scanners to map
the attack surface, then uses an LLM reasoning layer to read business intent, compose individually-boring
findings into realistic multi-step attack chains, and **verifies** which of those chains actually work
before reporting anything. The output is not "100 vulnerabilities" — it's a short list of confirmed attack
stories, each with a plain-English narrative and a suggested fix.

```
Connect → Sense → Reason → Verify → Report
```

| Stage | What runs | Code |
|---|---|---|
| **Connect** | Clone the target repo (GitHub App or PAT auth) | [`src/connect`](src/connect) |
| **Sense** | Semgrep (security-audit + owasp-top-ten + ci rulesets), Gitleaks, OSV-Scanner — raw signal, not the answer | [`src/sense`](src/sense) |
| **Reason** | Business-Logic agent (reads intent) + Planner agent (composes attack chains) | [`src/reason`](src/reason) |
| **Verify** | Dynamic race-condition check in a disposable sandbox, or static LLM re-analysis | [`src/verify`](src/verify) |
| **Report** | Self-contained HTML report (attack graphs render offline) + Markdown + optional GitHub Issue/PR | [`src/report`](src/report) |

Hackathon scope (per the pitch deck): prove the loop end-to-end on **one high-impact chain type** —
business-logic + token race conditions — done well, rather than shallow coverage of many chain types.
The fixture app in [`fixtures/vulnerable-shop`](fixtures/vulnerable-shop) reproduces exactly the scenario
from the deck: a coupon-redemption endpoint with an unlocked check-then-commit race, reachable via a
freely-issued guest session token.

## Quickstart

```bash
npm install
npm run setup:tools     # downloads gitleaks, verifies semgrep is on PATH
cp .env.example .env    # fill in GROQ_API_KEY only — that's all you need to start
npm run dev -- doctor   # sanity-check config
```

That's the entire required setup. **No GitHub account, App, or token needed** to find and verify issues —
GitHub auth is only involved if you later want SentinelAI to open the results as an Issue/PR itself.

Scan any local folder — a project on disk, something you have open in VS Code, anything:

```bash
npm run dev -- scan ./path/to/some/project
npm run dev -- scan "C:\Users\you\Projects\myapp"
```

Or the bundled vulnerable demo app, with no target to type at all:

```bash
npm run demo
```

Or a public GitHub repo directly, by URL or `owner/repo` — still no auth required, just slower than local
since it clones first:

```bash
npm run dev -- scan owner/repo
```

Only if you want it to open a real GitHub Issue/PR with the findings, add `--publish` — this is the one
feature that needs GitHub auth (see below).

```bash
npm run dev -- scan owner/repo --publish
```

## Configuration (`.env`)

### LLM (Reason / Verify / Report agents) — required

SentinelAI's reasoning layer runs on open-source models — no OpenAI or Claude API required.

- `LLM_PROVIDER=groq` (default, recommended) — hosted Llama 3.3 70B via [Groq](https://console.groq.com/keys),
  free tier, fast. Set `GROQ_API_KEY`. This is the only thing you need to configure to start scanning.
- `LLM_PROVIDER=ollama` — fully local (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`). No API key, but needs enough local
  hardware to run a capable model, and the LLM client architecture (`src/reason/llm.ts`) is provider-agnostic
  so this is a drop-in swap.

### GitHub (only needed for `--publish`) — optional

Plain `scan` (no `--publish`) never touches GitHub auth: local folders skip GitHub entirely, and public
GitHub repos clone anonymously. Auth only matters if you want `--publish` to open a real Issue/PR:

1. **GitHub App** (recommended) — acts *as the app* when opening Issues/PRs, rather than as you personally.
   Create one at <https://github.com/settings/apps/new> with permissions: Contents (Read & write), Issues
   (Read & write), Pull requests (Read & write). Install it on the target repo, then set `GITHUB_APP_ID`,
   `GITHUB_APP_PRIVATE_KEY_PATH` (path to the downloaded `.pem`), and `GITHUB_APP_INSTALLATION_ID` (from the
   installation URL: `github.com/settings/installations/<id>`). The App only ever has access to repos you
   explicitly install it on — it cannot act on arbitrary repos.
2. **Personal access token** fallback — set `GITHUB_TOKEN`. Simpler one-liner for testing `--publish` against
   a repo you own, at the cost of the Issue/PR appearing as posted by you instead of "SentinelAI".

### Verify stage

- `VERIFY_RACE_CONCURRENCY` (default 200) — concurrent requests fired at a suspected race-condition endpoint.
- `VERIFY_BOOT_TIMEOUT_SECONDS` (default 25) — how long to wait for a sandboxed app to boot before giving up
  and falling back to static re-analysis.

## How Verify actually works

For a candidate `race-condition` chain, SentinelAI:

1. Asks the LLM to synthesize a concrete request plan from the flagged endpoint's source (method, path,
   body, and how to obtain a session/token via a prerequisite call) — see [`src/verify/requestSpec.ts`](src/verify/requestSpec.ts).
2. Copies the repo into a disposable temp sandbox (never touches the analyzed clone), `npm install`s if
   needed, and boots it on a free local port.
3. Gets **one** session/token, then fires `VERIFY_RACE_CONCURRENCY` concurrent copies of the target request
   reusing that same session — using a non-pooled HTTP client ([`src/verify/httpClient.ts`](src/verify/httpClient.ts))
   so requests genuinely land concurrently instead of serializing through Node's default keep-alive pool.
4. Counts how many were treated as successful. More than one succeeding confirms the race (the business
   rule implied only one should).
5. Kills the sandboxed process and deletes the temp copy either way.

If the app isn't a bootable local HTTP server, or it fails to boot in time, SentinelAI falls back to a
**static re-verification**: a separate, skeptical LLM pass that re-reads the exact code and only confirms
the chain if it can cite a specific missing lock/transaction — otherwise it kills the candidate as a false
positive. This is the mechanism that keeps the false-positive rate down without dynamic execution.

The static re-verifier also resolves the flagged file's own local imports (e.g. a route handler's data
model) and reads those too — this is specifically so mitigations that live in a *different* file than the
vulnerable pattern (e.g. a Mongoose `unique: true` constraint in a model file) aren't invisible to it. In
testing against a real repo, this correctly demoted a "duplicate user registration" race chain to "not
confirmed" once it could see the model's unique constraint, instead of overclaiming account-takeover impact.

## Project layout

```
src/
  connect/    GitHub App/PAT auth, repo parsing + shallow clone
  sense/      Semgrep / Gitleaks / OSV-Scanner wrappers, path normalization
  reason/     LLM client (Groq | Ollama), Business-Logic agent, Planner agent, per-request token budgeting
  verify/     Disposable sandbox, process/port utils, dynamic race verifier, static re-verifier, local import resolution
  report/     Markdown + self-contained HTML report, Mermaid attack graphs, patch drafting, GitHub issue/PR creation
  pipeline.ts Orchestrates Connect → Sense → Reason → Verify → Report (Reason/Verify failures degrade gracefully instead of crashing the run)
  cli.ts      Commander entrypoint (`scan`, `doctor`)
fixtures/vulnerable-shop/   Deliberately vulnerable demo app (coupon race condition + secrets + command injection)
scripts/      setup-tools.ts (fetches gitleaks + osv-scanner), demo.ts (local pipeline run against the fixture)
```

## Known limitations (hackathon scope)

- Dynamic *execution* verification currently targets one pattern: an unlocked session-scoped
  check-then-commit race, matching the deck's worked example. Non-Node/Express apps, or chains that aren't
  race conditions, fall back to static LLM re-analysis rather than live exploitation — dependency
  vulnerabilities (via OSV-Scanner) and secrets (via Gitleaks) don't need this distinction, since those are
  confirmed by the scanner itself, not the Verify stage.
- Semgrep's anonymous (non-logged-in) JSON output redacts the `lines` snippet field on some rules — findings
  are still fully accurate (rule, file, line, message), just without an inline code excerpt in the table.
- The auto-generated fix PR only fires for verified chains where the Planner could point to a single
  responsible file; multi-file or schema-migration-shaped fixes are intentionally left as a suggestion only.

## Reliability on larger, real-world repos

Two things exist specifically so a scan on a real company repo (hundreds of dependency findings, not a toy
fixture) can't silently fail or crash:

- **Per-request token budgeting** ([`src/reason/findingsBudget.ts`](src/reason/findingsBudget.ts)) — every
  LLM call caps and prioritizes findings by severity (spread across tools so one noisy scanner can't crowd
  out the others) before they go into a prompt, instead of dumping the full findings list and risking a
  provider's per-request token limit. Hit this for real during development: a monorepo with 113 raw findings
  blew past Groq's on-demand tier limit and crashed the run before this existed.
- **Graceful degradation** ([`src/pipeline.ts`](src/pipeline.ts)) — if the Reason or Verify stage errors out
  (rate limit, provider hiccup, network blip), the pipeline logs it and continues with what it has (Sense
  findings alone, or unconfirmed chains) rather than crashing with zero output. A partial report beats no
  report.

## Roadmap (post-hackathon, per the pitch deck)

More chain types beyond business-logic races, CI/CD integration (run on every PR via the GitHub App
webhook), and a dashboard — breadth was explicitly scoped out of the hackathon build in favor of proving
one high-impact chain type end-to-end.
