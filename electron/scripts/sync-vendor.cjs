"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const vendor = path.join(root, "vendor");
fs.mkdirSync(vendor, { recursive: true });

const files = [
  [path.join(root, "node_modules/three/build/three.min.js"), path.join(vendor, "three.min.js")],
  [path.join(root, "node_modules/lucide/dist/umd/lucide.min.js"), path.join(vendor, "lucide.min.js")],
];
for (const [source, target] of files) {
  if (!fs.existsSync(source)) throw new Error(`npm install 후 다시 실행하세요: ${source}`);
  fs.copyFileSync(source, target);
  console.log(`vendor: ${path.relative(root, target)}`);
}
