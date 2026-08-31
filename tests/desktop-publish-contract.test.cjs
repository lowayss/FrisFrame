const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/desktop-builds.yml"), "utf8");
const releasePreflight = fs.readFileSync(path.join(root, ".github/workflows/release-preflight.yml"), "utf8");

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

const tagGuards = workflow.match(/Validate release tag matches package version/g) || [];
assert.equal(tagGuards.length, 2,
  "both macOS and Windows tagged builds must validate the tag against package.json");
assert.match(workflow, /GITHUB_REF_NAME/,
  "tagged builds must compare the actual Git ref name");
assert.match(workflow, /require\('\.\/package\.json'\)\.version/,
  "tagged builds must derive the expected release tag from package.json");

assert.match(releasePreflight, /workflow_dispatch/,
  "release signing preflight must be manually runnable before creating a tag");
assert.match(releasePreflight, /release_tag/,
  "release preflight must take the intended release tag as explicit input");
assert.match(releasePreflight, /Secret values were not printed/,
  "release preflight must document that secret values are never printed");

for (const secretName of [
  "MAC_CSC_LINK",
  "MAC_CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
]) {
  assert.ok(releasePreflight.includes(`secrets.${secretName}`),
    `release preflight must check ${secretName}`);
}

console.log("desktop-publish-contract: publishing isolated, release tag guarded, and signing preflight covered");
