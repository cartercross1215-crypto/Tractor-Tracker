/* Tractor Tracker Today dashboard and setup checklist add-on */
(() => {
  if (window.__tractorTodayDashboardInstalled) {
    return;
  }
  window.__tractorTodayDashboardInstalled = true;

  const COLLAPSE_KEY = "tractor-tracker-setup-checklist-collapsed-v1";

  function isContractor() {
    try {
      return typeof isContractingMode === "function" ? isContractingMode() : document.body.dataset.appMode === "contracting";
    } catch (_error) {
      return document.body.dataset.appMode === "contracting";
    }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function savedTemplates() {
    if (Array.isArray(state.workTemplates)) {
      return state.workTemplates;
    }
    try {
      return loadData("tractor-tracker-work-templates-v1", []);
    } catch (_error) {
      return [];
    }
  }

  function savedFuelPrices() {
    if (Array.isArray(state.fuelPrices)) {
      return state.fuelPrices;
    }
    try {
      return loadData("tractor-tracker-fuel-prices-v1", []);
    } catch (_error) {
      return [];
    }
  }

  function todayDateKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function isToday(value) {
    if (!value) {
      return false;
    }
    try {
      return new Date(value).toISOString().slice(0, 10) === todayDateKey();
    } catch (_error) {
      return false;
    }
  }

  function insertTodayStyles() {
    if (document.querySelector("#today-dashboard-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "today-dashboard-styles";
    style.textContent = `
      .today-dashboard-panel {
        border: 1px solid rgba(49, 95, 54, 0.16);
        background: linear-gradient(135deg, rgba(49, 95, 54, 0.08), rgba(255, 255, 255, 0.94));
      }
      body[data-app-mode="contracting"] .today-dashboard-panel {
        border-color: rgba(203, 102, 31, 0.25);
        background: linear-gradient(135deg, rgba(203, 102, 31, 0.12), rgba(255, 255, 255, 0.94));
      }
      .today-dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 12px;
        margin: 14px 0;
      }
      .today-card {
        background: rgba(255, 255, 255, 0.86);
        border: 1px solid rgba(49, 95, 54, 0.14);
        border-radius: 16px;
        padding: 14px;
        box-shadow: 0 8px 18px rgba(34, 46, 34, 0.04);
      }
      body[data-app-mode="contracting"] .today-card {
        border-color: rgba(203, 102, 31, 0.18);
      }
      .today-card span,
      .setup-checklist-progress span {
        display: block;
        color: #5b6354;
        font-size: 0.78rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .today-card strong {
        display: block;
        font-size: 1.4rem;
        margin-bottom: 2px;
      }
      .today-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .today-actions button {
        min-height: 40px;
      }
      .setup-checklist {
        margin-top: 14px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px dashed rgba(49, 95, 54, 0.28);
        border-radius: 16px;
        padding: 14px;
      }
      body[data-app-mode="contracting"] .setup-checklist {
        border-color: rgba(203, 102, 31, 0.34);
      }
      .setup-checklist-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .setup-checklist-header h3 {
        margin: 0 0 4px;
      }
      .setup-checklist-progress strong {
        font-size: 1rem;
      }
      .setup-progress-bar {
        height: 9px;
        background: rgba(49, 95, 54, 0.12);
        border-radius: 999px;
        overflow: hidden;
        margin: 8px 0 10px;
      }
      .setup-progress-fill {
        height: 100%;
        background: #315f36;
        border-radius: 999px;
        transition: width 180ms ease;
      }
      body[data-app-mode="contracting"] .setup-progress-fill {
        background: #cb661f;
      }
      .setup-checklist-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      .setup-checklist-item {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 10px;
        align-items: center;
        background: rgba(255, 255, 255, 0.74);
        border: 1px solid rgba(49, 95, 54, 0.1);
        border-radius: 12px;
        padding: 10px;
      }
      .setup-checklist-item.is-complete {
        opacity: 0.76;
      }
      .setup-check-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: rgba(49, 95, 54, 0.1);
        color: #315f36;
        font-weight: 800;
      }
      body[data-app-mode="contracting"] .setup-check-icon {
        background: rgba(203, 102, 31, 0.14);
        color: #9a4e0d;
      }
      .setup-check-copy strong {
        display: block;
      }
      .setup-check-copy small {
        display: block;
        color: #5b6354;
        margin-top: 2px;
      }
      .setup-checklist.is-collapsed .setup-checklist-list,
      .setup-checklist.is-collapsed .setup-progress-bar,
      .setup-checklist.is-collapsed .setup-checklist-progress small {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function getDashboardPanel() {
    return document.querySelector("#dashboard") || document.querySelector('[data-panel="dashboard"]') || document.querySelector(".tab-panel");
  }

  function checklistItems() {
    const contracting = isContractor();
    const fuelPrices = savedFuelPrices();
    const templates = savedTemplates();
    const jobs = safeArray(state.jobs);
    const estimates = safeArray(state.estimates);
    const fields = safeArray(state.fields);
    const equipment = safeArray(state.equipment);
    const operators = safeArray(state.operators);
    const seasons = safeArray(state.seasons).concat(safeArray(state.fieldSeasons));

    const base = [
      {
        id: "mode",
        title: contracting ? "Contracting mode selected" : "Farm work mode selected",
        detail: "The app is set to the right workflow.",
        complete: true,
        action: "settings",
        button: "Change mode"
      },
      {
        id: "equipment",
        title: "Add equipment",
        detail: "Tractor, truck, skid steer, mower, baler, or other machine.",
        complete: equipment.length > 0,
        action: "setup",
        button: "Go to Setup"
      },
      {
        id: "place",
        title: contracting ? "Add a job site" : "Add a field",
        detail: contracting ? "Save the customer location before logging work." : "Save acres and field names for season cost tracking.",
        complete: fields.length > 0,
        action: "setup",
        button: "Add place"
      },
      {
        id: "operator",
        title: "Add an operator",
        detail: "Track who ran the equipment.",
        complete: operators.length > 0,
        action: "setup",
        button: "Add operator"
      },
      {
        id: "fuel",
        title: "Add local fuel price",
        detail: "Use gas, diesel, or red diesel for better cost numbers.",
        complete: fuelPrices.length > 0,
        action: "fuel",
        button: "Add fuel"
      },
      {
        id: "template",
        title: "Create a work template",
        detail: "Make common jobs one-tap from the dashboard.",
        complete: templates.length > 0,
        action: "template",
        button: "Add template"
      },
      {
        id: "job",
        title: "Log your first job",
        detail: "Start a timer or save manual work to build history.",
        complete: jobs.length > 0,
        action: "job",
        button: "Start job"
      }
    ];

    if (contracting) {
      base.splice(6, 0, {
        id: "estimate",
        title: "Build first estimate",
        detail: "Quote the job before the work starts.",
        complete: estimates.length > 0,
        action: "estimates",
        button: "Build estimate"
      });
    } else {
      base.splice(6, 0, {
        id: "season",
        title: "Create field seasons",
        detail: "Track crop, planned work, fuel, and cost per acre.",
        complete: seasons.length > 0,
        action: "seasons",
        button: "Open Seasons"
      });
    }

    return base;
  }

  function nextStep(items) {
    return items.find((item) => !item.complete) || items[items.length - 1];
  }

  function renderChecklist(items) {
    const done = items.filter((item) => item.complete).length;
    const total = items.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const collapsed = localStorage.getItem(COLLAPSE_KEY) === "yes";

    const list = items.map((item) => `
      <li class="setup-checklist-item ${item.complete ? "is-complete" : ""}">
        <span class="setup-check-icon">${item.complete ? "✓" : "•"}</span>
        <span class="setup-check-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </span>
        <button type="button" class="small-button ${item.complete ? "ghost-button" : "secondary-button"}" data-today-action="${item.action}">${escapeHtml(item.button)}</button>
      </li>
    `).join("");

    return `
      <div class="setup-checklist ${collapsed ? "is-collapsed" : ""}">
        <div class="setup-checklist-header">
          <div>
            <h3>Setup Checklist</h3>
            <p class="muted-text">Finish these once and Tractor Tracker becomes much faster every day.</p>
          </div>
          <div class="setup-checklist-progress">
            <span>Progress</span>
            <strong>${done}/${total} done</strong>
            <small>${percent}% complete</small>
          </div>
        </div>
        <div class="setup-progress-bar"><div class="setup-progress-fill" style="width: ${percent}%"></div></div>
        <ul class="setup-checklist-list">${list}</ul>
        <div class="today-actions">
          <button type="button" class="ghost-button" data-today-action="toggle-checklist">${collapsed ? "Show checklist" : "Hide checklist"}</button>
        </div>
      </div>
    `;
  }

  function renderTodayDashboard() {
    insertTodayStyles();
    const dashboard = getDashboardPanel();
    if (!dashboard) {
      return;
    }

    let panel = document.querySelector("#today-dashboard-panel");
    if (!panel) {
      dashboard.insertAdjacentHTML("afterbegin", `<section id="today-dashboard-panel" class="panel today-dashboard-panel"></section>`);
      panel = document.querySelector("#today-dashboard-panel");
    }
    if (!panel) {
      return;
    }

    const contracting = isContractor();
    const jobs = safeArray(state.jobs);
    const todayJobs = jobs.filter((job) => isToday(job.start) || isToday(job.end) || isToday(job.createdAt));
    const activeJob = state.activeJob || state.runningJob || state.currentJob || null;
    const items = checklistItems();
    const next = nextStep(items);
    const lastJob = jobs.slice().sort((a, b) => String(b.end || b.start || b.createdAt || "").localeCompare(String(a.end || a.start || a.createdAt || "")))[0];
    const title = contracting ? "Today - Contracting" : "Today - Farm Work";
    const subtitle = contracting
      ? "Fast buttons for bids, jobs, sites, fuel, and profit."
      : "Fast buttons for field work, seasons, fuel, and daily records.";

    panel.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <button type="button" class="secondary-button" data-today-action="quick-log">Quick Log Work</button>
      </div>
      <div class="today-dashboard-grid">
        <article class="today-card">
          <span>Jobs today</span>
          <strong>${todayJobs.length}</strong>
          <small>${todayJobs.length ? "Saved work from today." : "No work logged today yet."}</small>
        </article>
        <article class="today-card">
          <span>${activeJob ? "Timer" : "Next step"}</span>
          <strong>${activeJob ? "Running" : escapeHtml(next.title)}</strong>
          <small>${activeJob ? "A job timer appears to be active." : escapeHtml(next.detail)}</small>
        </article>
        <article class="today-card">
          <span>Last job</span>
          <strong>${lastJob ? escapeHtml(lastJob.jobType || lastJob.type || "Work") : "None yet"}</strong>
          <small>${lastJob ? escapeHtml(lastJob.fieldName || lastJob.customerName || "Saved job history") : "Your first saved job will show here."}</small>
        </article>
      </div>
      <div class="today-actions">
        <button type="button" data-today-action="job">Start Job</button>
        <button type="button" class="secondary-button" data-today-action="setup">Setup</button>
        <button type="button" class="secondary-button" data-today-action="fuel">Fuel Prices</button>
        ${contracting ? '<button type="button" class="secondary-button" data-today-action="estimates">Estimates</button>' : '<button type="button" class="secondary-button" data-today-action="seasons">Seasons</button>'}
        <button type="button" class="ghost-button" data-today-action="reports">Reports</button>
      </div>
      ${renderChecklist(items)}
    `;
  }

  function goToTab(tabName) {
    try {
      switchTab(tabName);
    } catch (_error) {
      document.querySelector(`[data-tab="${tabName}"]`)?.click();
    }
  }

  function scrollToFirst(selectors) {
    window.setTimeout(() => {
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        if (node) {
          node.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof node.focus === "function") {
            node.focus({ preventScroll: true });
          }
          return;
        }
      }
    }, 80);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-today-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.todayAction;
    if (action === "toggle-checklist") {
      const currentlyCollapsed = localStorage.getItem(COLLAPSE_KEY) === "yes";
      localStorage.setItem(COLLAPSE_KEY, currentlyCollapsed ? "no" : "yes");
      renderTodayDashboard();
      return;
    }
    if (action === "job") {
      goToTab("jobs");
      scrollToFirst(["#job-form", "#job-type", "#start-job", "#save-job"]);
      return;
    }
    if (action === "setup" || action === "settings") {
      goToTab("records");
      scrollToFirst(["#equipment-form", "#field-form", "#operator-form"]);
      return;
    }
    if (action === "fuel") {
      goToTab("records");
      scrollToFirst(["#fuel-price-form", "#fuel-price-area"]);
      return;
    }
    if (action === "template" || action === "quick-log") {
      goToTab("dashboard");
      scrollToFirst(["#quick-log-panel", "#quick-log-work", "#work-template-form"]);
      return;
    }
    if (action === "estimates") {
      goToTab("estimates");
      scrollToFirst(["#estimate-form", "#estimate-job-type"]);
      return;
    }
    if (action === "seasons") {
      goToTab("seasons");
      scrollToFirst(["#season-planner", "#season-form", "#create-current-seasons"]);
      return;
    }
    if (action === "reports") {
      goToTab("reports");
    }
  });

  const originalRenderAll = renderAll;
  renderAll = function patchedRenderAll() {
    originalRenderAll();
    renderTodayDashboard();
  };

  window.setTimeout(renderTodayDashboard, 100);
})();
