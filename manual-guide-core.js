(function initManualGuideCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FrisFrameManualGuideCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  function buildTutorialSteps(serviceName = "FrisFrame") {
    return [
      {
        title: `${serviceName} 시작하기`,
        body: "컷마다 배우·소품·카메라의 위치와 움직임을 설계하고, 2D 평면도와 3D 프리비즈로 확인하는 작업 공간입니다. 안내를 따라가면 한 컷을 만드는 전체 순서를 익힐 수 있습니다.",
        tryText: "프로젝트 내용은 바뀌지 않습니다. 다음을 눌러 주요 작업 영역을 차례로 살펴보세요.",
      },
      {
        selector: "#storyboardBtn",
        workspace: "storyboard",
        title: "1. 씬과 컷 정리",
        body: "스토리보드에서는 시나리오를 씬과 컷으로 나누고, 각 컷의 액션·대사·샷 크기·연출 의도를 기록합니다. 원하는 컷에서 ‘블로킹 열기’를 누르면 무대 편집 화면으로 들어옵니다.",
        tryText: "여러 컷을 만들 때는 먼저 스토리보드에서 순서를 정한 뒤 각 컷의 블로킹을 작업하세요.",
      },
      {
        selector: "#aspectButtons",
        workspace: "blocking",
        view: "2d",
        highlightClosest: "details",
        openDetails: true,
        title: "2. 무대와 화면비",
        body: "최종 영상의 화면비를 정합니다. 격자는 거리와 정렬을 판단할 때 쓰고, 이름 표시는 복잡할 때 끌 수 있습니다. ‘깨끗한 출력’을 켜면 편집용 표시가 결과 이미지에서 빠집니다.",
        tryText: "일반 영화·광고는 16:9, 세로 숏폼은 9:16부터 시작하면 편합니다.",
      },
      {
        selector: "#actorForm",
        workspace: "blocking",
        view: "2d",
        highlightClosest: "details",
        openDetails: true,
        title: "3. 배우 추가",
        body: "배우 이름을 입력하고 추가하면 무대와 목록에 배우가 생깁니다. 배우를 선택한 뒤 오른쪽 속성에서 색, 크기, 바라보는 방향과 미세 위치를 조절할 수 있습니다.",
        tryText: "배우 목록의 항목을 누른 다음 무대 위 마크를 드래그해 첫 위치를 잡아보세요.",
      },
      {
        selector: "#propForm",
        workspace: "blocking",
        view: "2d",
        highlightClosest: "details",
        openDetails: true,
        title: "4. 소품과 공간 추가",
        body: "자동차·가구·가전·나무 같은 소품을 직접 추가하거나, 거실·주방·침실 같은 공간 프리셋을 한 번에 배치할 수 있습니다. 소품마다 길이·높이·너비를 따로 바꿀 수 있습니다.",
        tryText: "빠르게 시작하려면 공간 프리셋을 넣고 필요 없는 요소만 삭제하세요.",
      },
      {
        selector: "#stageCanvas",
        workspace: "blocking",
        view: "2d",
        cardWidth: 300,
        title: "5. 2D 평면도에서 블로킹",
        body: "가운데 무대는 위에서 내려다본 평면도입니다. 배우·소품·카메라를 드래그해 위치를 정합니다. 확대 상태에서는 빈 무대를 좌클릭 드래그해 이동하고, 가운데 버튼이나 Space 드래그도 사용할 수 있습니다.",
        tryText: "오른쪽 위 맞춤 버튼으로 전체 동선을 확인하고, 필요한 부분만 확대해서 배치하세요.",
      },
      {
        selector: "#cameraHeightKeyBtn",
        workspace: "blocking",
        view: "2d",
        title: "6. 카메라와 피사체 추적",
        body: "렌즈는 화각, 높이는 카메라의 수직 위치, 팬은 좌우 회전, 틸트는 위아래 각도입니다. 피사체 추적을 선택하면 배우의 얼굴·머리 위치를 기준으로 팬과 틸트가 자동 조정됩니다.",
        tryText: "카메라 높이 키를 남긴 뒤 3D 카메라 프레임에서 헤드룸을 확인하세요.",
      },
      {
        selector: "#actorPlacementFields",
        fallbackSelector: "#propertiesPanel",
        workspace: "blocking",
        view: "2d",
        prepare: "actor-properties",
        title: "7. 차량 탑승",
        body: "배우를 선택하면 ‘탑승 방식’이 나타납니다. 자동 탑승은 차량과 좌석을 고르면 바로 결합됩니다. 수동 탑승은 배우를 차량 위에 겹친 뒤 ‘겹친 대상 묶기’를 누릅니다.",
        tryText: "자동은 좌석이 정확할 때, 수동은 자유로운 배치가 필요할 때 사용하세요.",
      },
      {
        selector: ".timeline",
        workspace: "blocking",
        view: "2d",
        title: "8. 키프레임으로 동선 만들기",
        body: "대상을 고르고 0초에 첫 키를 추가합니다. 대상을 새 위치로 옮긴 뒤 시간을 바꾸고 두 번째 키를 추가하면 동선이 만들어집니다. ‘현재 시간’은 키의 순간이고 ‘전체 시간’은 컷 길이입니다.",
        tryText: "타임라인 점을 좌우로 드래그해 시간을 바꾸고, 선택한 키의 도착 방식과 경로를 조정하세요.",
      },
      {
        selector: "#threeWrap",
        workspace: "blocking",
        view: "3d",
        title: "9. 3D 프리비즈 확인",
        body: "3D에서는 배우·소품·카메라의 높이와 방향을 입체적으로 확인합니다. 이동·방향 모드로 대상을 편집하고, 오른쪽 아래 카메라 프레임에서 실제 렌즈에 들어오는 구도를 확인합니다.",
        tryText: "2D에서 동선을 만든 뒤 3D로 전환해 충돌, 높이, 헤드룸을 점검하세요.",
      },
      {
        selector: "#exportMenu",
        workspace: "blocking",
        title: "10. 프리뷰와 내보내기",
        body: "현재 프레임, 시작·끝 프레임, 카메라 영상을 먼저 프리뷰로 확인한 뒤 직접 저장합니다. 작업 중 자동 다운로드는 발생하지 않습니다.",
        tryText: "결과를 만들기 전 2D 동선 재생과 3D 카메라 프레임을 한 번씩 확인하세요.",
      },
      {
        title: "기본 작업 순서",
        body: "컷 선택 → 화면비 설정 → 배우·소품 배치 → 카메라 구도 → 첫 키 추가 → 위치와 시간을 바꿔 다음 키 추가 → 동선 재생 → 3D 확인 → 프리뷰 검토 → 저장 순서로 작업하면 됩니다.",
        tryText: "상단 도움말의 ‘처음 사용 가이드’에서 이 안내를 언제든 다시 볼 수 있습니다.",
      },
    ];
  }

  return { buildTutorialSteps };
});
