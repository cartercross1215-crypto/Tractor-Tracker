/* Tractor Tracker field season planner add-on */
(() => {
  if (window.__tractorSeasonPlannerInstalled) {
    return;
  }
  window.__tractorSeasonPlannerInstalled = true;

  const SEASON_PLAN_KEY = "tractor-tracker-season-plans-v1";
  STORAGE_KEYS.seasonPlans = SEASON_PLAN_KEY;
  state.seasonPlans = Array.isArray(state.seasonPlans) ? state.seasonPlans : loadData(SEASON_PLAN_KEY, []);
  state.editingSeasonPlanId = state.editingSeasonPlanId || null;

  const COMMON_SEASON_JOBS = [
    "Tillage",
    "Planting",
    "Spraying",
    "Fertilizer",
    "Side-dress",
    "Mowing",
    "Baling",
    "Harvest",
    "Hauling"
  ];

  function ensureSeasonStyles() {
    if (document.querySelector("#season-planner-styles")) {
      return;
    }

    document.head.insertAdjacentHTML("beforeend", `
      <style id="season-planner-styles">
        .season-planner-intro { margin-bottom: 16px; }
        .season-planner-grid { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.35fr); gap: 18px; align-items: start; }
        .season-job-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .season-job-chip { border: 1px solid rgba(49,95,54,.2); border-radius: 999px; padding: 6px 10px; background: #f7fbf5; color: #24351f; font-size: .85rem; }
        .season-job-chip.done { border-color: rgba(49,95,54,.45); background: #e9f4e4; }
        .season-job-chip.due { border-color: rgba(178,91,22,.35); background: #fff4e7; }
        .season-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 12px 0; }
        .season-metric { border: 1px solid rgba(49,95,54,.14); border-radius: 14px; padding: 10px; background: #f8fbf6; }
        .season-metric span { display: block; color: #687464; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
        .season-metric strong { display: block; margin-top: 4px; color: #21351d; font-size: 1.05rem; }
        .season-plan-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .season-quick-add { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
        .season-quick-add button { padding: 6px 10px; }
        .season-card-header { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
        .season-status-pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 9px; font-size: .78rem; background: #e9f4e4; color: #2c542d; font-weight: 700; }
        .season-status-pill.planned { background: #eef3ea; color: #465241; }
        .season-status-pill.done { background: #e6f4ee; color: #1f684a; }
        .season-status-pill.watch { background: #fff4e7; color: #99520f; }
        body[data-app-mode="contracting"] #season-planner-tab { display: none; }
        @media (max-width: 860px) { .season-planner-grid { grid-template-columns: 1fr; } .season-card-header { display: block; } }
      </style>
    `);
  }

  function currentSeasonYear() {
    return new Date().getFullYear();
  }

  function insertSeasonPlannerUi() {
    ensureSeasonStyles();

    const tabs = document.querySelector(".tabs");
    if (tabs && !document.querySelector("#season-planner-tab")) {
      const recordsTab = tabs.querySelector('[data-tab="records"]');
      const tabMarkup = '<button id="season-planner-tab" class="tab" data-tab="seasons" type="button">Seasons</button>';
      if (recordsTab) {
        recordsTab.insertAdjacentHTML("afterend", tabMarkup);
      } else {
        tabs.insertAdjacentHTML("beforeend", tabMarkup);
      }
    }

    const jobsPanel = document.querySelector("#jobs");
    if (jobsPanel && !document.querySelector("#seasons")) {
      jobsPanel.insertAdjacentHTML("beforebegin", `
        <section id="seasons" class="tab-panel season-planner-panel">
          <div class="season-planner-intro panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Farming side</p>
                <h2>Field Season Planner</h2>
                <p class="muted-text">Plan the crop year for each field, then Tractor Tracker pulls completed jobs, fuel, cost, and last-worked history automatically.</p>
              </div>
              <button id="auto-season-plans" type="button" class="secondary-button">Create Current Season for Fields</button>
            </div>
          </div>

          <div class="season-planner-grid">
            <section class="panel">
              <h2>Season Setup</h2>
              <form id="season-plan-form" class="form-grid compact-form">
                <label>Field<select id="season-field" required></select></label>
                <label>Season year<input id="season-year" type="number" min="2000" max="2100" required /></label>
                <label>Crop<input id="season-crop" type="text" placeholder="Corn, soybeans, hay, wheat" required /></label>
                <label>Status<select id="season-status">
                  <option value="planned">Planned</option>
                  <option value="in-progress">In progress</option>
                  <option value="watch">Needs attention</option>
                  <option value="done">Done</option>
                </select></label>
                <label class="full-width">Planned jobs<textarea id="season-planned-jobs" rows="4" placeholder="Planting, Spraying, Side-dress, Harvest"></textarea></label>
                <div class="season-quick-add full-width">
                  <span class="muted-text">Quick add:</span>
                  ${COMMON_SEASON_JOBS.map((name) => `<button class="small-button secondary-button" data-add-season-job="${escapeHtml(name)}" type="button">${escapeHtml(name)}</button>`).join("")}
                </div>
                <label class="full-width">Season notes<textarea id="season-notes" rows="4" placeholder="Seed, fertilizer, chemical, landlord, soil, drainage, or problem spots"></textarea></label>
                <div class="form-actions full-width">
                  <button id="save-season-plan" type="submit">Save Season Plan</button>
                  <button id="cancel-season-edit" type="button" class="secondary-button" hidden>Cancel Edit</button>
                </div>
              </form>
            </section>

            <section class="panel">
              <div class="section-heading">
                <div>
                  <h2>Field Seasons</h2>
                  <p class="muted-text">Completed work is pulled from saved jobs by field and year.</p>
                </div>
              </div>
              <div id="season-plan-list" class="list"></div>
            </section>
          </div>
        </section>
      `);
    }

    Object.assign(elements, {
      seasonPlannerTab: document.querySelector("#season-planner-tab"),
      seasonPlannerPanel: document.querySelector("#seasons"),
      seasonPlanForm: document.querySelector("#season-plan-form"),
      seasonField: document.querySelector("#season-field"),
      seasonYear: document.querySelector("#season-year"),
      seasonCrop: document.querySelector("#season-crop"),
      seasonStatus: document.querySelector("#season-status"),
      seasonPlannedJobs: document.querySelector("#season-planned-jobs"),
      seasonNotes: document.querySelector("#season-notes"),
      seasonPlanList: document.querySelector("#season-plan-list"),
      saveSeasonPlan: document.querySelector("#save-season-plan"),
      cancelSeasonEdit: document.querySelector("#cancel-season-edit"),
      autoSeasonPlans: document.querySelector("#auto-season-plans")
    });
  }

  function plannedJobsFromInput(value) {
    return String(value || "")
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => list.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
  }

  function plannedJobsToInput(jobs) {
    return Array.isArray(jobs) ? jobs.join("\n") : "";
  }

  function getFieldById(fieldId) {
    return state.fields.find((field) => field.id === fieldId);
  }

  function getSeasonPlanById(planId) {
    return state.seasonPlans.find((plan) => plan.id === planId);
  }

  function jobYear(job) {
    const rawDate = job.end || job.start || "";
    if (String(rawDate).slice(0, 4).match(/^\d{4}$/)) {
      return Number(String(rawDate).slice(0, 4));
    }
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? currentSeasonYear() : parsed.getFullYear();
  }

  function jobsForSeason(plan) {
    return state.jobs.filter((job) => job.fieldId === plan.fieldId && jobYear(job) === Number(plan.seasonYear));
  }

  function getSeasonSummary(plan) {
    const field = getFieldById(plan.fieldId);
    const jobs = jobsForSeason(plan);
    const completedNames = [...new Set(jobs.map((job) => job.type).filter(Boolean))];
    const planned = Array.isArray(plan.plannedJobs) ? plan.plannedJobs : [];
    const completedLower = completedNames.map((name) => name.toLowerCase());
    const remaining = planned.filter((name) => !completedLower.includes(name.toLowerCase()));
    const lastJob = jobs.slice().sort((a, b) => new Date(b.end || b.start) - new Date(a.end || a.start))[0];

    const totals = jobs.reduce((summary, job) => {
      const details = getJobDetails(job);
      summary.acres += Number(job.acres || 0);
      summary.hours += Number(details.duration || 0);
      summary.fuelGallons += Number(details.fuelGallons || 0);
      summary.cost += Number(details.totalCost || details.cost || 0);
      summary.distanceMiles += Number(details.distanceMiles || 0);
      summary.loads += Number(job.loads || 0);
      return summary;
    }, { acres: 0, hours: 0, fuelGallons: 0, cost: 0, distanceMiles: 0, loads: 0 });

    const acreBase = Number(field?.acres || totals.acres || 0);
    return {
      field,
      jobs,
      completedNames,
      remaining,
      lastJob,
      totals,
      acreBase,
      costPerAcre: acreBase > 0 ? totals.cost / acreBase : 0,
      fuelPerAcre: acreBase > 0 ? gallonsToFuel(totals.fuelGallons) / acreBase : 0
    };
  }

  function statusLabel(status) {
    const labels = {
      planned: "Planned",
      "in-progress": "In progress",
      watch: "Needs attention",
      done: "Done"
    };
    return labels[status] || "Planned";
  }

  function renderSeasonFieldSelect() {
    if (!elements.seasonField) {
      return;
    }

    const current = elements.seasonField.value;
    elements.seasonField.innerHTML = '<option value="">Choose a field</option>';
    state.fields.forEach((field) => {
      const option = document.createElement("option");
      option.value = field.id;
      option.textContent = `${field.name}${field.acres ? ` (${number(field.acres)} acres)` : ""}`;
      elements.seasonField.appendChild(option);
    });
    elements.seasonField.value = current;
  }

  function renderPlannedJobChips(plan, summary) {
    const planned = Array.isArray(plan.plannedJobs) ? plan.plannedJobs : [];
    if (!planned.length) {
      return '<p class="muted-text">No planned jobs yet.</p>';
    }
    const completed = new Set(summary.completedNames.map((name) => name.toLowerCase()));
    return `<div class="season-job-chips">${planned.map((jobName) => {
      const done = completed.has(jobName.toLowerCase());
      return `<span class="season-job-chip ${done ? "done" : "due"}">${escapeHtml(jobName)}${done ? " ✓" : ""}</span>`;
    }).join("")}</div>`;
  }

  function renderSeasonPlans() {
    insertSeasonPlannerUi();

    if (!elements.seasonPlanList) {
      return;
    }

    const isContracting = isContractingMode();
    if (elements.seasonPlannerTab) {
      elements.seasonPlannerTab.hidden = isContracting;
    }
    if (isContracting) {
      if (elements.seasonPlannerTab?.classList.contains("active")) {
        switchTab("dashboard");
      }
      return;
    }

    renderSeasonFieldSelect();
    if (elements.seasonYear && !elements.seasonYear.value) {
      elements.seasonYear.value = currentSeasonYear();
    }
    if (elements.saveSeasonPlan) {
      elements.saveSeasonPlan.textContent = state.editingSeasonPlanId ? "Update Season Plan" : "Save Season Plan";
    }
    if (elements.cancelSeasonEdit) {
      elements.cancelSeasonEdit.hidden = !state.editingSeasonPlanId;
    }

    if (!state.fields.length) {
      elements.seasonPlanList.innerHTML = '<div class="empty-state">Add fields first, then build crop seasons for them.</div>';
      return;
    }

    if (!state.seasonPlans.length) {
      elements.seasonPlanList.innerHTML = '<div class="empty-state">No season plans yet. Create the current season for your fields or save one manually.</div>';
      return;
    }

    const displayFuelUnit = unitLabel(getPreferredFuelUnit());
    const sortedPlans = state.seasonPlans
      .slice()
      .sort((a, b) => Number(b.seasonYear || 0) - Number(a.seasonYear || 0) || String(getFieldById(a.fieldId)?.name || "").localeCompare(String(getFieldById(b.fieldId)?.name || "")));

    elements.seasonPlanList.innerHTML = "";
    sortedPlans.forEach((plan) => {
      const summary = getSeasonSummary(plan);
      const fieldName = summary.field?.name || "Deleted field";
      const completedText = summary.completedNames.length ? summary.completedNames.join(", ") : "No completed jobs yet";
      const lastWorked = summary.lastJob ? dateTime(summary.lastJob.end || summary.lastJob.start) : "Not worked yet";
      const remainingText = summary.remaining.length ? `${summary.remaining.length} planned left` : "Planned work complete";
      const fuelDisplay = gallonsToFuel(summary.totals.fuelGallons);
      const statusClass = plan.status === "done" ? "done" : plan.status === "watch" ? "watch" : plan.status === "planned" ? "planned" : "";

      elements.seasonPlanList.insertAdjacentHTML("beforeend", `
        <article class="list-item season-card">
          <div class="season-card-header">
            <div>
              <h3>${escapeHtml(fieldName)} - ${escapeHtml(plan.crop || "Crop")} ${escapeHtml(plan.seasonYear || currentSeasonYear())}</h3>
              <p><strong>Status:</strong> <span class="season-status-pill ${statusClass}">${escapeHtml(statusLabel(plan.status))}</span> / <strong>${remainingText}</strong></p>
            </div>
            <div class="item-actions">
              <button class="small-button secondary-button" data-edit-season-plan="${plan.id}" type="button">Edit</button>
              <button class="small-button ghost-button" data-delete-season-plan="${plan.id}" type="button">Delete</button>
            </div>
          </div>
          <div class="season-metrics">
            <div class="season-metric"><span>Completed jobs</span><strong>${number(summary.jobs.length, 0)}</strong></div>
            <div class="season-metric"><span>Field hours</span><strong>${number(summary.totals.hours)}</strong></div>
            <div class="season-metric"><span>Fuel used</span><strong>${number(fuelDisplay, 1)} ${displayFuelUnit}</strong></div>
            <div class="season-metric"><span>Season cost</span><strong>${currency(summary.totals.cost)}</strong></div>
            <div class="season-metric"><span>Cost/acre</span><strong>${currency(summary.costPerAcre)}</strong></div>
            <div class="season-metric"><span>Fuel/acre</span><strong>${number(summary.fuelPerAcre, 2)} ${displayFuelUnit}</strong></div>
          </div>
          <p><strong>Completed:</strong> ${escapeHtml(completedText)}</p>
          <p><strong>Last worked:</strong> ${escapeHtml(lastWorked)}</p>
          ${renderPlannedJobChips(plan, summary)}
          ${plan.notes ? `<p><strong>Season notes:</strong> ${escapeHtml(plan.notes)}</p>` : ""}
        </article>
      `);
    });
  }

  function resetSeasonForm() {
    state.editingSeasonPlanId = null;
    elements.seasonPlanForm?.reset();
    if (elements.seasonYear) {
      elements.seasonYear.value = currentSeasonYear();
    }
  }

  function addPlannedJobToForm(jobName) {
    if (!elements.seasonPlannedJobs) {
      return;
    }
    const jobs = plannedJobsFromInput(elements.seasonPlannedJobs.value);
    if (!jobs.some((name) => name.toLowerCase() === jobName.toLowerCase())) {
      jobs.push(jobName);
    }
    elements.seasonPlannedJobs.value = plannedJobsToInput(jobs);
  }

  function createCurrentSeasonPlans() {
    if (!state.fields.length) {
      showMessage("Add fields before creating season plans.", "error");
      return;
    }

    const year = currentSeasonYear();
    let created = 0;
    state.fields.forEach((field) => {
      const exists = state.seasonPlans.some((plan) => plan.fieldId === field.id && Number(plan.seasonYear) === year);
      if (!exists) {
        state.seasonPlans.push({
          id: id(),
          fieldId: field.id,
          seasonYear: year,
          crop: "Crop TBD",
          status: "planned",
          plannedJobs: ["Tillage", "Planting", "Spraying", "Harvest"],
          notes: field.notes || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        created += 1;
      }
    });

    persist("seasonPlans");
    renderAll();
    showMessage(created ? `${created} season plan${created === 1 ? "" : "s"} created.` : "Current season plans already exist for every field.", created ? "success" : "error");
  }

  const originalGetBackupData = getBackupData;
  getBackupData = function patchedGetBackupDataWithSeasons() {
    return {
      ...originalGetBackupData(),
      seasonPlans: state.seasonPlans
    };
  };

  const originalNormalizeRestoredBackup = normalizeRestoredBackup;
  normalizeRestoredBackup = function patchedNormalizeRestoredBackupWithSeasons(parsedBackup) {
    const normalized = originalNormalizeRestoredBackup(parsedBackup);
    const restoredData = parsedBackup?.data || parsedBackup || {};
    return {
      ...normalized,
      seasonPlans: Array.isArray(restoredData.seasonPlans) ? restoredData.seasonPlans : []
    };
  };

  const originalRestoreFarmBackup = restoreFarmBackup;
  restoreFarmBackup = function patchedRestoreFarmBackupWithSeasons(restoredData, options = {}) {
    const seasonPlans = Array.isArray(restoredData.seasonPlans) ? restoredData.seasonPlans : [];
    originalRestoreFarmBackup(restoredData, options);
    state.seasonPlans = seasonPlans;
    saveData(SEASON_PLAN_KEY, state.seasonPlans);
    renderSeasonPlans();
  };

  const originalClearLocalFarmDataAfterDeletion = clearLocalFarmDataAfterDeletion;
  clearLocalFarmDataAfterDeletion = function patchedClearLocalFarmDataAfterDeletionWithSeasons() {
    originalClearLocalFarmDataAfterDeletion();
    state.seasonPlans = [];
    saveData(SEASON_PLAN_KEY, state.seasonPlans);
  };

  const originalRenderAll = renderAll;
  renderAll = function patchedRenderAllWithSeasons() {
    originalRenderAll();
    renderSeasonPlans();
  };

  function bindSeasonEvents() {
    elements.seasonPlanForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      const fieldId = elements.seasonField.value;
      if (!fieldId) {
        showMessage("Choose a field for this season plan.", "error");
        return;
      }

      const plan = {
        id: state.editingSeasonPlanId || id(),
        fieldId,
        seasonYear: Number(elements.seasonYear.value || currentSeasonYear()),
        crop: elements.seasonCrop.value.trim(),
        status: elements.seasonStatus.value || "planned",
        plannedJobs: plannedJobsFromInput(elements.seasonPlannedJobs.value),
        notes: elements.seasonNotes.value.trim(),
        createdAt: getSeasonPlanById(state.editingSeasonPlanId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!plan.crop) {
        showMessage("Enter a crop or season name.", "error");
        return;
      }

      const duplicate = state.seasonPlans.find((item) => (
        item.id !== plan.id && item.fieldId === plan.fieldId && Number(item.seasonYear) === Number(plan.seasonYear)
      ));
      if (duplicate && !window.confirm("This field already has a season plan for that year. Save another one anyway?")) {
        return;
      }

      if (state.editingSeasonPlanId) {
        state.seasonPlans = state.seasonPlans.map((item) => item.id === state.editingSeasonPlanId ? plan : item);
      } else {
        state.seasonPlans.push(plan);
      }

      persist("seasonPlans");
      resetSeasonForm();
      renderAll();
      showMessage("Season plan saved.", "success");
    });

    elements.cancelSeasonEdit?.addEventListener("click", () => {
      resetSeasonForm();
      renderAll();
    });

    elements.autoSeasonPlans?.addEventListener("click", createCurrentSeasonPlans);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.addSeasonJob) {
      addPlannedJobToForm(button.dataset.addSeasonJob);
    }

    if (button.dataset.editSeasonPlan) {
      const plan = getSeasonPlanById(button.dataset.editSeasonPlan);
      if (!plan) {
        return;
      }
      state.editingSeasonPlanId = plan.id;
      switchTab("seasons");
      renderAll();
      elements.seasonField.value = plan.fieldId;
      elements.seasonYear.value = plan.seasonYear || currentSeasonYear();
      elements.seasonCrop.value = plan.crop || "";
      elements.seasonStatus.value = plan.status || "planned";
      elements.seasonPlannedJobs.value = plannedJobsToInput(plan.plannedJobs || []);
      elements.seasonNotes.value = plan.notes || "";
      elements.seasonCrop.focus();
    }

    if (button.dataset.deleteSeasonPlan) {
      if (!window.confirm("Delete this field season plan? Saved job history will stay.")) {
        return;
      }
      state.seasonPlans = state.seasonPlans.filter((plan) => plan.id !== button.dataset.deleteSeasonPlan);
      state.editingSeasonPlanId = state.editingSeasonPlanId === button.dataset.deleteSeasonPlan ? null : state.editingSeasonPlanId;
      persist("seasonPlans");
      renderAll();
      showMessage("Season plan deleted.", "success");
    }
  });

  insertSeasonPlannerUi();
  bindSeasonEvents();
  renderAll();
})();
