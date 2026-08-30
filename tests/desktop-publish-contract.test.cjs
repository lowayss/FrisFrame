const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/desktop-builds.yml"), "utf8");

for (const command of [
  "npx electron-builder --mac dmg zip --arm64 --publish never",
  "npx electron-builder --win nsis --x64 --publish never",
  "npx electron-builder --mac dmg zip --arm64 --publish never --config.forceCodeSigning=true --config.mac.notarize=true",
  "npx electron-builder --win nsis --x64 --publish never --config.forceCodeSigning=true",
]) {
  assert.ok(workflow.includes(command), `desktop workflow must disable implicit publishing: ${command}`);
}

assert.match(workflow, /name:\s*Publish GitHub Release/,
  "tagged release publishing must stay in the dedicated release job");
assert.match(workflow, /GH_TOKEN:\s*\$\{\{ github\.token \}\}/,
  "the dedicated release job must use the scoped GitHub token");
assert.match(workflow, /gh release (?:upload|create)/,
  "release assets must be published explicitly with the GitHub CLI");

const builderCommands = workflow.match(/(?:npx\s+)?electron-builder[^\n]*/g) || [];
assert.ok(builderCommands.length >= 4, "expected desktop package commands for unsigned and tagged builds");
for (const command of builderCommands) {
  assert.match(command, /--publish never/,
    `electron-builder must never own GitHub publishing in CI: ${command.trim()}`);
}

console.log("desktop-publish-contract: electron-builder publishing disabled and release ownership isolated");
