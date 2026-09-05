# FrisFrame 유지보수 안내

FrisFrame의 제품 경계는 **Seedance Video Reference용 결정적 프리비즈 제작**입니다. 카메라, 배우, 소품, 타이밍과 공간 관계를 키프레임으로 설계하고 MP4로 출력합니다. 이미지 해석, 생성형 이미지/영상 호출, 최종 Seedance 프롬프트 작성은 앱 밖의 MCP 대화와 생성 도구가 담당합니다.

Electron 패키지는 웹 편집기를 감싸는 실행 계층입니다. 핵심 편집·프레임 평가 규칙은 브라우저와 데스크톱이 공유하고, Electron 전용 레이어는 데스크톱 UX·성능·파일 저장·패키징 책임만 맡습니다.

## 파일별 책임

| 파일 | 책임 |
| --- | --- |
| `app.js` | 화면 연결, 2D·3D 렌더링, 편집 명령과 프로젝트 흐름 |
| `storyboard-core.js` | 씬·컷 구조, 연속성 분석, A/B 컷 스냅샷과 비교 규칙 |
| `motion-core.js` | 키프레임 보간, CFR 레퍼런스 타이밍, 내부 MP4 안전 검사 |
| `previs-runtime-core.js` | 렌더 런타임 감지와 레퍼런스 프레임 의미 보호 |
| `reference-workflow-core.js` | 여러 컷 MP4 ZIP과 내부 readiness 정책 연결. Prompt/Readiness 사용자 UI는 소유하지 않음 |
| `pose-core.js` | 배우 포즈 프리셋·관절 제한·포즈 키 보간 |
| `timeline-core.js` | 다중 선택 시간 이동, 프레임 스냅, 구간 리타이밍과 붙여넣기 충돌 검사 |
| `camera-drafting-core.js` | 스토리보드 문장에서 카메라 초안을 만드는 규칙과 카메라 범위 |
| `project-recovery-core.js` | 브라우저 복구본 생성·검증 |
| `manual-guide-core.js` | 처음 사용 가이드 단계와 작업 화면 이동 |
| `mcp_previs_server.py` | MCP 무대 배치·명시적 타임라인·모션 매크로·통합 previs plan, revision 충돌 검사 |
| `mcp_desktop_entry.py` | 설치본 MCP가 Electron과 같은 프로젝트 DB를 사용하도록 연결 |
| `server.py` | 프로젝트 저장, 버전·공유, 라이선스와 단일 순차 MP4 인코딩 |
| `electron/*-ux.js` | 데스크톱 작업 UX, 선택, 안전장치, 캐시와 렌더 성능 최적화 |
| `index.html`, `styles.css` | 공용 화면 구조와 디자인 |

새 계산 규칙은 가능한 한 작은 코어 모듈에 넣고 `app.js`는 화면 연결만 담당하게 합니다. 기능을 제거할 때는 HTML, 이벤트 연결, 저장 스키마, 가이드와 테스트를 함께 검색합니다.

구형 Production Pack·배경시트·별도 멀티캠 export·인앱 세트/배경 이미지 입력·최종 Seedance Prompt helper는 공용 `app.js/index.html`에서 물리적으로 제거되어 있습니다. Electron preload는 이 표면을 숨기는 호환 shim을 가지지 않습니다. 제품 경계 테스트는 shared source 자체에 retired ID/function이 다시 생기면 실패해야 합니다. 멀티카메라 편집 모델과 카메라 프로필 전환은 지원 기능이므로 export 표면 제거와 혼동하지 않습니다.

## 제품 경계

FrisFrame 안에 다음 기능을 다시 만들지 않습니다.

- 레퍼런스 이미지 자체를 AI로 해석하는 기능
- 이미지/영상 생성 AI API 호출
- 최종 Seedance Prompt 생성기
- Reference Prompt 사용자 UI
- Reference Readiness를 필수 사용자 단계로 노출하는 UI
- 자동 걷기·팔 흔들기·호흡·바운스 같은 배우 secondary motion 생성

Reference Readiness 계산은 `motion-core.js`에 **MP4 안전 정책**으로 남을 수 있습니다. 여러 컷 ZIP에서는 BLOCKED 컷을 인코더에 넣지 않는 내부 guard로 사용합니다. 이것을 다시 별도 제작 단계나 점수 UI로 만들지 않습니다.

외부 비전 가능한 MCP 클라이언트는 이미지/자연어를 해석한 뒤 `mcp_previs_server.py`에 명시적인 무대·카메라·키프레임 명령을 보냅니다. MCP 결과는 일반 FrisFrame 키프레임이라 UI에서 그대로 수동 수정할 수 있어야 합니다.

