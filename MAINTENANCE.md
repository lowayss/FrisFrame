# FrisFrame 유지보수 안내

Electron 패키지는 현재 웹 편집기를 감싸는 얇은 실행 계층으로 만듭니다. 편집 기능을 Electron 전용 코드로 옮기지 않으면 브라우저 버전과 데스크톱 버전이 같은 핵심 로직과 테스트를 공유할 수 있습니다.

## 파일별 책임

| 파일 | 책임 |
| --- | --- |
| `app.js` | 화면 연결, 2D·3D 렌더링, 편집 명령과 프로젝트 흐름 |
| `storyboard-core.js` | 씬·컷 구조와 스토리보드 규칙 |
| `motion-core.js` | 키프레임 보간, 경로와 숫자 안전 처리 |
| `project-recovery-core.js` | 브라우저 복구본 생성·검증 |
| `manual-guide-core.js` | 처음 사용 가이드 단계와 작업 화면 이동 |
| `server.py` | 프로젝트 저장, 버전·공유, 라이선스와 MP4 인코딩 |
| `index.html`, `styles.css` | 화면 구조와 디자인, 시각 매뉴얼 |

새 계산 규칙은 가능한 한 작은 코어 모듈에 넣고 `app.js`는 화면 연결만 담당하게 합니다. 기능을 제거할 때는 HTML, 이벤트 연결, 저장 스키마, 매뉴얼과 테스트를 함께 검색합니다.

## 변경 전후 확인

아래 한 번으로 문법, 핵심 로직, 화면 계약, 프로젝트 저장·보안과 MP4 작업 검사를 실행합니다.

```bash
python3 quality_check.py
```

검사가 통과한 뒤 데스크톱 브라우저에서 다음 흐름을 직접 확인합니다.

1. 새 프로젝트 생성과 최근 프로젝트 재개
2. 입력 중 자동저장과 저장 상태 표시
3. 배우·카메라 키 두 개 생성, 점 드래그, 재생·일시정지
4. 2D 확대·이동과 3D 오빗·화면 이동·줌
5. 카메라 프레임, 현재 프레임과 MP4 프리뷰
6. 프리뷰 뒤 직접 저장되며 자동 다운로드가 없는지 확인

## 프로젝트 형식

- 현재 프로젝트 형식은 `schemaVersion: 6`입니다.
- 형식을 바꾸면 `app.js`의 `PROJECT_SCHEMA_VERSION`과 `server.py`의 `SUPPORTED_PROJECT_SCHEMA_VERSION`을 함께 올립니다.
- 이전 프로젝트는 `sanitizeProjectDocument()`에서 기본값을 채워 계속 열 수 있어야 합니다.
- 더 새로운 형식은 조용히 손상시키지 않고 열기를 거부합니다.
- 저장 API는 프로젝트 문서가 없는 요청과 잘못된 씬·컷 구조를 DB 쓰기 전에 거부합니다.

## Electron 연결 원칙

- Electron의 메인 프로세스는 창, 앱 메뉴, 로컬 서버 시작·종료와 파일 저장 대화상자만 담당합니다.
- 렌더러는 현재 `index.html`을 그대로 사용하고 Node 기능을 직접 노출하지 않습니다.
- `contextIsolation`을 켜고 `nodeIntegration`은 끕니다.
- 브라우저와 Electron에서 같은 `quality_check.py`와 코어 테스트를 사용합니다.
- 자동 업데이트는 데스크톱 셸만 교체하고 프로젝트 DB는 별도 사용자 데이터 폴더에 보존합니다.
- Electron 패키징 단계에서 Three.js와 Lucide를 로컬 의존성으로 고정해 오프라인 실행을 보장합니다.

## 데스크톱 빌드

```bash
npm run check
npm run desktop:migrate-data
npm run desktop:build
```

- 결과물은 `release/`에 `.dmg`, `.zip`, `.app` 형태로 생성됩니다.
- 프로젝트 DB는 앱 내부가 아니라 `~/Library/Application Support/FrisFrame/data/frisframe.db`에 저장됩니다.
- 현재 패키지는 로컬 검증용 unsigned 빌드입니다. 외부 배포 전에 Apple Developer ID 서명, hardened runtime, notarization을 적용합니다.
- 자동 업데이트는 서명된 배포 채널이 준비된 뒤 추가하며, 사용자 확인 전 자동 다운로드하지 않습니다.
- 포함된 FFmpeg는 GPL 런타임이므로 공개·상업 배포 전에 코덱 구성과 배포 의무를 별도로 검토합니다.

## 현재 범위 고정

레퍼런스 영상 분석은 제거했습니다. 외부 3D 에셋 가져오기와 기본 에셋 확대도 현재 개발 범위에서 멈춥니다. 이 기능을 다시 시작할 때는 별도 모듈과 저장 형식 변경 계획을 먼저 만들고, 기존 편집기 안에 임시 코드를 추가하지 않습니다.
