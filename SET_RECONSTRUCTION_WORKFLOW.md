# FrisFrame Reference Set Reconstruction

FrisFrame의 레퍼런스 세트 재구성은 **레퍼런스 이미지 → 실측 2D 마스터 플랜 → 동일 데이터 기반 3D 프록시 세트 → 카메라/프리비즈 → 세트 잠금** 순서를 기본으로 합니다.

FrisFrame 자체는 이미지 픽셀을 분석하거나 AI API를 호출하지 않습니다. 이미지 해석은 vision-capable MCP 클라이언트가 담당하고, FrisFrame MCP는 해석 결과를 미터 단위 데이터로 검증하고 결정적으로 적용합니다.

## 1. 권장 호출 순서

1. `get_reference_interpretation_contract`
2. 외부 모델이 레퍼런스 이미지에서 구조, 스케일 기준, 거리 관계, 카메라를 해석
3. `validate_reference_interpretation`
4. `get_set_reconstruction_contract`
5. 해석 결과를 top-down `master_plan`으로 변환
6. `validate_set_master_plan`
7. 2D 평면에서 구조/거리/비례를 검토
8. `apply_set_master_plan`
9. 동일 `referenceDimensionsM`를 사용하는 3D 프록시 세트 확인
10. 카메라/배우 블로킹 진행
11. `set_set_collection_lock`으로 세트 전체 잠금 또는 일부 해제

## 2. 2D 마스터 플랜이 기준이다

`apply_set_master_plan`으로 생성한 각 요소는 world meter 좌표와 실제 W/H/D를 가진 일반 FrisFrame prop으로 저장됩니다. FrisFrame의 2D Stage와 3D Preview는 같은 item과 같은 `referenceDimensionsM`를 사용하므로 별도 2D/3D 모델을 동기화하지 않습니다.

- 2D: 실제 폭/깊이를 footprint로 표시
- 3D: 같은 실제 폭/높이/깊이로 프록시 렌더링
- 수정: 하나의 item을 수정하면 2D와 3D가 함께 바뀜

이 정책의 식별자는 `2d-master-first-single-source-of-truth`입니다.

## 3. 실측 요소 표현

벽, 파티션, 난간처럼 선형 구조는 중심점보다 선분으로 작성하는 것을 권장합니다.

```json
{
  "id": "wall-left",
  "kind": "wall",
  "start_x_m": -4.2,
  "start_z_m": -7.2,
  "end_x_m": -4.2,
  "end_z_m": 7.2,
  "thickness_m": 0.16,
  "height_m": 2.8,
  "basis": "observed",
  "confidence": 0.92
}
```

바닥, 무대, 카운터, 테이블처럼 면적이 중요한 요소는 중심 위치와 치수를 사용합니다.

```json
{
  "id": "main-stage",
  "kind": "stage",
  "world_x_m": -2.3,
  "world_z_m": -3.7,
  "width_m": 3.2,
  "depth_m": 1.8,
  "height_m": 0.3,
  "basis": "observed",
  "confidence": 0.9
}
```

## 4. 관찰값과 추정값

중요 요소는 반드시 다음 provenance 중 하나를 사용합니다.

- `observed`: 이미지/도면에서 직접 확인
- `inferred`: 보이지 않는 부분을 현실적인 구조로 추정
- `user_fixed`: 사용자가 크기/위치를 확정

보이지 않는 후면 구조를 `observed`로 기록하지 않습니다. 정확한 절대 스케일이 없으면 문, 사람, 난간, 테이블 등 여러 현실 크기 기준을 사용해 추정하고 confidence를 낮춰 기록합니다.

## 5. 세트 컬렉션과 잠금

`collections`는 기존 FrisFrame의 rigid motion group과 다른 **semantic set collection**입니다. 따라서 세트 오브젝트를 하나로 묶어 관리하면서도 각 오브젝트는 독립적인 위치를 유지합니다.

```json
{
  "collections": [
    {"id": "architecture", "name": "Architecture", "locked": true},
    {"id": "furniture", "name": "Furniture", "locked": true}
  ]
}
```

잠금은 기존 `editLocked` 편집 보호를 사용합니다.

- 전체 잠금: `mode = lock_all`
- 전체 해제: `mode = unlock_all`
- 일부 잠금: `mode = lock_members`
- 일부 해제: `mode = unlock_members`

`unlock_members`는 컬렉션 자체의 잠금 상태를 유지하면서 지정 item만 예외 해제할 수 있습니다.

## 6. 지원하는 v1 세트 요소

v1은 미터 단위 공간 재현을 우선하며 다음 요소를 지원합니다.

`zone`, `floor`, `slab`, `platform`, `stage`, `deck`, `wall`, `partition`, `door`, `window`, `column`, `beam`, `counter`, `cabinet`, `table`, `chair`, `sofa`, `bed`, `stairs`, `railing`, `pool`, `pergola`, `tree`, `vegetation`, `sink`, `toilet`, `bathtub`, `refrigerator`, `stove`, `television`, `generic`.

현재 v1의 목표는 **사진과 똑같은 재질/곡면 모델링**보다 실제 크기, 거리, 배치, 동선, 카메라 기준을 안정적으로 유지하는 것입니다. 비정형 polygon/extrusion이나 정교한 pool shell 같은 메시 생성은 이 metric master plan을 source-of-truth로 유지한 채 후속 geometry renderer에서 확장합니다.