## Seedance 레퍼런스 프레임 원칙

FrisFrame MP4는 완성 애니메이션이 아니라 Seedance가 참고하는 **카메라·공간·타이밍 레퍼런스**입니다.

- 카메라 위치·경로·팬·틸트·렌즈 값은 시간축에서 연속적이고 예측 가능해야 합니다.
- 카메라 `부드럽게` 전환의 리듬 보정은 배우 body pose에 자동 주입하지 않습니다.
- `직전 유지`와 `즉시 전환`은 기존 키프레임 의미를 그대로 유지합니다.
- focal length는 평가 중 정수로 반올림하지 않습니다. 정수 표시는 UI에서만 처리할 수 있습니다.
- `trackingTargetId`처럼 연속 보간할 수 없는 값은 목적지 키 도착 시 전환합니다.
- 배우 root 위치·방향은 작성한 키 사이를 일정한 이동 진행률로 연결하되 secondary motion은 자동 생성하지 않습니다.
- 배우 body pose는 사용자가 작성한 포즈 사이의 의미만 보존합니다.
- 프리뷰와 MP4 내보내기는 같은 프레임 평가 의미를 사용해야 합니다.
- `previs-runtime-core.js`의 프레임 의미 guard를 바꾸면 `tests/previs-runtime-core.test.cjs`와 `tests/reference-video-contract.test.cjs`를 함께 확인합니다.

## 데스크톱 UX / 성능 레이어 원칙

Electron은 기존 상태 모델을 복제하지 않고 기존 함수/DOM을 감싸는 작은 레이어로 UX를 보강합니다.

현재 주요 레이어는 다음 책임을 가집니다.

- `selection-ux.js` — 2D/3D 실제 hit-test 보강과 겹친 대상 순환
- `alignment-ux.js` — X/Y magnetic alignment와 가이드
- `history-safety-ux.js` — Esc 취소, Undo/Redo, 잠금, autosave 가시성
- `performance-ux.js` — 직접 조작 중 DOM/렌더 재생성 억제와 프레임 병합
- `preview-cache-ux.js` — 카메라 프리뷰 World 재사용
- `scene-cache-ux.js` / `dynamic-prop-cache-ux.js` — 고정/동적 3D 대상 재사용. 렌더 시작 시 motion source와 수동 group membership을 각각 한 번 인덱싱하고 같은 렌더의 소품 eligibility 판정에서는 Set 조회를 사용
- `stage-shell-cache-ux.js` — Grid/Border 재사용
- `camera-path-cache-ux.js` — Camera Rig/FOV/모션 경로 재사용
- `helper-raycast-ux.js` — 선택 불가능한 장식 Geometry의 Raycast 제외

캐시는 **빠르지만 틀린 화면**을 만들면 안 됩니다. 이름·색·크기·포즈·키·가시성 등 캐시 결과에 영향을 주는 상태를 변경했을 때 반드시 무효화되어야 합니다. 선택/포즈 편집처럼 정확성이 우선되는 경우 캐시를 우회할 수 있습니다. 렌더별 eligibility 인덱스도 다른 `renderState`에 재사용하지 않으며, 활성 렌더 밖에서는 정확한 원본 스캔 경로를 fallback으로 유지합니다.

## 변경 전후 확인

전체 자동 검사는 다음 한 번으로 실행합니다.

```bash
python3 quality_check.py
```

이 검사는 문법, 프레임 평가, MP4 계약, 프로젝트 저장·보안, MCP, UX 캐시와 제품 경계를 확인합니다. `tests/large-scene-performance.test.cjs`는 현재 합성 대형 프로젝트에서 **320개 대상 + 8,000개 키프레임**을 사용해 변하지 않은 UI가 재생성되지 않는지 검사합니다. 시간 제한은 절대 FPS 보증이 아니라 심각한 성능 회귀를 잡는 guard입니다.

자동 검사 뒤 실제 데스크톱에서는 다음 흐름을 확인합니다.

