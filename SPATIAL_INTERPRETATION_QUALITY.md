# Spatial Interpretation Quality & Curated Presets

FrisFrame의 공간 해석 품질은 **이미지에서 더 많은 것을 상상하는 것**이 아니라, 외부 vision 모델이 읽은 공간 정보를 더 일관된 기하 구조로 정리하고 불확실성을 드러내는 방향으로 개선합니다.

## 1. 공간 해석 품질 단계

`spatial_quality_mcp.py`는 `compile_reference_master_plan`과 `apply_reference_master_set` 앞에서 결정적인 기하 품질 단계를 수행합니다.

- 가까운 벽/파티션/난간 끝점은 같은 코너로 정규화합니다.
- 문·창이 `parent_id` 없이 들어오면 가까운 벽 선분에만 추론 부착합니다.
- 문·창 방향이 벽 방향과 충분히 가까우면 벽 방향으로 정렬합니다.
- 벽 그래프의 열린 끝점, T/X 접합부, 분리된 연결 컴포넌트를 진단합니다.
- 닫힌 방처럼 보이게 만들기 위해 보이지 않는 벽을 임의 생성하지 않습니다.

기본 허용치는 다음과 같습니다.

- 벽 끝점 snap: `0.15m`
- 문/창 벽 부착: `0.35m`
- 문/창 방향 정렬: `20°`

필요하면 MCP 호출에서 허용치를 조절할 수 있습니다.

결과에는 `spatial_quality` 리포트가 추가됩니다. `open-wall-endpoints`, `disconnected-wall-components` 같은 항목은 자동 수정 대신 REVIEW 대상으로 남습니다.

## 2. 기존 환경 프리셋 업그레이드

기존 환경 프리셋은 과거의 `assetType + normalized x/y + size` 배치를 그대로 삭제하지 않습니다. UI 호환성을 유지하면서 선택 직후 **curated metric Master Set v2**로 승격합니다.

현재 점검/승격 대상:

- 거실
- 주방
- 침실
- 숲
- 차 안
- 사무실
- 교실
- 복도
- 엘리베이터 로비
- 화장실
- 기차 객실
- 경사
- 고전 응접실

각 프리셋에는 실제 미터 단위 기준 영역이 있으며, 기존 정규화 배치를 해당 영역의 로컬 좌표로 다시 매핑합니다. 예를 들어 거실은 `7.2m × 5.4m × 2.8m`, 교실은 `9.0m × 7.2m × 3.0m`, 기차 객실은 `3.0m × 18.0m × 2.25m` 기준입니다.

프리셋 적용 시 다음이 함께 생성됩니다.

- 각 item의 정확한 `referenceDimensionsM`
- `blocking.setMasterPlan`
- semantic `setCollections`
- 구조/개구부/가구/설비/환경/차량 역할
- 문·창의 공간 parent
- 벽 item의 endpoint line 정보
- `basis: user_fixed`, `confidence: 1`인 curated preset provenance

따라서 프리셋도 레퍼런스 이미지로 만든 세트와 동일하게 2D/2.5D/3D가 같은 Master Set 데이터를 사용합니다.

## 3. 프리셋 품질 API

브라우저 런타임은 다음 API를 제공합니다.

`window.FrisFrameEnvironmentPresetQuality`

- `audit()` : 현재 코드의 환경 프리셋이 모두 metric spec과 asset dimension을 갖는지 검사
- `upgradeCurrent()` : 현재 선택된 프리셋을 다시 Master Set v2로 승격
- `getSpec(presetId)` : 프리셋 기준 영역 조회
- `presetIds` : 관리되는 프리셋 ID 목록

## 4. 원칙

1. 외부 vision 모델은 픽셀을 해석합니다.
2. FrisFrame은 기하 관계와 미터 단위 일관성을 검증합니다.
3. observed와 inferred를 섞어 확정값처럼 취급하지 않습니다.
4. 프리셋은 임의 배치 예제가 아니라 촬영 설계 가능한 curated proxy set이어야 합니다.
5. 레퍼런스 세트와 프리셋 세트 모두 `setMasterPlan + shared blocking items`라는 동일한 source-of-truth를 사용합니다.
