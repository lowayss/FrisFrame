# FrisFrame Reference Prompt Guide

이 문서는 FrisFrame 프리비즈 MP4를 **Seedance, Higgsfield, Runway 같은 제작 환경에 넣을 때 프롬프트를 어떻게 써야 하는지** 정리합니다.

FrisFrame 자체는 영상 생성 AI가 아닙니다. 역할은 카메라, 배우 블로킹, 타이밍, 프레이밍, 렌즈 변화와 공간 관계를 프리비즈 MP4로 만드는 것입니다.

## 첨부 튜토리얼에서 확인한 핵심

튜토리얼 `How To Save AI Credits With Higgsfield + Blender`의 핵심은 **생성하기 전에 구조를 잠그는 것**입니다.

### 00:00~03:50 — 먼저 프리비즈를 만든다

Blender에서 완성 3D를 만들지 않습니다. 사람은 단순한 기둥/도형, 환경은 단순한 벽과 바닥으로 두고 다음 정보만 먼저 정합니다.

- 카메라 시작/종료 위치
- 카메라 이동 경로와 속도
- 피사체 위치와 진행 방향
- 인물 수와 서로의 거리
- 전경/배경/가림 관계
- 컷 또는 원테이크의 시간 구조

목표는 예쁜 프리비즈가 아니라 **생성 모델이 따라갈 구조를 먼저 검증해서 실패 생성과 재시도를 줄이는 것**입니다.

### 04:00~05:30 — 프리비즈 영상을 읽혀서 Seedance 프롬프트를 만든다

영상에서 Claude/Fable에 프리비즈 MP4와 인물/장소 이미지를 함께 넣고 다음 취지로 요청합니다.

> 프리비즈 영상을 읽고, 카메라와 블로킹에 맞는 30초 Seedance 프롬프트를 초 단위로 작성해 달라.

생성된 최종 프롬프트에서 가장 중요한 부분은 **레퍼런스의 역할 분리**입니다.

- `@video_1` = 프리비즈. 카메라 경로, 프레이밍, 렌즈 느낌, 회전, 타이밍, 공간 배치, 주인공 블로킹의 기준
- 캐릭터 이미지 = 얼굴, 머리, 의상, 정체성
- 장소 이미지 = 최종 환경/미술/조명
- 프리비즈의 단순 색과 도형 = 최종 디자인이 아니라 블로킹 표식

즉, **영상 레퍼런스는 움직임과 구조를 담당하고 이미지 레퍼런스는 외형을 담당**합니다.

### 05:30 전후 — 3D Blockout 유무 비교

튜토리얼은 `WITHOUT 3D BLOCKOUT`과 `WITH 3D BLOCKOUT` 결과를 비교합니다. 핵심 주장은 복잡한 카메라/액션일수록 텍스트만으로 반복 생성하는 것보다, 프리비즈로 구조를 먼저 잠그는 편이 재시도를 줄이기 쉽다는 것입니다.

### 07:00~09:00 — 여러 사람이 있는 장면

6명이 테이블에 앉는 장면을 단순 도형으로 배치합니다. 여기서 프리비즈는 표정이나 연기가 아니라 다음을 확인하는 도구입니다.

- 누가 어느 자리에 앉는지
- 카메라에서 누구의 얼굴이 가려지는지
- 전경 인물이 다른 사람을 얼마나 가리는지
- 카메라 높이와 오버숄더 구도

### 10:30~12:45 — 여러 장소를 연결하는 30초 구조

영상에 실제로 보이는 프롬프트는 대략 다음 구조입니다.

- Blender blocking을 읽는다.
- Seedance V2V 30초 프롬프트를 만든다.
- `@video_1 = blocking`
- `@char_main = main character sheet`
- 첫 장소는 이미지 레퍼런스, 나머지 장소는 텍스트로 정의
- 여러 장소를 지나도 같은 주인공이어야 함
- 각 장소에서 주인공이 무엇을 하는지 명확히 작성

이 예시는 **프리비즈가 카메라/시간 구조를, 텍스트가 사건과 장소 의미를 담당**하는 방식입니다.

### 11:20 전후 — 카메라 움직임도 먼저 프리비즈에서 검증

Claude에 Blender 카메라를 `robot-arm`처럼 움직이게 하고, 지점 사이를 빠르게 이동한 뒤 정확히 멈추며 마지막 위치에서는 정지하도록 지시합니다. 즉 복잡한 카메라 표현을 생성 프롬프트에서 처음 시험하는 것이 아니라 **프리비즈에서 먼저 실제 움직임으로 확인**합니다.

### 13:30~17:00 — 제품 광고 예시

제품 캔, 과일, 얼음, 텍스트를 단순 3D로 배치하고 광고의 장면 순서를 먼저 만듭니다. 영상에는 13개 정도의 장면/비트가 텍스트로 정리되고, 이후 다음과 같은 수정 요청이 나옵니다.

- 각 장면에서 카메라가 빠르게 들어오고 중간에서 느려졌다가 컷 직전에 다시 가속
- 오브젝트끼리 겹치거나 관통하지 않는지 확인
- 마지막 제품/텍스트 구도를 다시 균형 조정

