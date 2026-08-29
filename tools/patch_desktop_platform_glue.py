from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"expected text not found in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


main = ROOT / "electron" / "main.cjs"
replace_once(
    main,
    'const { spawn } = require("node:child_process");',
    'const { spawn, spawnSync } = require("node:child_process");',
)
replace_once(
    main,
    '''function resolveServerLaunch() {\n  if (app.isPackaged) {\n    return {\n      command: packagedRuntimePath(path.join("server", "frisframe-server")),\n      args: [],\n      ffmpeg: packagedRuntimePath("ffmpeg"),\n    };\n  }\n  return {\n    command: process.env.FRISFRAME_PYTHON || "python3.11",\n    args: [path.join(app.getAppPath(), "server.py")],\n    ffmpeg: require("ffmpeg-static"),\n  };\n}\n''',
    '''function resolveServerLaunch() {\n  if (app.isPackaged) {\n    const serverName = process.platform === "win32" ? "frisframe-server.exe" : "frisframe-server";\n    const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";\n    return {\n      command: packagedRuntimePath(path.join("server", serverName)),\n      args: [],\n      ffmpeg: packagedRuntimePath(ffmpegName),\n    };\n  }\n  return {\n    command: process.env.FRISFRAME_PYTHON || (process.platform === "win32" ? "python" : "python3.11"),\n    args: [path.join(app.getAppPath(), "server.py")],\n    ffmpeg: require("ffmpeg-static"),\n  };\n}\n''',
)
replace_once(
    main,
    '''function killServerProcess() {\n  const child = serverProcess;\n  serverProcess = null;\n  if (!child || child.exitCode !== null) return;\n  try {\n    process.kill(-child.pid, "SIGTERM");\n  } catch {\n    try { child.kill("SIGTERM"); } catch { return; }\n  }\n  setTimeout(() => {\n    if (child.exitCode !== null) return;\n    try { process.kill(-child.pid, "SIGKILL"); } catch {\n      try { child.kill("SIGKILL"); } catch { /* Process already ended. */ }\n    }\n  }, 2500).unref();\n}\n''',
    '''function killServerProcess() {\n  const child = serverProcess;\n  serverProcess = null;\n  if (!child || child.exitCode !== null) return;\n  if (process.platform === "win32") {\n    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });\n    if (result.status !== 0) {\n      try { child.kill(); } catch { /* Process already ended. */ }\n    }\n    return;\n  }\n  try {\n    process.kill(-child.pid, "SIGTERM");\n  } catch {\n    try { child.kill("SIGTERM"); } catch { return; }\n  }\n  setTimeout(() => {\n    if (child.exitCode !== null) return;\n    try { process.kill(-child.pid, "SIGKILL"); } catch {\n      try { child.kill("SIGKILL"); } catch { /* Process already ended. */ }\n    }\n  }, 2500).unref();\n}\n''',
)
replace_once(
    main,
    '''  if (app.isPackaged) {\n    fs.chmodSync(launch.command, 0o755);\n    fs.chmodSync(launch.ffmpeg, 0o755);\n  }\n''',
    '''  if (app.isPackaged && process.platform !== "win32") {\n    fs.chmodSync(launch.command, 0o755);\n    fs.chmodSync(launch.ffmpeg, 0o755);\n  }\n''',
)
replace_once(
    main,
    '''    detached: true,\n    stdio: ["ignore", "pipe", "pipe"],\n''',
    '''    detached: process.platform !== "win32",\n    windowsHide: true,\n    stdio: ["ignore", "pipe", "pipe"],\n''',
)

