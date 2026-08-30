# FrisFrame MCP-first workflow

FrisFrame의 역할은 **Seedance Video Reference로 넣을 프리비즈 MP4를 정확하게 만드는 것**이다. FrisFrame 안에서 생성형 AI를 호출하거나 최종 Seedance 프롬프트를 완성하지 않는다.

## 두 가지 시작 방식

### 1. 수동 블로킹

1. 무대, 배우, 소품을 배치한다.
2. 카메라 위치, 앵글, 렌즈와 이동을 잡는다.
3. 배우/소품/카메라 키프레임을 직접 만든다.
4. 프리비즈를 재생해 확인한다.
5. Seedance용 프리비즈 MP4를 출력한다.

### 2. MCP 보조 블로킹

1. 사용자가 MCP 대화에 무대/공간 이미지 레퍼런스를 제공한다.
2. MCP 클라이언트가 이미지를 해석한다. FrisFrame 자체는 이미지를 분석하지 않는다.
3. MCP가 `apply_stage_layout` 또는 `apply_previs_plan`으로 확정된 공간 구조, 더미, 소품, 카메라를 FrisFrame에 구현한다.
4. 복잡한 움직임은 `apply_motion_timeline`, `apply_motion_macros` 또는 `apply_previs_plan`으로 일반 키프레임으로 만든다.
5. 사용자는 MCP가 만든 키프레임을 FrisFrame UI에서 그대로 수정할 수 있다.
6. 프리비즈 MP4를 출력한다.

수동 편집과 MCP 편집은 같은 프로젝트 상태를 사용한다. 수동 수정 뒤 MCP를 다시 사용할 때는 `get_project`로 최신 `revision`을 읽고 작업해야 한다.

`apply_previs_plan`은 무대 배치, 명시적 키, 모션 매크로를 **하나의 DB 트랜잭션과 하나의 revision**으로 적용한다. 중간 명령이 실패하면 앞 단계까지 포함해 전체 계획을 롤백하므로, 한 요청의 절반만 프로젝트에 남지 않는다.

## 이미지 에셋 제작

프리비즈의 첫 프레임 또는 첫/끝 프레임을 외부 생성형 이미지 도구의 구조 레퍼런스로 사용한다.

필요에 따라 다음 에셋을 외부에서 만든다.

- 배경 이미지
- 인물 이미지
- 소품 이미지
- 복잡한 상호작용이 필요한 경우 인물이 포함된 구조 이미지

FrisFrame은 이 이미지들을 생성하지 않는다.

## 최종 Seedance 입력 자료

최종 MCP 대화에는 필요에 따라 다음을 함께 넣는다.

- FrisFrame 프리비즈 MP4
- 배경 이미지
- 인물 이미지
- 소품 이미지
- 컷/영상 설명 텍스트

MCP 대화가 이 자료를 바탕으로 최종 Seedance 프롬프트를 작성한다. **FrisFrame은 최종 Seedance 프롬프트 생성 UI를 제공하지 않는다.**

## 내보내기 UI 원칙

사용자에게 보이는 내보내기는 다음처럼 단순하게 유지한다.

- 현재/기준 프레임
- 시작·끝 프레임
- 프리비즈 영상
- 여러 컷 작업 시 전체 컷 MP4 ZIP

2D 블로킹, 배경시트, 촬영 자료, 멀티캠 출력, Reference Readiness, Reference Prompt는 최종 Seedance 자료를 만드는 주 동선에서 노출하지 않는다. Readiness 검증이 필요한 경우 내부 MP4 안전 검사로만 사용한다.

세트/배경 이미지 업로드 UI도 제거한다. 이미지 레퍼런스는 FrisFrame이 직접 이해하는 것이 아니라 MCP 대화에서 비전 모델이 해석하고, 그 결과를 구조화된 명령으로 FrisFrame에 전달한다.

## 작업 화면 기본값

- 렌즈 화각 프리셋은 렌즈 입력 바로 아래에 붙여 작게 표시한다.
- 세로 주석/그리기 바는 기본적으로 숨긴다.
- 필요한 경우 작은 연필 버튼 또는 `Shift+A`로 주석 바를 열고 다시 숨길 수 있다.
- 핵심 프리비즈 조작과 무관한 보조 UI가 작업 화면을 계속 가리지 않도록 한다.

## MCP 실행 방식

소스에서 직접 실행할 때는 다음 엔트리포인트를 사용한다.

```bash
python3 mcp_previs_server.py
```

데스크톱 설치본에는 Python 없이 실행할 수 있는 별도 **stdio MCP 실행파일**이 함께 들어간다.

- macOS: `FrisFrame.app/Contents/Resources/runtime/mcp/frisframe-mcp`
- Windows: `FrisFrame 설치 폴더/resources/runtime/mcp/frisframe-mcp.exe`

외부 MCP 클라이언트에는 이 실행파일을 stdio 서버 command로 등록한다. 설치본 MCP는 Electron 앱의 플랫폼별 `userData/data/frisframe.db`를 찾아 같은 관리 프로젝트를 읽고 수정한다. `PREVIS_DB_PATH` 환경변수를 명시하면 다른 DB를 사용할 수도 있다.

