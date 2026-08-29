# FrisFrame MCP-first workflow

FrisFrame의 역할은 **Seedance Video Reference용 프리비즈를 정확하게 설계하고 출력하는 것**이다. 생성형 이미지 제작이나 최종 Seedance 프롬프트 작성은 FrisFrame 내부 기능이 아니다.

## 1. 시작 방식은 두 가지

### A. 수동 시작

사용자가 FrisFrame에서 직접 다음을 편집한다.

- 무대 구조와 소품
- 배우 위치와 포즈
- 카메라 위치, 높이, 팬/틸트, 렌즈
- 키프레임과 타이밍
- 카메라/배우/소품 동선

수동으로 만든 데이터는 MCP가 만든 데이터와 같은 프로젝트 상태를 사용한다. 따라서 이후 MCP에서 그대로 읽고 수정할 수 있다.

### B. MCP 시작

비전이 가능한 MCP 클라이언트가 이미지 레퍼런스를 직접 해석한 뒤 FrisFrame의 결정적 명령으로 변환한다.

FrisFrame 자체는 이미지를 AI로 분석하지 않는다.

권장 순서:

1. `list_projects`
2. `get_project`
3. 레퍼런스 이미지에서 구조/비례/깊이/카메라 관계 해석
4. `apply_scene_commands`
5. 필요하면 다시 `get_project`
6. `apply_motion_commands`
7. 결과를 FrisFrame UI에서 확인하고 수동 미세조정

## 2. MCP 명령 원칙

### `apply_scene_commands`

장면의 공간 상태를 바꾼다.

주요 용도:

- 배우/소품 더미 추가, 수정, 삭제
- 카메라 배치
- 미터 기준 위치와 크기 적용
- 이미지에서 추출한 공간 앵커/깊이 레이어 저장

이미지의 외형을 복사하거나 이미지를 생성하지 않는다. MCP 호출자가 이미지에서 판단한 **구조 데이터만** FrisFrame에 전달한다.

### `apply_motion_commands`

시간에 따른 상태를 바꾼다.

주요 용도:

- 카메라 키프레임
- 배우/소품 root 위치 키프레임
- 팬/틸트/높이/렌즈 변화
- 포즈 키
- 직선, 원호, free-curve, drone, jib 경로
- 컷 전체 길이와 export range

FrisFrame은 자동 걷기나 임의의 secondary motion을 만들지 않는다. MCP가 명시한 키만 기록하고 그 사이를 보간한다.

## 3. 수정 안정성

모든 프로젝트 수정은 `revision`을 사용한다.

- MCP는 `get_project`에서 현재 revision을 확인한다.
- 수정 성공 시 revision이 증가한다.
- 오래된 revision으로 수정하면 충돌로 거절된다.

따라서 수동 편집과 MCP 편집을 섞어도 오래된 MCP 호출이 최신 수동 편집을 조용히 덮어쓰지 않는다.

복잡한 작업은 한 번의 `apply_scene_commands` 또는 `apply_motion_commands`에 여러 operation을 묶어 보내는 것을 우선한다. 불필요하게 작은 호출을 연속으로 보내 revision 충돌 가능성을 높이지 않는다.

## 4. 프리비즈 이후 작업

FrisFrame에서 프리비즈를 완성한 뒤 필요한 기준 프레임을 출력한다.

- 프리비즈 MP4
- 기준 프레임
- 첫·끝 프레임

그 다음 생성형 이미지 도구에서 프리비즈 구조를 기준으로 다음 에셋을 만든다.

- 배경 이미지
- 인물 이미지
- 소품 이미지

특정 구조나 상호작용이 이미지 한 장으로 설명하기 어려운 경우에는 인물이 포함된 기준 이미지를 사용해도 된다.

## 5. 최종 Seedance 입력 준비

최종 단계는 FrisFrame이 아니라 MCP 대화에서 처리한다.

MCP 대화에 다음 자료를 함께 제공한다.

- FrisFrame 프리비즈 비디오
- 생성한 배경 이미지
- 인물 이미지
- 소품 이미지
- 사용자가 설명한 영상 의도/행동/연출

MCP가 이 자료를 보고 최종 Seedance 프롬프트와 reference 역할을 정리한다.

즉, FrisFrame 내부에는 별도의 Reference Prompt 작성기나 AI API가 필요하지 않다.

## 6. 제품 경계

FrisFrame에 남겨야 하는 기능:

- 2D/3D 블로킹
- 배우/소품/무대 배치
- 카메라와 렌즈
- 키프레임/동선/포즈
- 정확한 MP4 렌더링
- 프로젝트 저장/복구
- MCP가 안정적으로 읽고 수정할 수 있는 구조화 데이터

FrisFrame에서 빼야 하는 기능:

- AI 이미지 생성
- 외부 이미지를 앱 자체가 자동 이해하는 기능
- 최종 Seedance 프롬프트 작성기
- Reference Prompt/Readiness처럼 실제 최종 생성 단계를 흉내 내는 UI
- 구현되지 않은 세트/배경 이미지 자동 적용 기능

제품의 기준은 단순하다. **FrisFrame에서 직접 계산하고 재현할 수 없는 AI 기능은 넣지 않고, 그 대신 MCP가 장면과 움직임을 정확하게 명령할 수 있는 구조를 강화한다.**
