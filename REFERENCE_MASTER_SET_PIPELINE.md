# FrisFrame Reference → Master Set Pipeline

FrisFrame에서 레퍼런스 이미지는 **3D 모델 그 자체가 아니라 공간을 재구성하기 위한 증거**입니다.

제품의 기준 흐름은 다음과 같습니다.

`Reference Image → Spatial Interpretation → Metric/Provenance Review → 2D Master Set → 2.5D Review → 3D Proxy Set → Actor Blocking → Camera / Shot Design`

## 1. 역할 분리

- 외부 vision-capable MCP 클라이언트: 이미지 픽셀을 보고 공간 구조, 크기 기준, 관계, 카메라 관찰값을 해석
- FrisFrame: 해석 결과를 미터 단위로 검증하고 Master Set으로 컴파일·적용
- FrisFrame 자체는 이미지 분석 AI API를 호출하지 않음

따라서 목표는 사진과 픽셀 단위로 같은 3D 복제물이 아니라, **배우와 카메라를 놓고 촬영 설계를 할 수 있는 공간적으로 일관된 세트**입니다.

## 2. 단일 Source of Truth

세트 적용 후 authoritative data는 다음입니다.

- `blocking.setMasterPlan`
- 동일한 `blocking.items`
- 각 item의 `referenceDimensionsM`

2D, 2.5D, 3D는 서로 다른 세트 데이터를 가지지 않습니다.

- 2D: 실제 폭/깊이를 footprint로 확인
- 2.5D: 같은 item을 조감도로 배치·수정
- 3D: 같은 item과 실제 W/H/D를 프록시로 렌더링

즉 한 화면에서 위치나 치수를 바꾸면 다른 뷰도 같은 authoritative state를 사용합니다.

## 3. 표준 MCP 흐름

새 레퍼런스 세트 작업은 다음 도구를 우선합니다.

1. `get_reference_master_set_contract`
2. 외부 vision 모델이 이미지 해석
3. `validate_reference_interpretation`
4. `compile_reference_master_plan`
5. 2D metric Master Set 결과와 REVIEW 항목 확인
6. 필요하면 사용자가 기준 치수 또는 위치를 `user_fixed`로 보정
7. `apply_reference_master_set`
8. FrisFrame MCP live sync가 변경된 `setMasterPlan`을 받아 2.5D 전체보기로 연결
9. 2.5D에서 레이아웃/치수 검토
10. 이후 배우 블로킹과 카메라/샷 설계

`compile_reference_master_plan`은 read-only입니다. 프로젝트 revision을 만들지 않습니다.

`apply_reference_master_set`은 검증된 해석과 Master Set을 한 project revision으로 적용합니다.

## 4. 구조물 표현

벽, 파티션, 난간처럼 선형 구조는 중심점 박스보다 끝점 기반 표현을 우선합니다.

```json
{
  "id": "wall-left",
  "kind": "wall",
  "start_x_m": -4.0,
  "start_z_m": -3.0,
  "end_x_m": -4.0,
  "end_z_m": 3.0,
  "thickness_m": 0.15,
  "height_m": 2.8,
  "basis": "observed",
  "confidence": 0.95
}
```

FrisFrame은 이 선분을 중심점, 길이, 회전, 두께를 가진 기존 blocking item으로 결정적으로 변환하면서 원래 line 정보도 `setMasterPlan.elements`에 보존합니다.

문, 창, 가구, 설비처럼 면적 기반 요소는 `kind + world_x_m/world_z_m + width_m/depth_m + height_m`를 사용합니다. 알려진 `kind`는 일반적인 높이/깊이 기본값을 사용할 수 있지만, 실제로 확인한 치수는 명시하는 편이 우선입니다.

## 5. 관찰값, 추정값, 사용자 확정값

중요한 공간 결정에는 provenance와 confidence를 붙입니다.

- `observed`: 이미지나 도면에서 직접 확인
- `inferred`: 보이지 않거나 불확실한 부분을 합리적으로 추정
- `user_fixed`: 사용자가 실제 치수/위치를 확정

`user_fixed` 기준은 추정값보다 우선합니다. 예를 들어 사용자가 "이 문은 900mm"라고 알려주면 그 값은 공간 스케일을 보정하는 강한 기준이 됩니다.

`apply_reference_master_set`은 원본 interpretation의 요약, Scale Anchor, 관계, 카메라 관찰값을 `setMasterPlan.referenceInterpretation`에 남겨 이후 검토 근거를 잃지 않게 합니다.

## 6. 카메라는 세트 생성과 분리

레퍼런스 이미지에서 카메라 focal, horizon, distance, 위치/방향을 추정할 수 있지만 **Master Set 생성 단계에서는 FrisFrame의 authored camera를 움직이지 않습니다.**

카메라 관찰값은 `referenceInterpretation.cameraObservation`으로 보존하고 `cameraAppliedDuringSetBuild = false`를 기록합니다.

세트의 공간 구조와 치수가 먼저 안정된 뒤 Reference Space calibration 또는 기존 Camera Operator/카메라 도구를 사용해 촬영 설계를 진행합니다.

이 분리는 "사진의 시점에 맞추기 위해 세트 구조를 왜곡하는 것"을 피하기 위한 정책입니다.

## 7. 기존 직접 적용 경로

`apply_reference_interpretation`은 기존 클라이언트 호환성을 위해 유지합니다. 이 경로는 해석 결과를 Mass Blocking/카메라로 직접 적용할 수 있는 **legacy compatibility path**입니다.

새 레퍼런스 세트 재구성에서는 사용하지 않고 `compile_reference_master_plan`과 `apply_reference_master_set`을 우선합니다.

정책 식별자는 `reference-image-to-master-set-single-source-of-truth`입니다.
