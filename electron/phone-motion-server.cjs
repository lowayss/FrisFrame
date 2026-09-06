"use strict";

// Compatibility entrypoint. The Director Viewfinder supersedes the old visible
// rear-camera motion page while preserving the same bridge API for Electron and
// existing integrations.
module.exports = require("./phone-director-viewfinder.cjs");
