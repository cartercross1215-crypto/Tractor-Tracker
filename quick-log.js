/* Tractor Tracker Quick Log + Work Templates add-on */
(() => {
  if (window.__tractorQuickLogInstalled) {
    return;
  }
  window.__tractorQuickLogInstalled = true;

  const WORK_TEMPLATE_KEY = "tractor-tracker-work-templates-v1";
  STORAGE_KEYS.workTemplates = WORK_TEMPLATE_KEY;
  state.workTemplates = Array.isArray(state.workTemplates) ? state.workTemplates : loadData(WORK_TEMPLATE_KEY, []);
  state.editingWorkTemplateId = state.editingWorkTemplateId || null;

  function injectQuickLogStyles() {
    if (document.querySelector("#quick-log-styles")) {
      return;
    }
    document.head.insertAdjacentHTML("beforeend", `
      <style id="quick-log-styles">
        .quick-log-panel,
        .work-template-panel {
          margin-top: 18px;
          padding: 16px;
          border: 1px solid rgba(49, 95, 54, 0.18);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.74);
        }
        body[data-app-mode="contracting"] .quick-log-panel,
        body[data-app-mode="contracting"] .work-template-panel {
          border-color: rgba(197, 96, 31, 0.28);
          background: rgba(255, 247, 237, 0.84);
        }
        .quick-log-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
        }
        .quick-log-preview {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(49, 95, 54, 0.08);
          color: #24301f;
        }
        body[data-app-mode="contracting"] .quick-log-preview {
          background: rgba(197, 96, 31, 0.12);
        }
        .template-list .status-pill {
          margin-right: 6px;
        }
      </style>
    `);
  }

  function getWorkTemplateById(templateId) {
    return state.workTemplates.find((template) => template.id === templateId);
  }

  function ensureSelectOption(select, value) {
    if (!select || !value) {
      return;
    }
    const exists = [...select.options].some((option) => option.value === value);
    if (!exists) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
  }

  function preferredTemplateLabel() {
    return isContractingMode() ? "job template" : "field work template";
  }

  function templateSummary(template) {
    const equipment = getEquipmentById(template.equipmentId)?.name || "Any equipment";
    const implement = state.implements.find((item) => item.id === template.implementId)?.name || (isContractingMode() ? "Any attachment" : "Any implement");
    const operator = state.operators.find((item) => item.id === template.operatorId)?.name || "Any operator";
    const parts = [
      template.jobType || template.name,
      equipment,
      implement,
      operator,
      template.fuel ? `${number(template.fuel)} ${unitLabel(template.fuelUnit || getPreferredFuelUnit())} fuel` : ""
    ].filter(Boolean);
    return parts.join(" / ");
  }

  function optionLabel(record, fallback) {
    return record?.name || fallback;
  }

  function populateQuickLogSelects() {
    insertQuickLogUi();
    if (!elements.quickTemplateSelect) {
      return;
    }

    const currentTemplate = elements.quickTemplateSelect.value;
    elements.quickTemplateSelect.innerHTML = '<option value="">Choose a saved template</option>';
    state.workTemplates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      elements.quickTemplateSelect.appendChild(option);
    });
    if (currentTemplate) {
      elements.quickTemplateSelect.value = currentTemplate;
    }

    const currentLocation = elements.quickLocationSelect.value;
    const mode = getModeCopy();
    elements.quickLocationSelect.innerHTML = `<option value="">Choose ${mode.locationSingular}</option>`;
    state.fields.forEach((field) => {
      const option = document.createElement("option");
      option.value = field.id;
      option.textContent = `${field.name}${isContractingMode() && getCustomerById(field.customerId) ? ` - ${getCustomerById(field.customerId).name}` : ""}`;
      elements.quickLocationSelect.appendChild(option);
    });
    if (currentLocation) {
      elements.quickLocationSelect.value = currentLocation;
    }

    [
      [elements.templateEquipment, state.equipment, "Use first saved equipment"],
      [elements.templateImplement, state.implements, isContractingMode() ? "Use first saved attachment" : "Use first saved implement"],
      [elements.templateOperator, state.operators, "Use first saved operator"]
    ].forEach(([select, records, placeholder]) => {
      if (!select) {
        return;
      }
      const currentValue = select.value;
      select.innerHTML = `<option value="">${placeholder}</option>`;
      records.forEach((record) => {
        const option = document.createElement("option");
        option.value = record.id;
        option.textContent = optionLabel(record, "Saved item");
        select.appendChild(option);
      });
      if (currentValue) {
        select.value = currentValue;
      }
    });
  }

  function insertQuickLogUi() {
    injectQuickLogStyles();

    const recentJobs = document.querySelector("#recent-jobs");
    if (recentJobs && !document.querySelector("#quick-log-panel")) {
      recentJobs.insertAdjacentHTML("afterend", `
        <section id="quick-log-panel" class="quick-log-panel">
          <div class="section-heading">
            <div>
              <h2>Quick Log Work</h2>
              <p class="muted-text">Pick a template, choose the field or job site, then fill the job form or start the timer from the dashboard.</p>
            </div>
          </div>
          <form id="quick-log-form" class="form-grid compact-form">
            <label>Template<select id="quick-template-select"></select></label>
            <label><span id="quick-location-label">Field / job site</span><select id="quick-location-select"></select></label>
            <label>Quick acres / loads<input id="quick-production" type="number" min="0" step="0.1" placeholder="Optional" /></label>
            <label>Quick fuel<input id="quick-fuel" type="number" min="0" step="0.1" placeholder="Optional" /></label>
            <div class="quick-log-actions full-width">
              <button id="quick-fill-job" type="button">Fill Job Form</button>
              <button id="quick-start-timer" type="button" class="secondary-button">Start Timer</button>
              <button id="quick-create-templates" type="button" class="ghost-button">Create Starter Templates</button>
            </div>
          </form>
          <p id="quick-log-preview" class="quick-log-preview">Create templates for your repeat work, then logging from the cab gets fast.</p>
        </section>
      `);
    }

    const implementList = document.querySelector("#implement-list");
    if (implementList && !document.querySelector("#work-template-form")) {
      implementList.insertAdjacentHTML("afterend", `
        <section class="sub-panel work-template-panel">
          <h2>Work Templates</h2>
          <p class="muted-text">Save repeat jobs like disking, planting, mowing, baling, grading, or hauling. Quick Log uses these to prefill the job form.</p>
          <form id="work-template-form" class="form-grid compact-form">
            <label>Template name<input id="template-name" type="text" placeholder="Disking" required /></label>
            <label>Job type<input id="template-job-type" type="text" placeholder="Disking" required /></label>
            <label>Default equipment<select id="template-equipment"></select></label>
            <label><span id="template-implement-label">Default implement</span><select id="template-implement"></select></label>
            <label>Default operator<select id="template-operator"></select></label>
            <label>Usual fuel<input id="template-fuel" type="number" min="0" step="0.1" placeholder="Optional" /></label>
            <label>Fuel unit<select id="template-fuel-unit">
              <option value="gal">Gallons</option>
              <option value="l">Liters</option>
            </select></label>
            <label>Usual hourly charge<input id="template-cost-hour" type="number" min="0" step="0.01" placeholder="Optional" /></label>
            <label>Usual distance charge<input id="template-cost-distance" type="number" min="0" step="0.01" placeholder="Optional" /></label>
            <label class="full-width">Default notes<input id="template-notes" type="text" placeholder="Anything you always want copied into the job notes" /></label>
            <div class="form-actions full-width">
              <button id="save-work-template" type="submit">Save Template</button>
              <button id="cancel-work-template-edit" type="button" class="secondary-button" hidden>Cancel Edit</button>
            </div>
          </form>
          <div id="work-template-list" class="list template-list"></div>
        </section>
      `);
    }

    Object.assign(elements, {
      quickLogForm: document.querySelector("#quick-log-form"),
      quickTemplateSelect: document.querySelector("#quick-template-select"),
      quickLocationSelect: document.querySelector("#quick-location-select"),
      quickLocationLabel: document.querySelector("#quick-location-label"),
      quickProduction: document.querySelector("#quick-production"),
      quickFuel: document.querySelector("#quick-fuel"),
      quickFillJob: document.querySelector("#quick-fill-job"),
      quickStartTimer: document.querySelector("#quick-start-timer"),
      quickCreateTemplates: document.querySelector("#quick-create-templates"),
      quickLogPreview: document.querySelector("#quick-log-preview"),
      workTemplateForm: document.querySelector("#work-template-form"),
      workTemplateList: document.querySelector("#work-template-list"),
      templateName: document.querySelector("#template-name"),
      templateJobType: document.querySelector("#template-job-type"),
      templateEquipment: document.querySelector("#template-equipment"),
      templateImplement: document.querySelector("#template-implement"),
      templateImplementLabel: document.querySelector("#template-implement-label"),
      templateOperator: document.querySelector("#template-operator"),
      templateFuel: document.querySelector("#template-fuel"),
      templateFuelUnit: document.querySelector("#template-fuel-unit"),
      templateCostHour: document.querySelector("#template-cost-hour"),
      templateCostDistance: document.querySelector("#template-cost-distance"),
      templateNotes: document.querySelector("#template-notes"),
      saveWorkTemplate: document.querySelector("#save-work-template"),
      cancelWorkTemplateEdit: document.querySelector("#cancel-work-template-edit")
    });
  }

  function updateQuickLogPreview() {
    if (!elements.quickLogPreview) {
      return;
    }
    const template = getWorkTemplateById(elements.quickTemplateSelect?.value);
    const location = state.fields.find((field) => field.id === elements.quickLocationSelect?.value);
    if (!template) {
      elements.quickLogPreview.textContent = state.workTemplates.length
        ? `Choose a ${preferredTemplateLabel()} to prefill a job.`
        : "Create starter templates, then Quick Log can fill jobs in seconds.";
      return;
    }
    const mode = getModeCopy();
    elements.quickLogPreview.textContent = `${templateSummary(template)}${location ? ` at ${location.name}` : ` / choose ${mode.locationSingular}`}.`;
  }

  function renderWorkTemplates() {
    insertQuickLogUi();
    populateQuickLogSelects();

    if (elements.quickLocationLabel) {
      elements.quickLocationLabel.textContent = getModeCopy().locationLabel;
    }
    if (elements.templateImplementLabel) {
      elements.templateImplementLabel.textContent = isContractingMode() ? "Default attachment" : "Default implement";
    }
    if (elements.templateFuelUnit) {
      elements.templateFuelUnit.value = elements.templateFuelUnit.value || getPreferredFuelUnit();
    }
    if (elements.saveWorkTemplate) {
      elements.saveWorkTemplate.textContent = state.editingWorkTemplateId ? "Update Template" : "Save Template";
    }
    if (elements.cancelWorkTemplateEdit) {
      elements.cancelWorkTemplateEdit.hidden = !state.editingWorkTemplateId;
    }

    if (!elements.workTemplateList) {
      return;
    }

    elements.workTemplateList.innerHTML = "";
    if (!state.workTemplates.length) {
      elements.workTemplateList.innerHTML = '<div class="empty-state">No work templates saved yet.</div>';
      updateQuickLogPreview();
      return;
    }

    state.workTemplates.forEach((template) => {
      elements.workTemplateList.insertAdjacentHTML("beforeend", `
        <article class="list-item">
          <div class="list-item-row">
            <div>
              <h3>${escapeHtml(template.name)}</h3>
              <p>${escapeHtml(templateSummary(template))}</p>
              <p>
                ${template.costPerHour ? `<span class="status-pill">${currency(template.costPerHour)}/hr</span>` : ""}
                ${template.costPerDistance ? `<span class="status-pill">${currency(template.costPerDistance)}/${unitLabel(getPreferredDistanceUnit())}</span>` : ""}
              </p>
              ${template.notes ? `<p>${escapeHtml(template.notes)}</p>` : ""}
            </div>
            <div class="item-actions">
              <button class="small-button secondary-button" data-use-template="${template.id}" type="button">Use</button>
              <button class="small-button secondary-button" data-edit-work-template="${template.id}" type="button">Edit</button>
              <button class="small-button ghost-button" data-delete-work-template="${template.id}" type="button">Delete</button>
            </div>
          </div>
        </article>
      `);
    });
    updateQuickLogPreview();
  }

  function createStarterTemplates() {
    const equipmentId = state.equipment[0]?.id || "";
    const implementId = state.implements[0]?.id || "";
    const operatorId = state.operators[0]?.id || "";
    const starterNames = isContractingMode()
      ? ["Grading", "Hauling", "Mowing", "Skid-steer Work", "Material Delivery"]
      : ["Disking", "Planting", "Spraying", "Mowing", "Baling", "Harvesting", "Hauling"];
    const existingNames = new Set(state.workTemplates.map((template) => template.name.toLowerCase()));
    const additions = starterNames
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => ({
        id: id(),
        name,
        jobType: name,
        equipmentId,
        implementId,
        operatorId,
        fuel: 0,
        fuelUnit: getPreferredFuelUnit(),
        costPerHour: 0,
        costPerDistance: 0,
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    if (!additions.length) {
      showMessage("Starter templates are already added.", "success");
      return;
    }
    state.workTemplates = [...state.workTemplates, ...additions];
    persist("workTemplates");
    renderAll();
    showMessage("Starter work templates added.", "success");
  }

  function getTemplateDefaults(template) {
    return {
      fieldId: elements.quickLocationSelect?.value || state.fields[0]?.id || "",
      equipmentId: template.equipmentId || state.equipment[0]?.id || "",
      implementId: template.implementId || state.implements[0]?.id || "",
      operatorId: template.operatorId || state.operators[0]?.id || "",
      jobType: template.jobType || template.name || "General Work",
      fuel: Number(elements.quickFuel?.value || template.fuel || 0),
      production: Number(elements.quickProduction?.value || 0),
      fuelUnit: template.fuelUnit || getPreferredFuelUnit(),
      costPerHour: Number(template.costPerHour || 0),
      costPerDistance: Number(template.costPerDistance || 0),
      notes: template.notes || ""
    };
  }

  function applyTemplateToJobForm({ startTimer = false } = {}) {
    const template = getWorkTemplateById(elements.quickTemplateSelect?.value);
    if (!template) {
      showMessage(`Choose a ${preferredTemplateLabel()} first.`, "error");
      elements.quickTemplateSelect?.focus();
      return;
    }
    if (!state.fields.length || !state.equipment.length || !state.operators.length || !state.implements.length) {
      showMessage("Save equipment, operator, implement/attachment, and field/job site before using Quick Log.", "error");
      return;
    }

    const defaults = getTemplateDefaults(template);
    switchTab("jobs");
    setDefaultJobTimes();
    renderAll();

    elements.jobField.value = defaults.fieldId;
    elements.jobEquipment.value = defaults.equipmentId;
    elements.jobImplement.value = defaults.implementId;
    elements.jobOperator.value = defaults.operatorId;
    ensureSelectOption(elements.jobType, defaults.jobType);
    elements.jobType.value = defaults.jobType;
    document.querySelector("#job-fuel").value = defaults.fuel || "";
    elements.jobFuelUnit.value = defaults.fuelUnit;
    document.querySelector("#job-cost-hour").value = defaults.costPerHour || "";
    if (elements.jobCostDistance) {
      elements.jobCostDistance.value = defaults.costPerDistance || "";
    }
    if (isContractingMode()) {
      elements.jobLoads.value = defaults.production || "";
    } else {
      document.querySelector("#job-acres").value = defaults.production || "";
    }
    document.querySelector("#job-notes").value = defaults.notes;

    if (startTimer) {
      elements.startJob.click();
      return;
    }

    showMessage(`${template.name} template filled. Add final acres/fuel/notes, then save the job.`, "success");
  }

  function bindQuickLogEvents() {
    elements.quickTemplateSelect?.addEventListener("change", updateQuickLogPreview);
    elements.quickLocationSelect?.addEventListener("change", updateQuickLogPreview);
    elements.quickFuel?.addEventListener("input", updateQuickLogPreview);
    elements.quickProduction?.addEventListener("input", updateQuickLogPreview);
    elements.quickCreateTemplates?.addEventListener("click", createStarterTemplates);
    elements.quickFillJob?.addEventListener("click", () => applyTemplateToJobForm({ startTimer: false }));
    elements.quickStartTimer?.addEventListener("click", () => applyTemplateToJobForm({ startTimer: true }));

    elements.workTemplateForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const template = {
        id: state.editingWorkTemplateId || id(),
        name: elements.templateName.value.trim(),
        jobType: elements.templateJobType.value.trim(),
        equipmentId: elements.templateEquipment.value,
        implementId: elements.templateImplement.value,
        operatorId: elements.templateOperator.value,
        fuel: Number(elements.templateFuel.value || 0),
        fuelUnit: elements.templateFuelUnit.value || getPreferredFuelUnit(),
        costPerHour: Number(elements.templateCostHour.value || 0),
        costPerDistance: Number(elements.templateCostDistance.value || 0),
        notes: elements.templateNotes.value.trim(),
        createdAt: getWorkTemplateById(state.editingWorkTemplateId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (state.editingWorkTemplateId) {
        state.workTemplates = state.workTemplates.map((item) => item.id === state.editingWorkTemplateId ? template : item);
        state.editingWorkTemplateId = null;
      } else {
        state.workTemplates.push(template);
      }
      persist("workTemplates");
      elements.workTemplateForm.reset();
      renderAll();
      showMessage("Work template saved.", "success");
    });

    elements.cancelWorkTemplateEdit?.addEventListener("click", () => {
      state.editingWorkTemplateId = null;
      elements.workTemplateForm.reset();
      renderAll();
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.useTemplate) {
      switchTab("dashboard");
      renderAll();
      elements.quickTemplateSelect.value = button.dataset.useTemplate;
      updateQuickLogPreview();
      elements.quickLocationSelect.focus();
    }

    if (button.dataset.editWorkTemplate) {
      const template = getWorkTemplateById(button.dataset.editWorkTemplate);
      if (!template) {
        return;
      }
      state.editingWorkTemplateId = template.id;
      switchTab("records");
      renderAll();
      elements.templateName.value = template.name;
      elements.templateJobType.value = template.jobType;
      elements.templateEquipment.value = template.equipmentId || "";
      elements.templateImplement.value = template.implementId || "";
      elements.templateOperator.value = template.operatorId || "";
      elements.templateFuel.value = template.fuel || "";
      elements.templateFuelUnit.value = template.fuelUnit || getPreferredFuelUnit();
      elements.templateCostHour.value = template.costPerHour || "";
      elements.templateCostDistance.value = template.costPerDistance || "";
      elements.templateNotes.value = template.notes || "";
      elements.templateName.focus();
    }

    if (button.dataset.deleteWorkTemplate) {
      if (!window.confirm("Delete this work template? Saved jobs will stay untouched.")) {
        return;
      }
      state.workTemplates = state.workTemplates.filter((template) => template.id !== button.dataset.deleteWorkTemplate);
      state.editingWorkTemplateId = state.editingWorkTemplateId === button.dataset.deleteWorkTemplate ? null : state.editingWorkTemplateId;
      persist("workTemplates");
      renderAll();
    }
  });

  const originalGetBackupData = getBackupData;
  getBackupData = function patchedQuickLogGetBackupData() {
    return {
      ...originalGetBackupData(),
      workTemplates: state.workTemplates
    };
  };

  const originalNormalizeRestoredBackup = normalizeRestoredBackup;
  normalizeRestoredBackup = function patchedQuickLogNormalizeRestoredBackup(parsedBackup) {
    const normalized = originalNormalizeRestoredBackup(parsedBackup);
    const restoredData = parsedBackup?.data || parsedBackup || {};
    return {
      ...normalized,
      workTemplates: Array.isArray(restoredData.workTemplates) ? restoredData.workTemplates : []
    };
  };

  const originalRestoreFarmBackup = restoreFarmBackup;
  restoreFarmBackup = function patchedQuickLogRestoreFarmBackup(restoredData, options = {}) {
    const workTemplates = Array.isArray(restoredData.workTemplates) ? restoredData.workTemplates : [];
    originalRestoreFarmBackup(restoredData, options);
    state.workTemplates = workTemplates;
    saveData(WORK_TEMPLATE_KEY, state.workTemplates);
    renderWorkTemplates();
  };

  const originalClearEditState = clearEditState;
  clearEditState = function patchedQuickLogClearEditState() {
    originalClearEditState();
    state.editingWorkTemplateId = null;
    elements.workTemplateForm?.reset();
  };

  const originalClearLocalFarmDataAfterDeletion = clearLocalFarmDataAfterDeletion;
  clearLocalFarmDataAfterDeletion = function patchedQuickLogClearLocalFarmDataAfterDeletion() {
    originalClearLocalFarmDataAfterDeletion();
    state.workTemplates = [];
    saveData(WORK_TEMPLATE_KEY, state.workTemplates);
  };

  const originalRenderAll = renderAll;
  renderAll = function patchedQuickLogRenderAll() {
    originalRenderAll();
    renderWorkTemplates();
  };

  insertQuickLogUi();
  bindQuickLogEvents();
  renderAll();
})();
