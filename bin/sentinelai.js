#!/usr/bin/env node
import("../dist/cli.js").catch((err) => {
  console.error("SentinelAI failed to start. Did you run `npm run build`?");
  console.error(err);
  process.exit(1);
});
