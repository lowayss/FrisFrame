# FrisFrame

**한국어** | [English](README.en.md)

**Seedance 레퍼런스를 위한 키프레임 기반 프리비즈 도구**

FrisFrame은 **Seedance에 넣을 레퍼런스 MP4를 만드는 브라우저/Electron 기반 프리비즈 도구**입니다. 최종 영상을 생성하기 전에 **카메라 움직임, 배우 블로킹, 타이밍, 프레이밍, 렌즈 변화, 공간 관계**를 미리 설계하고 영상 레퍼런스로 출력합니다.

FrisFrame 자체가 영상을 생성하는 AI는 아닙니다. 이미지 해석이나 최종 Seedance 프롬프트 작성도 FrisFrame 내부 기능이 아닙니다.

```text
FrisFrame에서 프리비즈 제작
        ↓
기준 프레임 + 첫·끝 프레임 + 프리비즈 MP4 출력
        ↓
필요한 이미지 자산은 외부 생성 도구에서 제작
        ↓
프리비즈 MP4를 Seedance Video Reference로 사용
        ↓
Seedance가 최종 영상 생성
```

목표는 프리비즈 자체를 자연스럽고 화려하게 만드는 것이 아닙니다. 핵심은 **Seedance에 필요한 움직임과 공간 정보만 정확하게 담은 깨끗하고 제어 가능한 레퍼런스 MP4**를 만드는 것입니다.

