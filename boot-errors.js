(function initBootErrorConsole() {
  "use strict";

  function appendError(message) {
    const consoleElement = document.getElementById("debugConsole");
    const errors = document.getElementById("debugErrors");
    if (!consoleElement || !errors) return;
    consoleElement.style.display = "block";
    const row = document.createElement("div");
    row.textContent = message;
    errors.appendChild(row);
  }

  window.addEventListener("error", (event) => {
    appendError(`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    appendError(`Promise rejected: ${event.reason?.message || event.reason}`);
  });
})();
