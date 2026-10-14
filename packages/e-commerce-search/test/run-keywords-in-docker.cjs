// Run the isolated ES integration using an existing Search container's network and dependencies.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const handler = fs.readFileSync(
  path.resolve(__dirname, "../dist/handlers/keywords.js"),
  "utf8",
);
const { runKeywordIntegration } = require("./keywords.integration.cjs");
const program = `const path = require('node:path');
(${runKeywordIntegration.toString()})(${JSON.stringify(handler)}, '/app/dist/config/elasticsearch.js', '/app/dist/handlers/codex-keyword-test.js')
.catch(error => { console.error(error); process.exitCode = 1; });`;
// runKeywordIntegration closes over these Node built-ins.
const imports =
  "const assert = require('node:assert/strict'); const { randomUUID } = require('node:crypto'); const Module = require('node:module');\n";
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    process.env.KEYWORD_TEST_CONTAINER || "e-commerce-prod-search-1",
    "node",
  ],
  { input: imports + program, stdio: ["pipe", "inherit", "inherit"] },
);
