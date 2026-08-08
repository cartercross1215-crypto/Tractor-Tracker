/* Tractor Tracker mode branding add-on */
(() => {
  if (window.__tractorModeBrandingInstalled) {
    return;
  }
  window.__tractorModeBrandingInstalled = true;

  function getCurrentMode() {
    try {
      return typeof getAppMode === "function" && getAppMode() === "contracting" ? "contracting" : "farm";
    } catch (error) {
      return document.body.dataset.appMode === "contracting" ? "contracting" : "farm";
    }
  }

  function installModeBrandingStyles() {
    if (document.querySelector("#mode-branding-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "mode-branding-styles";
    style.textContent = `
      .mode-context-label {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        width: fit-content;
        margin-top: 0.45rem;
        padding: 0.28rem 0.7rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border: 1px solid rgba(49, 95, 54, 0.24);
        background: rgba(232, 241, 229, 0.95);
        color: #224226;
      }

      .mode-context-label::before {
        content: "";
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.7);
      }

      .mode-context-label.contracting-mode {
        border-color: rgba(249, 115, 22, 0.45);
        background: rgba(255, 237, 213, 0.96);
        color: #9a3412;
      }

      body[data-app-mode="contracting"] {
        background: linear-gradient(180deg, #fff7ed 0%, #f8f0e7 42%, #f4efe7 100%);
      }

      body[data-app-mode="contracting"] .app-header {
        background: linear-gradient(135deg, #7c2d12 0%, #c2410c 48%, #f97316 100%);
        border-color: rgba(251, 146, 60, 0.55);
        box-shadow: 0 18px 45px rgba(154, 52, 18, 0.24);
      }

      body[data-app-mode="contracting"] .app-header .eyebrow,
      body[data-app-mode="contracting"] .app-header h1,
      body[data-app-mode="contracting"] .app-header p,
      body[data-app-mode="contracting"] .plan-panel,
      body[data-app-mode="contracting"] .plan-panel small {
        color: #fff7ed;
      }

      body[data-app-mode="contracting"] .plan-panel {
        background: rgba(124, 45, 18, 0.42);
        border-color: rgba(255, 237, 213, 0.3);
      }

      body[data-app-mode="contracting"] .tab.active,
      body[data-app-mode="contracting"] button:not(.ghost-button):not(.secondary-button):not(.danger-button) {
        background: #ea580c;
        border-color: #c2410c;
        color: #ffffff;
      }

      body[data-app-mode="contracting"] .tab.active:hover,
      body[data-app-mode="contracting"] button:not(.ghost-button):not(.secondary-button):not(.danger-button):hover {
        background: #c2410c;
      }

      body[data-app-mode="contracting"] .secondary-button {
        border-color: #fb923c;
        color: #9a3412;
        background: #fff7ed;
      }

      body[data-app-mode="contracting"] .panel,
      body[data-app-mode="contracting"] .metric,
      body[data-app-mode="contracting"] .dashboard-card,
      body[data-app-mode="contracting"] .report-card,
      body[data-app-mode="contracting"] .list-item,
      body[data-app-mode="contracting"] .saved-item {
        border-color: rgba(249, 115, 22, 0.24);
      }

      body[data-app-mode="contracting"] .metric span,
      body[data-app-mode="contracting"] .dashboard-card span,
      body[data-app-mode="contracting"] .report-card span,
      body[data-app-mode="contracting"] .eyebrow {
        color: #c2410c;
      }

      body[data-app-mode="contracting"] .status-pill:not(.due):not(.done):not(.warn),
      body[data-app-mode="contracting"] .sync-status[data-status="synced"] {
        background: #ffedd5;
        color: #9a3412;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureModeLabel() {
    const title = document.querySelector(".app-header h1");
    if (!title) {
      return null;
    }

    let label = document.querySelector("#mode-context-label");
    if (!label) {
      label = document.createElement("span");
      label.id = "mode-context-label";
      label.className = "mode-context-label";
      title.insertAdjacentElement("afterend", label);
    }
    return label;
  }

  function updateModeBranding() {
    installModeBrandingStyles();
    const mode = getCurrentMode();
    const label = ensureModeLabel();

    if (label) {
      label.textContent = mode === "contracting" ? "Contracting Mode" : "Farm Work Mode";
      label.classList.toggle("contracting-mode", mode === "contracting");
      label.classList.toggle("farm-mode", mode !== "contracting");
    }

    document.body.dataset.appMode = mode;
  }

  if (typeof renderAll === "function") {
    const originalRenderAll = renderAll;
    renderAll = function patchedRenderAllWithModeBranding() {
      originalRenderAll.apply(this, arguments);
      updateModeBranding();
    };
  }

  if (typeof renderAppModeContent === "function") {
    const originalRenderAppModeContent = renderAppModeContent;
    renderAppModeContent = function patchedRenderAppModeContentWithBranding() {
      originalRenderAppModeContent.apply(this, arguments);
      updateModeBranding();
    };
  }

  document.addEventListener("change", (event) => {
    if (event.target?.id === "app-mode" || event.target?.id === "setup-measurement-system") {
      window.setTimeout(updateModeBranding, 0);
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-select-mode]")) {
      window.setTimeout(updateModeBranding, 0);
    }
  });

  updateModeBranding();
})();
