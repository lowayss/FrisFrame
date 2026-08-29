(() => {
  "use strict";

  if (document.documentElement.dataset.frisframeCycleTimeSyncUx === "1") return;
  document.documentElement.dataset.frisframeCycleTimeSyncUx = "1";

  const stageCanvas = document.getElementById("stageCanvas");
  const threeCanvas = document.getElementById("threeCanvas");
  if (!stageCanvas || !threeCanvas) return;

  document.addEventListener("pointerdown", (event) => {
    if (!event.altKey || event.button !== 0) return;
    if (event.target !== stageCanvas && event.target !== threeCanvas) return;
    try {
      if (typeof syncPlayheadFromTimeInput === "function") syncPlayheadFromTimeInput();
    } catch (_error) {
      // Overlap cycling can still use the latest evaluated frame if the time field is invalid.
    }
  }, true);
})();
