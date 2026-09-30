export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const REPORT_CSS = `
:root {
  --bg: #F2F4F3; --surface: #FFFFFF; --surface-2: #E7EAE9;
  --ink: #14181A; --ink-muted: #565F5C; --ink-faint: #8A928F;
  --accent: #0F6E77; --accent-soft: #DCEEEF;
  --critical: #A32B22; --critical-soft: #F6E4E1;
  --warn: #B5751B; --warn-soft: #F5EAD9;
  --neutral-stamp: #565F5C; --neutral-stamp-soft: #E7EAE9;
  --border: #D7DBD9;
  --shadow: 0 1px 2px rgba(20,24,26,.04), 0 8px 24px -12px rgba(20,24,26,.12);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #101513; --surface: #171D1B; --surface-2: #1F2624;
    --ink: #E7ECEA; --ink-muted: #93A19C; --ink-faint: #647069;
    --accent: #4FB8C4; --accent-soft: #16302F;
    --critical: #E5695C; --critical-soft: #2C1917;
    --warn: #E0A542; --warn-soft: #2C2417;
    --neutral-stamp: #8B9793; --neutral-stamp-soft: #1F2624; --border: #2A332F;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px -12px rgba(0,0,0,.5);
  }
}
:root[data-theme="dark"] {
  --bg: #101513; --surface: #171D1B; --surface-2: #1F2624; --ink: #E7ECEA;
  --ink-muted: #93A19C; --ink-faint: #647069; --accent: #4FB8C4; --accent-soft: #16302F;
  --critical: #E5695C; --critical-soft: #2C1917; --warn: #E0A542; --warn-soft: #2C2417;
  --neutral-stamp: #8B9793; --neutral-stamp-soft: #1F2624; --border: #2A332F;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px -12px rgba(0,0,0,.5);
}
:root[data-theme="light"] {
  --bg: #F2F4F3; --surface: #FFFFFF; --surface-2: #E7EAE9; --ink: #14181A;
  --ink-muted: #565F5C; --ink-faint: #8A928F; --accent: #0F6E77; --accent-soft: #DCEEEF;
  --critical: #A32B22; --critical-soft: #F6E4E1; --warn: #B5751B; --warn-soft: #F5EAD9;
  --neutral-stamp: #565F5C; --neutral-stamp-soft: #E7EAE9; --border: #D7DBD9;
  --shadow: 0 1px 2px rgba(20,24,26,.04), 0 8px 24px -12px rgba(20,24,26,.12);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--ink);
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.55; -webkit-font-smoothing: antialiased;
}
.page { max-width: 780px; margin: 0 auto; padding: 56px 24px 96px; }
.serif { font-family: "Iowan Old Style", "Sitka Text", Georgia, "Noto Serif", serif; }
.mono { font-family: "SF Mono", "Cascadia Code", Consolas, "Roboto Mono", monospace; }
.eyebrow { font-size: 11.5px; font-weight: 600; letter-spacing: .11em; text-transform: uppercase; color: var(--accent); }
header.casefile { border: 1px solid var(--border); border-top: 3px solid var(--accent); background: var(--surface); border-radius: 4px; padding: 28px 32px 24px; box-shadow: var(--shadow); }
header.casefile .top-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; }
header.casefile .brand { display: flex; align-items: center; gap: 8px; }
header.casefile .brand .mark { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
h1.title { font-size: clamp(26px,4vw,34px); font-weight: 600; line-height: 1.15; margin: 14px 0 4px; text-wrap: balance; }
.repo-path { color: var(--ink-muted); font-size: 14.5px; word-break: break-word; }
.meta-row { display: flex; gap: 28px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--border); flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat .n { font-family: "SF Mono", Consolas, "Roboto Mono", monospace; font-variant-numeric: tabular-nums; font-size: 21px; font-weight: 600; }
.stat .n.hit { color: var(--critical); }
.stat .l { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); }
h2.section { font-size: 13px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-muted); margin: 48px 0 16px; display: flex; align-items: center; gap: 10px; }
h2.section::after { content: ""; flex: 1; height: 1px; background: var(--border); }
.chain { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 26px 28px 28px; box-shadow: var(--shadow); margin-bottom: 22px; }
.chain.unconfirmed { box-shadow: none; opacity: .88; }
.chain-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.stamp { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 4px 9px; border-radius: 3px; white-space: nowrap; border: 1px solid transparent; }
.stamp.verified { color: var(--critical); background: var(--critical-soft); border-color: color-mix(in srgb, var(--critical) 35%, transparent); }
.stamp.unconfirmed { color: var(--neutral-stamp); background: var(--neutral-stamp-soft); border-color: var(--border); }
h3.chain-title { font-size: 19px; font-weight: 600; margin: 2px 0 0; text-wrap: balance; }
.impact-line { margin-top: 10px; font-size: 14.5px; color: var(--ink-muted); }
.impact-line b { color: var(--ink); font-weight: 600; }
.narrative { margin-top: 14px; font-size: 15px; }
.diagram-panel { margin-top: 20px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 18px 16px 10px; overflow-x: auto; }
.diagram-panel .cap { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 4px; }
.verify-line { margin-top: 18px; font-size: 14px; padding: 12px 14px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 3px 3px 0; }
.verify-line.unconfirmed { border-left-color: var(--neutral-stamp); background: var(--neutral-stamp-soft); }
.verify-line .tag { font-family: "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 11px; color: var(--accent); display: block; margin-bottom: 4px; }
.verify-line.unconfirmed .tag { color: var(--neutral-stamp); }
.fix-line { margin-top: 14px; font-size: 14px; }
.fix-line .k { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-faint); display: block; margin-bottom: 4px; }
.fix-line code, .narrative code, .verify-line code { font-family: "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 12.5px; background: var(--surface-2); padding: 1px 5px; border-radius: 3px; }
.fix-line pre { margin: 6px 0 0; padding: 10px 12px; background: var(--surface-2); border-radius: 3px; overflow-x: auto; font-size: 12.5px; }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); box-shadow: var(--shadow); }
.table-wrap table { min-width: 560px; width: 100%; border-collapse: collapse; font-size: 13px; }
.evidence-table th { text-align: left; font-size: 10.5px; letter-spacing: .07em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; padding: 12px 10px 8px; border-bottom: 1px solid var(--border); }
.evidence-table td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
.evidence-table tr:last-child td { border-bottom: none; }
.evidence-table .path { font-family: "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 12px; white-space: nowrap; }
.sev { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; position: relative; top: -1px; }
.sev.critical { background: var(--critical); }
.sev.high { background: var(--critical); opacity: .75; }
.sev.medium { background: var(--warn); }
.sev.low, .sev.info { background: var(--neutral-stamp); }
.empty-note { padding: 16px; color: var(--ink-faint); font-style: italic; font-size: 13.5px; }
footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 12.5px; color: var(--ink-faint); }
.mermaid { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
`;
