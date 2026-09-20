import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = resolve("src");
const testFiles = [];

function collectTests(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTests(path);
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      testFiles.push(path);
    }
  }
}

collectTests(sourceRoot);
testFiles.sort();

if (testFiles.length === 0) {
  console.error("No TypeScript test files were found under src.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