contract = ROOT / "tests" / "electron-contract.test.cjs"
replace_once(
    contract,
    'const packageVerifier = fs.readFileSync(path.join(root, "electron/scripts/verify-package.cjs"), "utf8");\n',
    'const packageVerifier = fs.readFileSync(path.join(root, "electron/scripts/verify-package.cjs"), "utf8");\nconst runtimeStager = fs.readFileSync(path.join(root, "electron/scripts/stage-runtime.cjs"), "utf8");\nconst afterPack = fs.readFileSync(path.join(root, "electron/after-pack.cjs"), "utf8");\nconst desktopWorkflow = fs.readFileSync(path.join(root, ".github/workflows/desktop-builds.yml"), "utf8");\n',
)
replace_once(
    contract,
    'assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "runtime/server"));\nassert.ok(packageJson.build.extraResources.some((entry) => entry.to === "runtime/ffmpeg"));\n',
    'assert.ok(packageJson.build.extraResources.some((entry) => entry.to === "runtime" && entry.from === "dist-runtime/staged-runtime"));\n',
)
replace_once(
    contract,
    'assert.ok(readme.includes(`FrisFrame-${packageJson.version}-arm64.dmg`));\n',
    'assert.ok(readme.includes(`FrisFrame-${packageJson.version}-arm64.dmg`));\nassert.ok(readme.includes(`FrisFrame-${packageJson.version}-x64.exe`));\n',
)
replace_once(
    contract,
    'assert.ok(packageVerifier.includes(\'fs.accessSync(path.join(resources, "ffmpeg"), fs.constants.X_OK)\'), "package verification must check FFmpeg executable permission");\n',
    '''assert.ok(packageVerifier.includes('"ffmpeg.exe"'), "Windows package verification must require ffmpeg.exe");\nassert.ok(packageVerifier.includes('"frisframe-server.exe"'), "Windows package verification must require the packaged server exe");\n''',
)
marker = 'assert.ok(packageJson.build.files.includes("electron/file-save.cjs"));\n'
extra = '''assert.equal(packageJson.scripts["desktop:build:mac"], "npm run desktop:prepare && electron-builder --mac dmg zip --arm64");\nassert.equal(packageJson.scripts["desktop:build:win"], "npm run desktop:prepare && electron-builder --win nsis --x64");\nassert.ok(packageJson.build.win.target.includes("nsis"));\nassert.equal(packageJson.build.nsis.oneClick, false);\nassert.match(runtimeBuilder, /darwin-arm64/);\nassert.match(runtimeBuilder, /win32-x64/);\nassert.match(runtimeBuilder, /x86_64-pc-windows-msvc-install_only_stripped\\.tar\\.gz/);\nassert.match(runtimeBuilder, /24168aff2e7d93784c6a436124c4ebb79b076a4e289bde4902c08333507b71d0/);\nassert.match(runtimeBuilder, /python\\.exe/);\nassert.match(runtimeBuilder, /Scripts/);\nassert.match(runtimeStager, /require\\("ffmpeg-static"\\)/);\nassert.match(runtimeStager, /ffmpeg\\.exe/);\nassert.match(main, /frisframe-server\\.exe/);\nassert.match(main, /ffmpeg\\.exe/);\nassert.match(main, /taskkill/);\nassert.match(main, /windowsHide:\\s*true/);\nassert.match(afterPack, /electronPlatformName === "win32"/);\nassert.match(desktopWorkflow, /name: macOS · Apple Silicon/);\nassert.match(desktopWorkflow, /runs-on: macos-latest/);\nassert.match(desktopWorkflow, /name: Windows · x64/);\nassert.match(desktopWorkflow, /runs-on: windows-latest/);\nassert.match(desktopWorkflow, /name: FrisFrame-macOS-arm64/);\nassert.match(desktopWorkflow, /name: FrisFrame-Windows-x64/);\n'''
replace_once(contract, marker, marker + extra)

readme = ROOT / "README.md"
old = '''## macOS 데스크톱 앱\n\nApple Silicon용 설치 이미지는 버전에 따라 `release/FrisFrame-0.4.0-arm64.dmg` 형태로 생성됩니다. DMG를 열고 FrisFrame을 Applications 폴더로 옮겨 실행합니다. 현재 빌드는 로컬 검증용 미서명 버전이며, 외부 배포 전에는 Apple Developer ID 서명과 notarization이 필요합니다.\n\n기존 로컬 서버 프로젝트를 데스크톱 앱으로 처음 옮기고 패키지를 다시 만드는 명령은 다음과 같습니다.\n\n```bash\nnpm install\nnpm run check\nnpm run desktop:migrate-data\nnpm run desktop:build\n```\n\n프로젝트와 자동 저장 데이터는 앱 파일 밖의 `~/Library/Application Support/FrisFrame/data/frisframe.db`에 보존됩니다. 앱을 교체하거나 업데이트해도 이 DB는 패키징 과정에서 덮어쓰지 않습니다. Three.js와 Lucide는 앱 안에서 오프라인으로 로드하며, MP4용 FFmpeg도 앱 런타임에 포함됩니다.\n'''
new = '''## 데스크톱 앱 · macOS / Windows\n\n같은 소스에서 두 데스크톱 버전을 빌드합니다. GitHub Actions의 `Desktop builds` 워크플로에는 `macOS · Apple Silicon`과 `Windows · x64` 두 작업이 별도로 표시됩니다. 성공한 빌드는 각각 `FrisFrame-macOS-arm64`, `FrisFrame-Windows-x64` Artifact로 받을 수 있고, `v*` 버전 태그에서는 두 플랫폼 파일을 GitHub Release에 함께 게시합니다.\n\n- macOS Apple Silicon: `release/FrisFrame-0.4.0-arm64.dmg` 및 ZIP\n- Windows x64: `release/FrisFrame-0.4.0-x64.exe` NSIS 설치 파일\n\n현재 데스크톱 빌드는 미서명 개발 빌드입니다. macOS 외부 배포에는 Apple Developer ID 서명/notarization이, Windows에서 SmartScreen 경고를 줄이려면 코드 서명이 필요합니다.\n\n로컬에서 플랫폼별 패키지를 만드는 명령은 다음과 같습니다.\n\n```bash\nnpm install\nnpm run check\n# Apple Silicon Mac\nnpm run desktop:build:mac\n# Windows x64\nnpm run desktop:build:win\n```\n\n기존 로컬 서버 프로젝트를 데스크톱 앱으로 옮길 때는 `npm run desktop:migrate-data`를 사용할 수 있습니다. 프로젝트와 자동 저장 데이터는 Electron의 플랫폼별 사용자 데이터 폴더에 보존되며 앱을 교체하거나 업데이트해도 패키징 과정에서 덮어쓰지 않습니다. Three.js와 Lucide는 앱 안에서 오프라인으로 로드하고, 플랫폼에 맞는 Python 서버와 FFmpeg도 앱 런타임에 포함합니다.\n'''
replace_once(readme, old, new)

print("desktop platform glue patched")