1. 새 프로젝트 생성과 최근 프로젝트 재개
2. 자동저장과 저장 상태 표시
3. 배우·카메라·소품 키 생성, 위치·방향·포즈 보간, 다중 선택, 드래그, 복사·붙여넣기와 구간 맞춤
4. `Esc` 직접 조작 취소, Undo/Redo, 잠금
5. 2D 확대·이동과 3D 오빗·팬·줌, 작은 대상 선택과 겹친 대상 순환
6. 포즈 프리셋·관절 직접 편집과 키프레임 반영
7. 현재/기준 프레임, 첫·끝 프레임, H.264 프리비즈 MP4와 필요 시 전체 컷 MP4 ZIP
8. 데스크톱 `도움말 → MCP 실행 경로 복사`로 실제 설치 경로를 얻고 외부 MCP 클라이언트에 stdio command로 등록. `list_projects` → `get_project`로 같은 프로젝트/revision을 확인한 뒤 MCP 무대/모션 명령을 적용하고 UI에 반영되는지 확인
9. UI에서 수동 저장을 끼운 뒤 오래된 revision의 MCP 수정이 `revision_conflict`로 거부되고, 최신 revision을 다시 읽은 뒤 작업을 재개할 수 있는지 확인
10. 생성형 이미지·최종 Prompt 기능이 FrisFrame 내부 사용자 경로에 나타나지 않는지 확인

## 프로젝트 형식

- 현재 프로젝트 형식은 `schemaVersion: 11`입니다.
- 형식을 바꾸면 `app.js`의 `PROJECT_SCHEMA_VERSION`과 `server.py`의 `SUPPORTED_PROJECT_SCHEMA_VERSION`을 함께 올립니다.
- 이전 프로젝트는 `sanitizeProjectDocument()`에서 기본값을 채워 계속 열 수 있어야 합니다.
- 더 새로운 형식은 조용히 손상시키지 않고 열기를 거부합니다.
- 저장 API는 프로젝트 문서가 없는 요청과 잘못된 씬·컷 구조를 DB 쓰기 전에 거부합니다.
- 서버 DB는 `PRAGMA user_version`으로 형식을 관리합니다.
- SQLite 연결은 요청 종료 시 성공·실패와 관계없이 정리되어 DB 잠금이 남지 않아야 합니다.

## Electron 연결 원칙

- Electron 메인 프로세스는 창, 앱 메뉴, 로컬 서버 시작·종료와 파일 저장 등 셸 책임만 담당합니다.
- 설치본 MCP 실행 경로 노출은 renderer에 새 Node/IPC 권한을 주지 않고 신뢰된 메인 프로세스 앱 메뉴에서 처리합니다.
- 렌더러는 Node 기능을 직접 노출하지 않습니다.
- `contextIsolation`은 켜고 `nodeIntegration`은 끕니다.
- `sandbox`와 `webSecurity`를 유지합니다.
- 렌더러 이동은 로컬 FrisFrame origin 밖으로 나가지 못하게 합니다.
- 패키지에는 Three.js/Lucide, 로컬 Python 서버, FFmpeg와 독립 stdio MCP 실행파일을 포함합니다.
- MCP 실행파일은 Electron과 같은 관리 프로젝트 DB를 사용해야 합니다.

## 데스크톱 빌드

```bash
npm install
npm run check
npm run desktop:build:mac
# 또는
npm run desktop:build:win
```

macOS에서 설치본을 교체할 때는 다음 명령을 사용합니다.

```bash
npm run desktop:update:mac
```

이 명령은 Apple Silicon 앱을 빌드·검증한 뒤, 실행 중인 기존 FrisFrame을 종료하고 기존 앱과 중복본을 `/Applications` 밖의 휴지통으로 옮긴 다음 `/Applications/FrisFrame.app` 하나만 설치합니다. 프로젝트 DB는 앱 패키지와 분리되어 있으므로 설치 교체 과정에서 삭제하지 않습니다.

패키지 검증:

```bash
npm run desktop:verify
```

- macOS Apple Silicon과 Windows x64를 각각 빌드합니다.
- 프로젝트 DB는 앱 패키지 밖의 플랫폼별 사용자 데이터 폴더에 저장합니다.
- unsigned 개발 빌드에서도 `desktop:verify`가 서버, FFmpeg, MCP 실행파일과 필수 리소스를 검사합니다.
- MCP는 임시 DB를 사용해 실제 번들 stdio 프로세스의 `initialize` → `tools/list` → DB-backed `list_projects` JSON-RPC 왕복을 통과해야 합니다. Windows에서는 한국어 도구 metadata가 UTF-8로 정상 출력되는지도 함께 검사합니다.
- 정식 외부 배포에서는 macOS Developer ID/notarization과 Windows Authenticode 서명을 별도로 적용합니다.

## 현재 범위 고정

외부 3D 에셋 가져오기와 레퍼런스 영상 분석은 현재 범위가 아닙니다. 새 AI 기능을 앱 안에 임시로 붙이지 않습니다. FrisFrame이 결정적으로 계산·재현할 수 없는 해석과 생성 책임은 외부 MCP/생성 도구에 둡니다.
