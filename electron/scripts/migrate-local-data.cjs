"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const source = path.join(root, "previs_projects.db");
const targetDirectory = path.join(os.homedir(), "Library", "Application Support", "FrisFrame");
const target = path.join(targetDirectory, "data", "frisframe.db");
if (!fs.existsSync(source)) throw new Error(`기존 프로젝트 DB가 없습니다: ${source}`);
fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  console.log(`기존 데스크톱 DB를 유지합니다: ${target}`);
} else {
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  console.log(`프로젝트 DB를 데스크톱 데이터 폴더로 복사했습니다: ${target}`);
}
