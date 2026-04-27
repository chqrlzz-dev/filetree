'use strict';

/**
 * Main Application Orchestrator
 * Responsibility: Execute system startup sequence.
 */
document.addEventListener('DOMContentLoaded', () => {
  initializeSystem();
});

function initializeSystem() {
  // 1. Initialize State Specialist
  window.app = new TreeManager();
  app.loadStateFromStorage();

  // 2. Initialize UI Specialist
  UIController.initializeApplication();
  
  console.log("Neural Tree Architect v0.9.3_CORE_READY");
}
