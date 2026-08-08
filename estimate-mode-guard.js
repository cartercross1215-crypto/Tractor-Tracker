/* Tractor Tracker estimate visibility guard */
(() => {
  if (window.__tractorEstimateModeGuardInstalled) {
    return;
  }
  window.__tractorEstimateModeGuardInstalled = true;

  function isContracting() {
    try {
      if (typeof isContractingMode === "function") {
        return Boolean(isContractingMode());
      }
    } catch (error) {
      console.warn("Estimate mode check failed:", error);
    }
    return (state?.settings?.appMode || "farm") === "contracting";
  }

  function ensureGuardStyles() {
    if (document.querySelector("#estimate-mode-guard-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "estimate-mode-guard-styles";
    style.textContent = `
      body:not([data-app-mode="contracting"]) [data-tab="estimates"],
      body:not([data-app-mode="contracting"]) #estimates {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyEstimateModeGuard() {
    ensureGuardStyles();
    const contracting = isContracting();
    document.body.dataset.appMode = contracting ? "contracting" : "farm";

    const estimateTab = document.querySelector('[data-tab="estimates"]');
    const estimatePanel = document.querySelector("#estimates");

    if (estimateTab) {
      estimateTab.hidden = !contracting;
      estimateTab.setAttribute("aria-hidden", contracting ? "false" : "true");
      estimateTab.tabIndex = contracting ? 0 : -1;
    }

    if (estimatePanel) {
      estimatePanel.hidden = !contracting || !estimatePanel.classList.contains("active");
      estimatePanel.setAttribute("aria-hidden", contracting ? "false" : "true");
    }

    const activeEstimateTab = document.querySelector('.tab.active[data-tab="estimates"]');
    if (!contracting && activeEstimateTab) {
      switchTab("dashboard");
      return;
    }
  }

  const originalRenderAll = renderAll;
  renderAll = function patchedEstimateGuardRenderAll() {
    originalRenderAll();
    applyEstimateModeGuard();
  };

  document.addEventListener("click", (event) => {
    const estimateTab = event.target.closest('[data-tab="estimates"]');
    if (estimateTab && !isContracting()) {
      event.preventDefault();
      event.stopPropagation();
      switchTab("dashboard");
    }
  }, true);

  applyEstimateModeGuard();
})();