여기서도 제품 재질을 완성하는 것이 목적이 아니라 **카메라와 오브젝트 타이밍을 잠그는 것**이 목적입니다.

## FrisFrame에서 권장하는 프롬프트 역할 분리

```text
FrisFrame MP4
→ 카메라 경로 / 프레이밍 / 렌즈 변화 / 배우 Root Blocking / 타이밍 / 공간 관계

캐릭터 이미지
→ 얼굴 / 헤어 / 의상 / 신체 특징 / 정체성

장소·스타일 이미지
→ 환경 / 미술 / 조명 / 색감 / 재질

텍스트 프롬프트
→ 사건의 의미 / 행동 설명 / 분위기 / 대사 / SFX / 이미지 레퍼런스 역할
```

## Seedance용 기본 구조

```text
ACTIVE REFERENCES
@video_1 — FrisFrame previs MP4. Master for camera trajectory, framing, lens progression,
camera timing, actor root blocking, spatial relationships, and beat timing.
Primitive colors/shapes are blocking markers only.

@char_main — [주인공 외형 레퍼런스]
@loc_main — [장소/미술 레퍼런스]

SCENE / ACTION
[실제로 무슨 일이 일어나는지]

VISUAL TARGET
[시대, 장소, 조명, 영상 질감, 의상, 색감]

AUDIO / SFX
[필요한 경우]

REFERENCE PRIORITY
Keep the camera path, framing, timing, and actor root movement tied to @video_1.
Use the image references for identity, wardrobe, environment, lighting, materials, and final look.
```

핵심은 **프롬프트가 프리비즈에 이미 들어 있는 카메라를 다시 새로 지시하지 않는 것**입니다. MP4가 카메라 구조를 담당하도록 두고 텍스트는 의미와 최종 외형을 보충합니다.

## Higgsfield에서 사용할 때

Higgsfield는 모델 이름이 아니라 여러 생성 모델을 제공하는 **플랫폼**입니다. 첨부 튜토리얼과 가장 가까운 조합은 **Higgsfield에서 Seedance Video-to-Video를 사용하는 경우**입니다.

따라서 FrisFrame의 `Higgsfield · Seedance V2V` 템플릿은 Seedance 템플릿과 같은 역할 분리를 사용합니다.

다른 Higgsfield 모델을 선택하면 해당 모델의 입력 방식과 프롬프트 규칙이 달라질 수 있으므로 템플릿은 출발점으로 사용합니다.

## Runway에서 사용할 때

Runway는 모델별 입력 방식이 다릅니다. Aleph/Edit Studio 계열처럼 기존 영상을 변환하는 작업에서는 공식 가이드도 **짧고 직접적인 변환 지시**를 권장합니다.

예시:

```text
Transform the FrisFrame previs into a cinematic modern Tokyo alley at dusk.
Preserve the input video's camera trajectory, timing, framing, subject blocking,
and spatial relationships. Replace placeholder geometry with the referenced actor
and environment. Add subtle natural secondary body motion that supports the blocking.
```

Runway에서 다른 모델을 사용할 경우 Video Reference 지원 방식이 달라질 수 있으므로 모델에 맞춰 조정합니다.

## Claude / Fable에 프롬프트를 쓰게 할 때

튜토리얼과 가장 가까운 방법입니다.

```text
Write a [DURATION]-second Seedance video-to-video prompt based on the attached
FrisFrame blocking MP4. Read the entire input video and write the final prompt
second-by-second so it matches the authored camera path, framing, lens changes,
actor root blocking, spatial relationships, and timing.

Treat the FrisFrame MP4 as the master structure/motion reference.
Treat primitive colors and shapes as blocking markers only.
Treat character/location/style images as appearance references.

Return sections:
SHOT
ACTIVE REFERENCES
GLOBAL STYLE
SCENE / ACTION
SECOND-BY-SECOND TIMELINE
AUDIO / SFX
```

FrisFrame의 `Reference Prompt` 창에서 이 요청문도 바로 만들 수 있습니다.

## 크레딧을 아끼는 실제 순서

1. FrisFrame에서 카메라와 배우 Root Blocking을 만든다.
2. Preview를 보고 카메라/가림/타이밍 문제를 먼저 수정한다.
3. Reference Readiness를 확인한다.
4. 낮은 비용의 테스트용 레퍼런스 출력으로 구조를 확인한다.
5. `Reference Prompt`에서 플랫폼용 프롬프트를 만든다.
6. 생성 플랫폼에서는 **프리비즈와 프롬프트를 동시에 바꾸지 말고 한 번에 한 요소만 수정**한다.
7. 구조가 맞은 뒤 최종 해상도/오디오/세부 스타일에 비용을 쓴다.

## 중요한 원칙

> **Block it. Lock it. Then let the generation model execute the final look.**

FrisFrame이 맡는 것은 `Block`과 `Lock`입니다. 최종 렌더링과 자연스러운 세부 움직임은 Seedance/Runway 등 실제 생성 모델이 담당합니다.
