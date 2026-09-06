# FrisFrame 2.5D 조감도 모드

FrisFrame의 2.5D 모드는 기존 2D 마스터플랜과 3D 세트가 공유하는 **동일 blocking state** 위에서 동작하는 Orthographic 기반 편집 뷰입니다. 별도의 2.5D 복제 데이터를 만들지 않습니다.

## 보기 전환

상단 블로킹 보기에서 다음 네 모드를 전환합니다.

- `2D`: 미터 기반 탑뷰 마스터플랜
- `2.5D`: Orthographic 조감 편집 뷰
- `3D`: 기존 Perspective 자유 시점
- `CAMERA`: 현재 컷의 렌즈, 위치, 팬/틸트를 적용한 실제 카메라 시점

2.5D와 CAMERA는 기존 3D world를 그대로 사용합니다. 따라서 배우/소품/세트의 위치·회전·포즈를 다시 동기화하는 별도 데이터 계층이 없습니다.

## 2.5D 조감 컨트롤

2.5D 모드에서는 뷰포트 상단에 전용 컨트롤이 표시됩니다.

- `좌 조감`: 세트를 좌측 대각 상단에서 보는 Orthographic 프리셋
- `우 조감`: 반대쪽 대각 상단 프리셋
- `전체보기`: 현재 무대와 표시 중인 세트가 프레임 안에 들어오도록 자동 fit
- 마우스 휠: Orthographic zoom
- `지붕/천장 숨김`: set master plan의 element/collection 메타데이터와 이름을 이용해 roof/ceiling 계열을 뷰에서만 숨김
- `아웃라인`: 실제 mesh에 `EdgesGeometry` 기반 외곽선을 추가해 공간 구조를 빠르게 읽을 수 있게 함

지붕/천장 숨김은 프로젝트 데이터를 삭제하거나 `visible` 값을 변경하지 않습니다. 2.5D 표시 정책에만 적용됩니다.

## 편집 동기화

2.5D는 기존 `threeView.world`, raycaster, direct-manipulation 코드를 재사용합니다.

- OrthographicCamera가 기존 `threeView.camera` 슬롯을 사용하므로 기존 pick/raycast가 그대로 동작
- 대상 이동/회전/포즈 편집은 기존 `state`에 commit
- 2D로 돌아가면 같은 좌표가 즉시 표시
- 3D와 CAMERA도 동일 state를 렌더링
- 타임라인 evaluated state도 기존 `renderThreeView` 경로를 사용

즉 동기화 정책은 `single-source-of-truth`이며 2D ↔ 2.5D ↔ 3D 사이에 별도 변환 저장 단계가 없습니다.

## 잠금 연동

세트 잠금은 기존 `item.editLocked`를 그대로 사용합니다. 2.5D에서도 기존 3D 편집 시작 루틴의 `sourceEditLocked(...)` 검사를 통과해야만 drag/edit가 시작됩니다.

따라서 `set_set_collection_lock`으로 적용한 다음 상태가 그대로 유지됩니다.

- 전체 잠금
- 전체 해제
- 일부 member 잠금
- 일부 member 해제

2.5D는 잠금 상태를 우회하는 별도 편집기를 만들지 않습니다.

## CAMERA 모드

CAMERA는 기존 카메라 프리뷰와 동일한 authored camera 정보를 전체 3D 뷰포트에 적용합니다.

- 현재 focal length → FOV 변환
- 현재 카메라 높이/위치
- 현재 pan/tilt 기반 look target
- 현재 컷의 evaluated state

전체 뷰포트가 실제 카메라 시점이 되므로 기존 우측 하단 카메라 미니 프레임은 CAMERA 모드 동안 숨깁니다.