[![Quality and security](https://github.com/lowayss/FrisFrame/actions/workflows/quality-security.yml/badge.svg)](https://github.com/lowayss/FrisFrame/actions/workflows/quality-security.yml)
[![Desktop builds](https://github.com/lowayss/FrisFrame/actions/workflows/desktop-builds.yml/badge.svg)](https://github.com/lowayss/FrisFrame/actions/workflows/desktop-builds.yml)

## 튜토리얼 영상

FrisFrame의 기본 사용 흐름과 실제 작업 방법은 아래 영상에서 확인할 수 있습니다.

[![FrisFrame 튜토리얼 영상](https://img.youtube.com/vi/MrU2jYmMLTg/maxresdefault.jpg)](https://www.youtube.com/watch?v=MrU2jYmMLTg)

> 위 미리보기 이미지를 클릭하면 YouTube 튜토리얼 영상으로 이동합니다.

## FrisFrame은 무엇을 위한 프로그램인가요?

```text
스토리보드 / 샷 계획
        ↓
2D + 3D 블로킹
        ↓
카메라 + 배우 + 소품 키프레임
        ↓
프레임 정확 H.264 프리비즈 MP4
        ↓
Seedance Video Reference
        ↓
Seedance 최종 생성 영상
```

FrisFrame의 가장 중요한 원칙은 단순합니다.

> **Seedance가 참고해야 하는 움직임만 보여주고, 자연스러운 세부 동작과 최종 표현은 Seedance에 맡긴다.**

그래서 카메라 움직임은 정밀하게 설계할 수 있지만 배우 움직임은 의도적으로 최소한만 전달합니다. 사용자가 직접 작성하지 않은 **자동 걷기 사이클, 팔 흔들기, 몸 바운스, 호흡, 불필요한 보조 움직임**을 자동으로 추가하지 않습니다.

## 두 가지 작업 방식

### 수동 작업

FrisFrame 안에서 무대, 배우, 소품, 카메라, 렌즈와 키프레임을 직접 편집합니다. 같은 프로젝트에서 2D/3D 블로킹과 타임라인을 오가며 수정한 뒤 프리비즈 MP4를 출력합니다.

### MCP 보조 작업

외부 MCP 클라이언트가 레퍼런스 이미지와 자연어 지시를 해석한 뒤 **명시적인 FrisFrame 무대/카메라/키프레임 명령**을 보낼 수 있습니다. 이미지 이해와 언어 추론은 MCP 클라이언트의 역할이며 FrisFrame 자체는 AI API를 호출하지 않습니다.

MCP로 생성된 결과도 일반 FrisFrame 프로젝트와 일반 키프레임이므로 이후 UI에서 그대로 수동 수정할 수 있습니다. 수동 편집과 MCP 편집은 같은 프로젝트 revision을 사용해 충돌을 방지합니다.

지원되는 결정적 MCP 도구는 프로젝트 조회, 무대 배치, 명시적 모션 타임라인, 모션 매크로, 통합 프리비즈 계획 적용입니다. 모션 매크로는 카메라 오빗, 돌리+줌, 지브, 배우 추적, 두 배우 접근, 대상 이동 등을 일반 키프레임으로 확장합니다.

## 다운로드 / 데스크톱 빌드

**일반 사용자는 소스 코드를 직접 실행하기보다 GitHub Releases의 설치 파일을 사용하는 것을 권장합니다.**

- [GitHub Releases에서 FrisFrame 다운로드](https://github.com/lowayss/FrisFrame/releases)
- macOS Apple Silicon: `.dmg`
- Windows x64: `.exe`

FrisFrame은 하나의 소스에서 macOS와 Windows 두 플랫폼을 빌드합니다.

| 플랫폼 | 지원 환경 | 설치 파일 |
| --- | --- | --- |
| macOS | Apple Silicon | `FrisFrame-0.6.0-arm64.dmg` + ZIP |
| Windows | x64 | `FrisFrame-0.6.0-x64.exe` |

GitHub Actions에서는 두 개의 네이티브 빌드가 따로 실행됩니다.

- **macOS · Apple Silicon**
- **Windows · x64**

개발 빌드가 성공하면 Artifact로 다음 파일이 생성됩니다.

- `FrisFrame-macOS-arm64`
- `FrisFrame-Windows-x64`

`v0.6.0` 같은 버전 태그를 만들면 GitHub Releases를 통해 Mac/Windows 버전을 함께 배포할 수 있습니다. 이후 버전도 버전 번호만 바뀌고 같은 이름 규칙을 사용합니다.

정식 태그 릴리스는 다음 서명 절차를 사용할 수 있도록 구성되어 있습니다.

- **macOS:** Developer ID 서명 + Hardened Runtime + Apple notarization
- **Windows:** Authenticode 코드 서명

배포 서명 설정은 [`SIGNING.md`](SIGNING.md)에 정리되어 있습니다.

### `v0.6.0-beta` 설치 시 보안 경고

`v0.6.0-beta`는 테스트를 위한 **unsigned 프리릴리즈**입니다. 따라서 운영체제가 앱을 처음 실행할 때 보안 경고를 표시할 수 있습니다. 아래 방법은 **이 저장소의 공식 GitHub Release에서 받은 FrisFrame 설치본에만** 사용하세요.

#### macOS

1. DMG를 열고 `FrisFrame.app`을 **응용 프로그램(Applications)** 폴더로 옮깁니다.
2. 먼저 Finder에서 앱을 Control-클릭(또는 우클릭) → **열기**를 시도하거나, **시스템 설정 → 개인정보 보호 및 보안 → 확인 없이 열기(Open Anyway)**를 사용합니다.
3. 그래도 차단되면 터미널에서 다음 명령을 실행합니다.

```bash
xattr -dr com.apple.quarantine "/Applications/FrisFrame.app"
open "/Applications/FrisFrame.app"
```

`xattr` 명령은 해당 앱에 붙은 macOS 격리(quarantine) 속성을 제거합니다. FrisFrame을 다른 위치에 설치했다면 명령의 경로를 실제 앱 위치에 맞게 바꾸세요.

#### Windows

Windows Defender SmartScreen에서 **Windows의 PC 보호** 경고가 표시될 수 있습니다. 이 저장소의 공식 Release에서 받은 설치파일인지 확인한 뒤 **추가 정보(More info) → 실행(Run anyway)**을 선택하면 됩니다.

정식 production 릴리즈는 macOS Developer ID/공증과 Windows Authenticode 서명을 적용하도록 구성되어 있으며, unsigned 우회는 beta 프리릴리즈에만 허용합니다.

### 설치본의 MCP 실행파일

데스크톱 패키지에는 로컬 편집 서버와 FFmpeg뿐 아니라 **독립적인 stdio MCP 실행파일**도 포함됩니다. 일반 사용자가 별도로 Python을 설치할 필요가 없습니다.

- macOS 앱 내부: `Contents/Resources/runtime/mcp/frisframe-mcp`
- Windows 앱 내부: `resources/runtime/mcp/frisframe-mcp.exe`

이 MCP 프로세스는 Electron 앱이 사용하는 FrisFrame 관리 프로젝트 DB를 찾아 같은 프로젝트를 읽고 수정합니다. 외부 MCP 클라이언트에서는 해당 실행파일을 stdio 서버 명령으로 등록하면 됩니다.

## 핵심 기능

### 스토리보드 / 샷 계획

- 씬과 컷 구성
- 액션, 대사, 연출 메모, 검토 상태 관리
- A/B 샷 버전
- 컷 사이 연속성 확인

### 2D / 3D 블로킹

- 카메라, 배우, 소품, 환경 배치
- 미터 기반 월드 스케일
- 3D 카메라 프레이밍 미리보기
- 멀티 카메라 설정 및 비교
- 배우와 카메라의 공간 관계 확인

### 키프레임 타임라인

- 카메라 / 배우 / 소품 트랙
- 프레임 / 0.1초 / 0.5초 / 1초 스냅
- 복사 / 붙여넣기 / 다중 선택 / 구간 리타이밍
- `Smooth`, `Linear`, `Hold`, `Cut` 전환
- 프레임 단위 타임스탬프 정밀도

### 카메라 레퍼런스 제어

- Dolly In / Out
- Truck Left / Right
- Pedestal Up / Down
- Arc Left / Right
- Follow Actor
- 카메라·배우·소품의 Free-curve 경로에서 거의 일정한 이동 속도 유지
- 연속적인 초점거리(focal length) 보간
- 목적지 키 경계에서만 Tracking 대상 전환
- 연속 Smooth 카메라 키 사이에서 불필요하게 멈추지 않는 움직임

카메라 프리셋은 별도의 자동 애니메이션 시스템이 아니라 **일반 키프레임을 생성하는 매크로**입니다. 생성된 키는 직접 만든 카메라 키와 동일하게 편집할 수 있습니다.

### 배우 레퍼런스 제어

- Root 위치, 높이, 바라보는 방향, 이동 타이밍
- 사용자가 직접 작성한 Pose 상태
- 키프레임 사이 일정한 Root Motion 속도와 자유 곡선 길이 보정
- `Hold` / `Cut`을 선택한 경우에만 의도적인 정지·즉시 전환
- 목적지 키에 도달하기 전까지 Pose 유지

FrisFrame은 배우의 보조 움직임을 임의로 만들어내지 않습니다. Seedance가 불필요한 움직임까지 레퍼런스에서 강하게 따라가면 결과가 딱딱하거나 로봇처럼 보일 수 있기 때문입니다.

### 핵심 출력

데스크톱 UI는 실제 Seedance 프리비즈 작업에 필요한 출력에 집중합니다.

- 현재/기준 프레임
- 첫 프레임 + 끝 프레임
- H.264 프리비즈 MP4
- 정확한 `1 / fps` 간격의 CFR 프레임 샘플링
- H.264 / `yuv420p` / fast-start 출력
- 필요할 때 MP4 구간 설정
- 여러 컷 작업 시 내부 안전 검사를 거친 전체 컷 MP4 ZIP

Reference Readiness 계산은 MP4 안전 정책으로만 사용하며 별도 사용자 단계나 점수 UI로 노출하지 않습니다. Reference Prompt 생성은 FrisFrame 밖의 MCP 대화가 담당합니다.

### 내부 Export 안전 검사

MP4 출력과 기존 Batch 인프라에는 잘못된 Tracking 대상, 중복/범위 밖 키, 잘못된 Export 구간, 카메라 값 오류, 프레임 그리드 타이밍, 지나치게 긴 레퍼런스 길이 등을 검사하는 내부 안전 로직이 있습니다.

이 검사는 프리비즈 MP4의 안전성을 지키기 위한 내부 기능이지, 사용자가 최종 영상 생성 전에 반드시 거쳐야 하는 별도의 AI/프롬프트 단계가 아닙니다.

## Seedance 레퍼런스 설계 철학

FrisFrame에서 MP4는 완성 애니메이션이 아니라 **Seedance에 전달하는 카메라·공간·타이밍 레퍼런스**입니다.

우선순위는 다음과 같습니다.

1. **카메라 움직임** — 가장 정밀하게 전달
2. **배우 Root Motion** — 위치, 높이, 방향, 속도
3. **사용자가 직접 지정한 Action / Pose**
4. **Secondary Motion** — 기본적으로 생략

그래서 FrisFrame 프리비즈 화면은 일부러 단순하고 딱딱해 보일 수 있습니다. 하지만 Seedance에 전달할 정보가 명확하고 불필요한 움직임 신호가 적다는 것이 더 중요합니다.

전체 원칙은 [`REFERENCE_VIDEO_PRINCIPLES.md`](REFERENCE_VIDEO_PRINCIPLES.md)를 참고하세요.

## Preview와 MP4의 일관성

화면에서 보는 Preview와 Export되는 MP4 프레임은 같은 Reference Evaluation 규칙을 사용합니다.

회귀 테스트로 다음 항목을 보호합니다.

- 카메라 위치 / 높이
- pan / tilt
- focal length
- Tracking 대상 전환 시점
- 배우 Root 위치 / 방향
- 작성한 Pose Hold
- 24 / 60fps 타이밍
- Preview ↔ Export 수치 일치

목표는 간단합니다. **시간 `t`에서 사용자가 작성한 상태가 Export된 Seedance 레퍼런스에서도 같은 시간 `t`의 상태로 나타나야 합니다.**

## 데스크톱 성능 정책

대형 장면과 반복 편집에서 불필요한 재생성을 줄이기 위해 데스크톱 편집기는 다음 객체를 조건부로 재사용합니다.

- 고정 세트/가구와 움직이는 소품 Rig
- 움직이는 배우 Humanoid Rig와 grounding 결과
- Stage Grid / Border
- Camera Rig / FOV 콘
- 3D 모션 경로 Geometry와 키 마커
- 카메라 프리뷰용 3D World
- 타임라인/목록의 변하지 않은 DOM

3D 선택에서는 바닥, 그리드, 경로, 장식용 Helper처럼 편집 대상이 아닌 객체를 Raycast 대상에서 제외하고 실제 배우/소품/카메라/관절/이동 핸들에 선택 비용을 집중합니다.

자동 품질 검사에는 합성 대형 장면 회귀가 포함됩니다. 현재 fixture는 **320개 대상 + 8,000개 키프레임**을 만들고, 변하지 않은 상태에서 목록·대상 선택·타임라인 DOM이 반복 재생성되지 않는지 확인합니다. 이 검사는 절대적인 실기기 FPS 보장이 아니라 큰 성능 회귀를 CI에서 조기에 잡는 guard입니다.

## 로컬에서 실행하기

### 가장 쉬운 방법: 설치 파일 사용

일반 사용자는 위의 **GitHub Releases**에서 운영체제에 맞는 설치 파일을 내려받아 실행하는 것을 권장합니다. 설치본에는 로컬 편집 서버와 FFmpeg가 포함되므로 별도로 Python 명령을 입력할 필요가 없습니다.

### 소스 코드로 실행하기 — 처음 한 번

아래 명령은 **터미널을 처음 연 상태에서 위에서부터 한 줄씩 그대로 실행**하면 됩니다.

```bash
git clone https://github.com/lowayss/FrisFrame.git
cd FrisFrame
python3 server.py --port 8766
```

정상적으로 서버가 실행되면 **그 터미널 창은 닫지 마세요.**

그다음 브라우저 주소창에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8766/
```

macOS에서는 새 터미널 탭을 열고 아래 명령으로 브라우저를 바로 열 수도 있습니다.

```bash
open http://127.0.0.1:8766/
```

> `http://127.0.0.1:8766/` 자체를 터미널에 입력하면 `zsh: no such file or directory` 오류가 납니다. 주소는 **브라우저 주소창**에 입력하거나 macOS에서는 앞에 `open`을 붙여 실행하세요.

### 이미 FrisFrame을 다운로드한 경우

먼저 FrisFrame 폴더로 이동한 뒤 서버를 실행합니다.

```bash
cd ~/FrisFrame
python3 server.py --port 8766
```

현재 위치가 맞는지 확인하려면:

```bash
pwd
ls server.py
```

`ls server.py` 결과에 `server.py`가 표시되어야 합니다. `No such file or directory`가 나오면 아직 FrisFrame 폴더 안에 들어가지 않은 것입니다.

### MP4 Export에서 FFmpeg 오류가 나는 경우

소스 코드의 브라우저 서버는 시스템에 설치된 FFmpeg를 사용합니다. 먼저 확인하세요.

```bash
ffmpeg -version
```

macOS에서 FFmpeg가 없고 Homebrew를 사용 중이라면:

```bash
brew install ffmpeg
```

설치 파일(DMG/EXE)로 실행하는 경우에는 패키지에 FFmpeg가 포함되어 있으므로 이 단계가 필요하지 않습니다.

### Electron 데스크톱 개발 모드

Node.js/npm이 설치되어 있다면:

```bash
git clone https://github.com/lowayss/FrisFrame.git
cd FrisFrame
npm install
npm run desktop:dev
```

이미 저장소를 받은 경우에는 `git clone`을 다시 할 필요 없이 FrisFrame 폴더에서 `npm install`부터 실행하면 됩니다.

### MCP 서버를 소스에서 직접 실행

```bash
cd ~/FrisFrame
python3 mcp_previs_server.py
```

### 전체 자동 검사

```bash
cd ~/FrisFrame
python3 quality_check.py
```

### 데스크톱 패키지 로컬 검증

```bash
cd ~/FrisFrame
npm install
npm run check
npm run desktop:build:mac
# 또는
npm run desktop:build:win
npm run desktop:verify
```

## 프로젝트 저장 / 안전성

- 자동저장과 명시적 저장은 같은 관리 프로젝트 revision을 사용합니다.
- MCP 쓰기도 revision을 확인하므로 수동 편집과 충돌하면 조용히 덮어쓰지 않습니다.
- managed project는 Electron 사용자 데이터 폴더의 SQLite DB에 저장합니다.
- 로컬 DB나 백업 파일을 저장소에 추적하지 않도록 CI가 검사합니다.
- Electron은 `contextIsolation`, `sandbox`, `webSecurity`를 유지하고 Node API를 렌더러에 직접 노출하지 않습니다.

## 제품 경계 정리 상태

구형 Production Pack, 배경시트, 별도 멀티캠 export, Reference Prompt/Readiness 사용자 UI와 인앱 세트·배경 이미지 입력 경로는 공용 `index.html/app.js`에서 물리적으로 제거했습니다. Electron `preload.cjs`도 더 이상 이런 요소를 찾아 숨기거나 삭제하지 않습니다. 브라우저와 데스크톱은 같은 가시적 제품 경계를 공유합니다.

멀티카메라 **편집**은 계속 지원합니다. 제거한 것은 별도 멀티캠 프리뷰/영상 export 표면이며, 최종 출력은 현재/첫·끝 기준 프레임, 프리비즈 MP4, 필요 시 여러 컷 MP4 ZIP에 집중합니다. 내부 Reference Readiness 계산은 사용자 단계가 아니라 MP4 안전 정책과 BLOCKED 컷 guard로만 남습니다.