설치 위치를 직접 찾을 필요는 없다. 데스크톱 앱 메뉴에서 **`도움말 → MCP 실행 경로 복사`**를 선택하면 현재 설치본의 실제 `frisframe-mcp` / `frisframe-mcp.exe` 절대 경로를 클립보드에 복사한다. 이 경로를 외부 MCP 클라이언트의 stdio `command` 값에 넣으면 된다. 패키지에 MCP 실행파일이 누락된 경우에는 조용히 잘못된 경로를 복사하지 않고 오류를 표시한다.

### 외부 MCP 클라이언트 등록 예시

MCP 설정 형식이 `mcpServers`를 사용하는 클라이언트라면 구조는 다음과 같다. 실제 설치 위치가 다르면 `command`만 바꾼다.

macOS 예시:

```json
{
  "mcpServers": {
    "frisframe": {
      "command": "/Applications/FrisFrame.app/Contents/Resources/runtime/mcp/frisframe-mcp",
      "args": []
    }
  }
}
```

Windows 예시:

```json
{
  "mcpServers": {
    "frisframe": {
      "command": "C:\\Users\\사용자명\\AppData\\Local\\Programs\\FrisFrame\\resources\\runtime\\mcp\\frisframe-mcp.exe",
      "args": []
    }
  }
}
```

특정 DB를 명시해야 하는 개발/테스트 환경에서는 클라이언트의 `env` 항목으로 `PREVIS_DB_PATH`를 전달한다.

```json
{
  "mcpServers": {
    "frisframe": {
      "command": "/path/to/frisframe-mcp",
      "args": [],
      "env": {
        "PREVIS_DB_PATH": "/path/to/frisframe.db"
      }
    }
  }
}
```

등록 후 MCP 클라이언트를 다시 연결하거나 재시작하고 `list_projects`를 먼저 호출해 연결과 프로젝트 DB가 맞는지 확인한다. 이후 수정 명령을 보내기 전에는 `get_project`로 최신 `revision`을 읽는다.

패키지 검증에서는 실행파일 존재 여부만 보지 않는다. macOS/Windows에서 실제 번들 MCP 프로세스를 임시 DB로 실행하고 **`initialize` → `tools/list` → DB-backed `list_projects`** JSON-RPC 왕복을 각각 검사한다. Windows에서는 한국어 도구 설명이 포함된 `tools/list`도 UTF-8로 정상 출력되는지 함께 검증한다.

## MCP 설계 원칙

`mcp_previs_server.py`는 AI API를 호출하지 않는다. MCP 클라이언트가 결정한 결과를 FrisFrame 상태로 정확히 기록하는 역할만 한다.

- 장면 명령과 모션 명령을 구분한다.
- 작업 단위마다 `revision`을 확인해 수동 편집과 충돌하지 않게 한다.
- 위치는 정규화 좌표 또는 미터 기반 월드 좌표를 명시적으로 사용한다.
- 카메라 렌즈, 높이, 팬, 틸트를 명시적 필드로 전달한다.
- 배우의 자동 걷기/팔 흔들기 같은 보조 동작은 생성하지 않는다.
- 최종 프롬프트와 생성형 이미지 제작은 FrisFrame 밖에서 수행한다.

## 고수준 모션 매크로

자연어에서 자주 나오는 복잡한 지시를 MCP가 매번 수십 개의 저수준 필드로 직접 계산하지 않도록 `apply_motion_macros`를 제공한다. 매크로는 실행 직전에 **일반 FrisFrame 키프레임으로 확장**되며, 이후에는 수동 키와 완전히 동일하게 편집할 수 있다.

지원 매크로:

- `camera_orbit` — 지정 인물을 중심으로 일정 각도만큼 카메라 회전 이동
- `camera_dolly_and_zoom` — 피사체 쪽으로 돌리 이동하면서 렌즈를 동시에 변경
- `camera_jib` — 카메라 높이와 위치를 함께 바꾸는 지브 업/다운
- `camera_follow_actor` — 배우 키 타이밍을 따라 카메라 오프셋을 유지하며 추적
- `pair_approach` — 두 배우가 서로를 향해 접근
- `move_subject` — 배우/소품을 지정 위치까지 이동

예를 들어 MCP 대화에서 다음과 같은 요청을 안정적으로 분해할 수 있다.

- “카메라가 인물을 중심으로 왼쪽으로 120도 반원 이동해.”
- “2초 동안 두 사람이 서로에게 다가가서 마주 보게 해.”
- “돌리인하면서 렌즈를 35mm에서 85mm로 바꿔.”
- “배우가 이동하는 동안 현재 카메라 간격을 유지하면서 따라가.”

매크로도 반드시 현재 프로젝트의 `revision`을 기준으로 실행한다. 수동 수정이 끼어들면 다시 `get_project`를 호출한 뒤 적용한다.
