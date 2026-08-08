/* Tractor Tracker estimate / bid builder add-on */
(() => {
  if (window.__tractorEstimateBuilderInstalled) {
    return;
  }
  window.__tractorEstimateBuilderInstalled = true;

  const ESTIMATE_KEY = "tractor-tracker-estimates-v1";
  STORAGE_KEYS.estimates = ESTIMATE_KEY;
  state.estimates = Array.isArray(state.estimates) ? state.estimates : loadData(ESTIMATE_KEY, []);
  state.editingEstimateId = state.editingEstimateId || null;
  state.pendingEstimateIdForJob = state.pendingEstimateIdForJob || null;

  function insertEstimateStyles() {
    if (document.querySelector("#estimate-builder-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "estimate-builder-styles";
    style.textContent = `
      .estimate-summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin: 16px 0;
      }
      .estimate-summary-card {
        background: rgba(49, 95, 54, 0.08);
        border: 1px solid rgba(49, 95, 54, 0.18);
        border-radius: 14px;
        padding: 14px;
      }
      body[data-app-mode="contracting"] .estimate-summary-card {
        background: rgba(203, 102, 31, 0.1);
        border-color: rgba(203, 102, 31, 0.25);
      }
      .estimate-summary-card span {
        display: block;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5b6354;
        margin-bottom: 4px;
      }
      .estimate-summary-card strong {
        font-size: 1.2rem;
      }
      .estimate-profit-good strong { color: #315f36; }
      .estimate-profit-warn strong { color: #9a4e0d; }
      .estimate-actions { flex-wrap: wrap; }
      .estimate-status-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 0.76rem;
        font-weight: 700;
        background: rgba(49, 95, 54, 0.12);
        color: #315f36;
      }
      body[data-app-mode="contracting"] .estimate-status-pill {
        background: rgba(203, 102, 31, 0.14);
        color: #9a4e0d;
      }
    `;
    document.head.appendChild(style);
  }

  function insertEstimateUi() {
    insertEstimateStyles();

    const tabs = document.querySelector(".tabs");
    if (tabs && !document.querySelector('[data-tab="estimates"]')) {
      const jobsTab = tabs.querySelector('[data-tab="jobs"]');
      const estimateTab = '<button class="tab" data-tab="estimates" type="button">Estimates</button>';
      if (jobsTab) {
        jobsTab.insertAdjacentHTML("afterend", estimateTab);
      } else {
        tabs.insertAdjacentHTML("beforeend", estimateTab);
      }
    }

    const jobsPanel = document.querySelector("#jobs");
    if (jobsPanel && !document.querySelector("#estimates")) {
      jobsPanel.insertAdjacentHTML("afterend", `
        <section id="estimates" class="tab-panel" hidden>
          <section class="panel">
            <div class="section-heading">
              <div>
                <h2>Estimate Builder</h2>
                <p>Build a bid before the work starts, then convert it into a job, invoice, and profit check.</p>
              </div>
              <button id="clear-estimate-form" type="button" class="secondary-button">New Estimate</button>
            </div>
            <form id="estimate-form" class="form-grid">
              <label>Customer<select id="estimate-customer"></select></label>
              <label><span id="estimate-site-label">Field / job site</span><select id="estimate-field"></select></label>
              <label>Job type<input id="estimate-job-type" type="text" placeholder="Grading, hauling, mowing, disking" required /></label>
              <label>Estimate number<input id="estimate-number" type="text" placeholder="Auto" /></label>
              <label>Equipment<select id="estimate-equipment"></select></label>
              <label><span id="estimate-implement-label">Attachment / implement</span><select id="estimate-implement"></select></label>
              <label>Operator<select id="estimate-operator"></select></label>
              <label>Estimated hours<input id="estimate-hours" type="number" min="0" step="0.1" placeholder="4.5" /></label>
              <label>Estimated distance<input id="estimate-distance" type="number" min="0" step="0.1" placeholder="Optional" /></label>
              <label>Distance unit<select id="estimate-distance-unit">
                <option value="mi">Miles</option>
                <option value="km">Kilometers</option>
              </select></label>
              <label>Fuel type<select id="estimate-fuel-type">
                <option>Diesel</option>
                <option>Gas</option>
                <option>Off-road diesel</option>
                <option>DEF</option>
                <option>Other</option>
              </select></label>
              <label>Estimated fuel used<input id="estimate-fuel" type="number" min="0" step="0.1" placeholder="Optional" /></label>
              <label>Fuel unit<select id="estimate-fuel-unit">
                <option value="gal">Gallons</option>
                <option value="l">Liters</option>
              </select></label>
              <label>Fuel price<input id="estimate-fuel-price" type="number" min="0" step="0.001" placeholder="Optional" /></label>
              <label>Fuel price unit<select id="estimate-fuel-price-unit">
                <option value="gal">per gallon</option>
                <option value="l">per liter</option>
              </select></label>
              <label>Hourly charge<input id="estimate-hourly-rate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
              <label><span id="estimate-distance-rate-label">Distance charge</span><input id="estimate-distance-rate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
              <label>Material cost<input id="estimate-material-cost" type="number" min="0" step="0.01" placeholder="0.00" /></label>
              <label>Extra charges<input id="estimate-extra-charges" type="number" min="0" step="0.01" placeholder="0.00" /></label>
              <label>Target profit margin %<input id="estimate-margin" type="number" min="0" max="95" step="0.1" value="30" /></label>
              <label>Quoted price<input id="estimate-quote" type="number" min="0" step="0.01" placeholder="Use suggested quote" /></label>
              <label class="full-width">Notes<textarea id="estimate-notes" rows="3" placeholder="Scope, material, customer requests, exclusions, driveway/field details"></textarea></label>
              <div id="estimate-summary" class="estimate-summary-grid full-width"></div>
              <div class="form-actions full-width estimate-actions">
                <button id="save-estimate" type="submit">Save Estimate</button>
                <button id="cancel-estimate-edit" type="button" class="secondary-button" hidden>Cancel Edit</button>
              </div>
            </form>
            <p id="estimate-message" class="message" aria-live="polite"></p>
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <h2>Saved Estimates</h2>
                <p>Convert a bid into a job, create an invoice, print it, or compare it to actual job results.</p>
              </div>
            </div>
            <div id="estimate-list" class="list"></div>
          </section>
        </section>
      `);
    }

    Object.assign(elements, {
      estimateForm: document.querySelector("#estimate-form"),
      estimateCustomer: document.querySelector("#estimate-customer"),
      estimateField: document.querySelector("#estimate-field"),
      estimateJobType: document.querySelector("#estimate-job-type"),
      estimateNumber: document.querySelector("#estimate-number"),
      estimateEquipment: document.querySelector("#estimate-equipment"),
      estimateImplement: document.querySelector("#estimate-implement"),
      estimateOperator: document.querySelector("#estimate-operator"),
      estimateHours: document.querySelector("#estimate-hours"),
      estimateDistance: document.querySelector("#estimate-distance"),
      estimateDistanceUnit: document.querySelector("#estimate-distance-unit"),
      estimateFuelType: document.querySelector("#estimate-fuel-type"),
      estimateFuel: document.querySelector("#estimate-fuel"),
      estimateFuelUnit: document.querySelector("#estimate-fuel-unit"),
      estimateFuelPrice: document.querySelector("#estimate-fuel-price"),
      estimateFuelPriceUnit: document.querySelector("#estimate-fuel-price-unit"),
      estimateHourlyRate: document.querySelector("#estimate-hourly-rate"),
      estimateDistanceRateLabel: document.querySelector("#estimate-distance-rate-label"),
      estimateDistanceRate: document.querySelector("#estimate-distance-rate"),
      estimateMaterialCost: document.querySelector("#estimate-material-cost"),
      estimateExtraCharges: document.querySelector("#estimate-extra-charges"),
      estimateMargin: document.querySelector("#estimate-margin"),
      estimateQuote: document.querySelector("#estimate-quote"),
      estimateNotes: document.querySelector("#estimate-notes"),
      estimateSummary: document.querySelector("#estimate-summary"),
      estimateList: document.querySelector("#estimate-list"),
      estimateMessage: document.querySelector("#estimate-message"),
      saveEstimate: document.querySelector("#save-estimate"),
      cancelEstimateEdit: document.querySelector("#cancel-estimate-edit"),
      clearEstimateForm: document.querySelector("#clear-estimate-form"),
      estimateSiteLabel: document.querySelector("#estimate-site-label"),
      estimateImplementLabel: document.querySelector("#estimate-implement-label")
    });

    elements.tabs = document.querySelectorAll(".tab");
    elements.panels = document.querySelectorAll(".tab-panel");
  }

  function showEstimateMessage(text, type = "") {
    if (!elements.estimateMessage) {
      return;
    }
    elements.estimateMessage.textContent = text;
    elements.estimateMessage.className = `message ${type}`;
  }

  function fillSelect(select, options, placeholder, labelKey = "name") {
    if (!select) {
      return;
    }
    const previous = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.id;
      optionElement.textContent = option[labelKey] || option.name || option.email || "Unnamed";
      select.appendChild(optionElement);
    });
    if (previous) {
      select.value = previous;
    }
  }

  function getFieldById(fieldId) {
    return state.fields.find((field) => field.id === fieldId);
  }

  function getEstimateById(estimateId) {
    return state.estimates.find((estimate) => estimate.id === estimateId);
  }

  function estimateNumber() {
    const year = new Date().getFullYear();
    return `EST-${year}-${String(state.estimates.length + 1).padStart(3, "0")}`;
  }

  function clampPercent(value) {
    return Math.min(95, Math.max(0, Number(value || 0))) / 100;
  }

  function estimateFuelAmountInUnit(value, fromUnit, toUnit) {
    const gallons = fuelToGallons(value, fromUnit || getPreferredFuelUnit());
    return toUnit === "l" ? gallonsToFuel(gallons, "l") : gallons;
  }

  function calculateEstimate(estimate) {
    const hours = Number(estimate.hours || 0);
    const distance = Number(estimate.distance || 0);
    const fuel = Number(estimate.fuel || 0);
    const fuelPrice = Number(estimate.fuelPrice || 0);
    const fuelPriceUnit = estimate.fuelPriceUnit || estimate.fuelUnit || getPreferredFuelUnit();
    const fuelAmountForPrice = estimateFuelAmountInUnit(fuel, estimate.fuelUnit || getPreferredFuelUnit(), fuelPriceUnit);
    const fuelCost = fuelAmountForPrice * fuelPrice;
    const hourlyCost = hours * Number(estimate.hourlyRate || 0);
    const distanceCost = distance * Number(estimate.distanceRate || 0);
    const materialCost = Number(estimate.materialCost || 0);
    const extraCharges = Number(estimate.extraCharges || 0);
    const breakEven = hourlyCost + distanceCost + fuelCost + materialCost + extraCharges;
    const margin = clampPercent(estimate.targetMargin);
    const suggestedQuote = margin >= 0.95 ? breakEven : breakEven / (1 - margin);
    const quoteAmount = Number(estimate.quoteAmount || 0) || suggestedQuote;
    const profit = quoteAmount - breakEven;
    const profitMargin = quoteAmount > 0 ? (profit / quoteAmount) * 100 : 0;

    return {
      hours,
      distance,
      fuel,
      hourlyCost,
      distanceCost,
      fuelCost,
      materialCost,
      extraCharges,
      breakEven,
      suggestedQuote,
      quoteAmount,
      profit,
      profitMargin
    };
  }

  function getEstimateFormData(estimateId = id()) {
    const customer = getCustomerById(elements.estimateCustomer?.value);
    const field = getFieldById(elements.estimateField?.value);
    const existing = getEstimateById(estimateId);
    const distanceUnit = elements.estimateDistanceUnit?.value || getPreferredDistanceUnit();
    const fuelUnit = elements.estimateFuelUnit?.value || getPreferredFuelUnit();
    const fuelPriceUnit = elements.estimateFuelPriceUnit?.value || fuelUnit;

    return {
      id: estimateId,
      number: elements.estimateNumber?.value.trim() || existing?.number || estimateNumber(),
      status: existing?.status || "draft",
      customerId: elements.estimateCustomer?.value || "",
      customerName: customer?.name || existing?.customerName || "",
      customerCompany: customer?.company || existing?.customerCompany || "",
      fieldId: elements.estimateField?.value || "",
      fieldName: field?.name || existing?.fieldName || "",
      jobType: elements.estimateJobType?.value.trim() || "Custom job",
      equipmentId: elements.estimateEquipment?.value || "",
      implementId: elements.estimateImplement?.value || "",
      operatorId: elements.estimateOperator?.value || "",
      hours: Number(elements.estimateHours?.value || 0),
      distance: Number(elements.estimateDistance?.value || 0),
      distanceUnit,
      fuelType: elements.estimateFuelType?.value || "Diesel",
      fuel: Number(elements.estimateFuel?.value || 0),
      fuelUnit,
      fuelPrice: Number(elements.estimateFuelPrice?.value || 0),
      fuelPriceUnit,
      hourlyRate: Number(elements.estimateHourlyRate?.value || 0),
      distanceRate: Number(elements.estimateDistanceRate?.value || 0),
      materialCost: Number(elements.estimateMaterialCost?.value || 0),
      extraCharges: Number(elements.estimateExtraCharges?.value || 0),
      targetMargin: Number(elements.estimateMargin?.value || 0),
      quoteAmount: Number(elements.estimateQuote?.value || 0),
      notes: elements.estimateNotes?.value.trim() || "",
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      jobId: existing?.jobId || "",
      invoiceId: existing?.invoiceId || ""
    };
  }

  function renderEstimateSummary() {
    if (!elements.estimateSummary) {
      return;
    }

    const estimate = getEstimateFormData(state.editingEstimateId || "preview");
    const calc = calculateEstimate(estimate);
    const quotePlaceholder = calc.suggestedQuote > 0 ? number(calc.suggestedQuote, 2) : "Use suggested quote";
    if (elements.estimateQuote && !elements.estimateQuote.value) {
      elements.estimateQuote.placeholder = quotePlaceholder;
    }

    const profitClass = calc.profit >= 0 ? "estimate-profit-good" : "estimate-profit-warn";
    elements.estimateSummary.innerHTML = `
      <article class="estimate-summary-card"><span>Break-even cost</span><strong>${currency(calc.breakEven)}</strong></article>
      <article class="estimate-summary-card"><span>Suggested quote</span><strong>${currency(calc.suggestedQuote)}</strong></article>
      <article class="estimate-summary-card"><span>Quoted price</span><strong>${currency(calc.quoteAmount)}</strong></article>
      <article class="estimate-summary-card ${profitClass}"><span>Estimated profit</span><strong>${currency(calc.profit)}</strong></article>
      <article class="estimate-summary-card"><span>Profit margin</span><strong>${number(calc.profitMargin, 1)}%</strong></article>
      <article class="estimate-summary-card"><span>Fuel cost</span><strong>${currency(calc.fuelCost)}</strong></article>
    `;
  }

  function renderEstimateSelects() {
    const mode = getModeCopy();
    if (elements.estimateSiteLabel) {
      elements.estimateSiteLabel.textContent = mode.locationLabel;
    }
    if (elements.estimateImplementLabel) {
      elements.estimateImplementLabel.textContent = mode.implementLabel;
    }
    if (elements.estimateDistanceRateLabel) {
      elements.estimateDistanceRateLabel.textContent = `Distance charge per ${unitLabel(elements.estimateDistanceUnit?.value || getPreferredDistanceUnit())}`;
    }

    fillSelect(elements.estimateCustomer, state.customers, isContractingMode() ? "Choose customer" : "Optional customer");
    fillSelect(
      elements.estimateField,
      state.fields.map((field) => ({
        ...field,
        name: `${field.name}${isContractingMode() && getCustomerById(field.customerId) ? ` - ${getCustomerById(field.customerId).name}` : ""}`
      })),
      `Choose ${mode.locationSingular}`
    );
    fillSelect(elements.estimateEquipment, state.equipment, "Choose equipment");
    fillSelect(elements.estimateImplement, state.implements, `Choose ${mode.implementLabel.toLowerCase()}`);
    fillSelect(elements.estimateOperator, state.operators, "Choose operator");

    if (elements.estimateDistanceUnit && !elements.estimateDistanceUnit.value) {
      elements.estimateDistanceUnit.value = getPreferredDistanceUnit();
    }
    if (elements.estimateFuelUnit && !elements.estimateFuelUnit.value) {
      elements.estimateFuelUnit.value = getPreferredFuelUnit();
    }
    if (elements.estimateFuelPriceUnit && !elements.estimateFuelPriceUnit.value) {
      elements.estimateFuelPriceUnit.value = getPreferredFuelUnit();
    }
  }

  function getEstimateNames(estimate) {
    const customer = getCustomerById(estimate.customerId);
    const field = getFieldById(estimate.fieldId);
    const equipment = getEquipmentById(estimate.equipmentId);
    const implement = state.implements.find((item) => item.id === estimate.implementId);
    const operator = state.operators.find((item) => item.id === estimate.operatorId);
    return {
      customerName: customer?.name || estimate.customerName || "No customer selected",
      fieldName: field?.name || estimate.fieldName || "No site selected",
      equipmentName: equipment?.name || "No equipment selected",
      implementName: implement?.name || "No attachment selected",
      operatorName: operator?.name || "No operator selected"
    };
  }

  function renderEstimates() {
    insertEstimateUi();
    renderEstimateSelects();
    renderEstimateSummary();

    if (!elements.estimateList) {
      return;
    }

    elements.saveEstimate.textContent = state.editingEstimateId ? "Update Estimate" : "Save Estimate";
    elements.cancelEstimateEdit.hidden = !state.editingEstimateId;
    elements.estimateList.innerHTML = "";

    if (!state.estimates.length) {
      elements.estimateList.innerHTML = '<div class="empty-state">No estimates saved yet.</div>';
      return;
    }

    [...state.estimates].reverse().forEach((estimate) => {
      const calc = calculateEstimate(estimate);
      const names = getEstimateNames(estimate);
      const actualJob = estimate.jobId
        ? state.jobs.find((job) => job.id === estimate.jobId)
        : state.jobs.find((job) => job.estimateId === estimate.id);
      const actualLine = actualJob
        ? (() => {
          const actual = getJobDetails(actualJob);
          const actualCost = actual.totalCost || actual.cost || 0;
          const actualProfit = calc.quoteAmount - actualCost;
          const actualMargin = calc.quoteAmount > 0 ? (actualProfit / calc.quoteAmount) * 100 : 0;
          return `<p><strong>Estimate vs actual:</strong> Actual cost ${currency(actualCost)} / Profit ${currency(actualProfit)} / Margin ${number(actualMargin, 1)}%</p>`;
        })()
        : '<p class="muted-text">No actual job linked yet.</p>';

      elements.estimateList.insertAdjacentHTML("beforeend", `
        <article class="list-item">
          <div class="list-item-row">
            <div>
              <h3>${escapeHtml(estimate.number || "Estimate")} - ${escapeHtml(estimate.jobType)}</h3>
              <p><span class="estimate-status-pill">${escapeHtml(estimate.status || "draft")}</span></p>
              <p><strong>Customer:</strong> ${escapeHtml(names.customerName)} / <strong>${escapeHtml(getModeCopy().locationLabel)}:</strong> ${escapeHtml(names.fieldName)}</p>
              <p><strong>Equipment:</strong> ${escapeHtml(names.equipmentName)} / <strong>${escapeHtml(getModeCopy().implementLabel)}:</strong> ${escapeHtml(names.implementName)} / <strong>Operator:</strong> ${escapeHtml(names.operatorName)}</p>
              <p><strong>Hours:</strong> ${number(estimate.hours)} / <strong>Distance:</strong> ${number(estimate.distance)} ${unitLabel(estimate.distanceUnit || getPreferredDistanceUnit())} / <strong>Fuel:</strong> ${number(estimate.fuel)} ${unitLabel(estimate.fuelUnit || getPreferredFuelUnit())}</p>
              <p><strong>Break-even:</strong> ${currency(calc.breakEven)} / <strong>Quote:</strong> ${currency(calc.quoteAmount)} / <strong>Profit:</strong> ${currency(calc.profit)} (${number(calc.profitMargin, 1)}%)</p>
              ${actualLine}
              ${estimate.notes ? `<p><strong>Notes:</strong> ${escapeHtml(estimate.notes)}</p>` : ""}
            </div>
            <div class="item-actions estimate-actions">
              <button class="small-button secondary-button" data-convert-estimate-job="${estimate.id}" type="button">Convert to Job</button>
              <button class="small-button secondary-button" data-create-estimate-invoice="${estimate.id}" type="button">Create Invoice</button>
              <button class="small-button secondary-button" data-print-estimate="${estimate.id}" type="button">Print</button>
              <button class="small-button secondary-button" data-edit-estimate="${estimate.id}" type="button">Edit</button>
              <button class="small-button ghost-button" data-delete-estimate="${estimate.id}" type="button">Delete</button>
            </div>
          </div>
        </article>
      `);
    });
  }

  function clearEstimateForm() {
    state.editingEstimateId = null;
    elements.estimateForm?.reset();
    if (elements.estimateMargin) {
      elements.estimateMargin.value = "30";
    }
    if (elements.estimateDistanceUnit) {
      elements.estimateDistanceUnit.value = getPreferredDistanceUnit();
    }
    if (elements.estimateFuelUnit) {
      elements.estimateFuelUnit.value = getPreferredFuelUnit();
    }
    if (elements.estimateFuelPriceUnit) {
      elements.estimateFuelPriceUnit.value = getPreferredFuelUnit();
    }
    renderEstimates();
    showEstimateMessage("");
  }

  function setEstimateFormValues(estimate) {
    state.editingEstimateId = estimate.id;
    switchTab("estimates");
    renderEstimates();
    elements.estimateCustomer.value = estimate.customerId || "";
    elements.estimateField.value = estimate.fieldId || "";
    elements.estimateJobType.value = estimate.jobType || "";
    elements.estimateNumber.value = estimate.number || "";
    elements.estimateEquipment.value = estimate.equipmentId || "";
    elements.estimateImplement.value = estimate.implementId || "";
    elements.estimateOperator.value = estimate.operatorId || "";
    elements.estimateHours.value = estimate.hours || "";
    elements.estimateDistance.value = estimate.distance || "";
    elements.estimateDistanceUnit.value = estimate.distanceUnit || getPreferredDistanceUnit();
    elements.estimateFuelType.value = estimate.fuelType || "Diesel";
    elements.estimateFuel.value = estimate.fuel || "";
    elements.estimateFuelUnit.value = estimate.fuelUnit || getPreferredFuelUnit();
    elements.estimateFuelPrice.value = estimate.fuelPrice || "";
    elements.estimateFuelPriceUnit.value = estimate.fuelPriceUnit || getPreferredFuelUnit();
    elements.estimateHourlyRate.value = estimate.hourlyRate || "";
    elements.estimateDistanceRate.value = estimate.distanceRate || "";
    elements.estimateMaterialCost.value = estimate.materialCost || "";
    elements.estimateExtraCharges.value = estimate.extraCharges || "";
    elements.estimateMargin.value = estimate.targetMargin || "30";
    elements.estimateQuote.value = estimate.quoteAmount || "";
    elements.estimateNotes.value = estimate.notes || "";
    renderEstimateSummary();
    elements.estimateJobType.focus();
  }

  function convertEstimateToJob(estimate) {
    const calc = calculateEstimate(estimate);
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + Math.max(1, Number(estimate.hours || 1)) * 60 * 60 * 1000);
    state.pendingEstimateIdForJob = estimate.id;

    switchTab("jobs");
    renderAll();

    elements.jobField.value = estimate.fieldId || "";
    elements.jobEquipment.value = estimate.equipmentId || "";
    elements.jobImplement.value = estimate.implementId || "";
    elements.jobOperator.value = estimate.operatorId || "";
    if (estimate.jobType && ![...elements.jobType.options].some((option) => option.value === estimate.jobType || option.textContent === estimate.jobType)) {
      const option = document.createElement("option");
      option.value = estimate.jobType;
      option.textContent = estimate.jobType;
      elements.jobType.appendChild(option);
    }
    elements.jobType.value = estimate.jobType || "Custom job";
    elements.jobStart.value = toDateTimeLocal(startDate);
    elements.jobEnd.value = toDateTimeLocal(endDate);
    document.querySelector("#job-acres").value = "";
    elements.jobDistance.value = estimate.distance || "";
    elements.jobDistanceUnit.value = estimate.distanceUnit || getPreferredDistanceUnit();
    document.querySelector("#job-fuel").value = estimate.fuel || "";
    elements.jobFuelUnit.value = estimate.fuelUnit || getPreferredFuelUnit();
    document.querySelector("#job-cost-hour").value = estimate.hourlyRate || "";
    elements.jobCostDistance.value = estimate.distanceRate || "";
    document.querySelector("#job-notes").value = [
      `Converted from ${estimate.number || "estimate"}. Quoted ${currency(calc.quoteAmount)}. Break-even ${currency(calc.breakEven)}.`,
      estimate.notes || ""
    ].filter(Boolean).join("\n");

    if (elements.jobFuelPrice) {
      elements.jobFuelPrice.value = estimate.fuelPrice || "";
      elements.jobFuelPriceUnit.value = estimate.fuelPriceUnit || getPreferredFuelUnit();
      if (typeof updateFuelPriceHint === "function") {
        updateFuelPriceHint();
      }
    }

    showMessage("Estimate loaded into the job form. Adjust actual acres, fuel, time, and notes before saving.", "success");
  }

  function createInvoiceFromEstimate(estimate) {
    const calc = calculateEstimate(estimate);
    const customer = getCustomerById(estimate.customerId);
    const names = getEstimateNames(estimate);
    const invoice = {
      id: id(),
      number: typeof nextInvoiceNumber === "function" ? nextInvoiceNumber() : `TT-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
      customerId: estimate.customerId || "",
      customerName: customer?.name || estimate.customerName || "Estimate customer",
      company: customer?.company || estimate.customerCompany || "",
      address: customer?.address || "",
      email: customer?.email || "",
      jobIds: [],
      hourlyRate: Number(estimate.hourlyRate || 0),
      distanceRate: Number(estimate.distanceRate || 0),
      distanceUnit: estimate.distanceUnit || getPreferredDistanceUnit(),
      loadRate: 0,
      materialCharge: Number(estimate.materialCost || 0),
      equipmentCharge: 0,
      taxRate: 0,
      subtotal: calc.quoteAmount,
      tax: 0,
      total: calc.quoteAmount,
      paid: false,
      estimateId: estimate.id,
      lineItems: [{
        description: `${estimate.number || "Estimate"}: ${estimate.jobType} - ${names.fieldName}`,
        amount: calc.quoteAmount
      }]
    };

    state.invoices.push(invoice);
    state.estimates = state.estimates.map((item) => item.id === estimate.id ? {
      ...item,
      status: "invoiced",
      invoiceId: invoice.id,
      updatedAt: new Date().toISOString()
    } : item);
    persist("invoices");
    persist("estimates");
    renderAll();
    switchTab("reports");
    if (typeof showInvoiceMessage === "function") {
      showInvoiceMessage(`Invoice ${invoice.number} created from ${estimate.number || "estimate"}.`, "success");
    }
  }

  function printEstimate(estimate) {
    const calc = calculateEstimate(estimate);
    const names = getEstimateNames(estimate);
    const businessName = state.settings.businessName || "Tractor Tracker";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showEstimateMessage("Allow popups to print this estimate.", "error");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(estimate.number || "Estimate")}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #20241e; }
            header { border-bottom: 3px solid #315f36; padding-bottom: 16px; margin-bottom: 24px; }
            h1, h2, h3 { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px solid #d8ddcf; padding: 10px; text-align: left; }
            .total { font-size: 1.25rem; font-weight: 700; }
            .muted { color: #5b6354; }
          </style>
        </head>
        <body>
          <header>
            <h1>${escapeHtml(businessName)}</h1>
            <h2>Estimate ${escapeHtml(estimate.number || "")}</h2>
            <p class="muted">Created ${new Date(estimate.createdAt || Date.now()).toLocaleDateString()}</p>
          </header>
          <section>
            <h3>Customer</h3>
            <p>${escapeHtml(names.customerName)}${estimate.customerCompany ? ` / ${escapeHtml(estimate.customerCompany)}` : ""}</p>
            <p><strong>Job:</strong> ${escapeHtml(estimate.jobType)} at ${escapeHtml(names.fieldName)}</p>
          </section>
          <table>
            <tr><th>Description</th><th>Amount</th></tr>
            <tr><td>Estimated hours (${number(estimate.hours)} × ${currency(estimate.hourlyRate || 0)})</td><td>${currency(calc.hourlyCost)}</td></tr>
            <tr><td>Distance (${number(estimate.distance)} ${unitLabel(estimate.distanceUnit || getPreferredDistanceUnit())} × ${currency(estimate.distanceRate || 0)})</td><td>${currency(calc.distanceCost)}</td></tr>
            <tr><td>Fuel (${number(estimate.fuel)} ${unitLabel(estimate.fuelUnit || getPreferredFuelUnit())} ${escapeHtml(estimate.fuelType || "Fuel")})</td><td>${currency(calc.fuelCost)}</td></tr>
            <tr><td>Material</td><td>${currency(calc.materialCost)}</td></tr>
            <tr><td>Extra charges</td><td>${currency(calc.extraCharges)}</td></tr>
            <tr><td class="total">Quoted price</td><td class="total">${currency(calc.quoteAmount)}</td></tr>
          </table>
          ${estimate.notes ? `<section><h3>Notes</h3><p>${escapeHtml(estimate.notes).replaceAll("\n", "<br>")}</p></section>` : ""}
          <p class="muted">Estimate generated by Tractor Tracker. Final invoice may change if actual hours, fuel, materials, or scope changes.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const originalGetJobFormData = getJobFormData;
  getJobFormData = function patchedEstimateJobFormData(jobId = id()) {
    const job = originalGetJobFormData(jobId);
    if (state.pendingEstimateIdForJob) {
      job.estimateId = state.pendingEstimateIdForJob;
    }
    return job;
  };

  const originalGetBackupData = getBackupData;
  getBackupData = function patchedEstimateBackupData() {
    return {
      ...originalGetBackupData(),
      estimates: state.estimates
    };
  };

  const originalNormalizeRestoredBackup = normalizeRestoredBackup;
  normalizeRestoredBackup = function patchedEstimateNormalizeRestoredBackup(parsedBackup) {
    const normalized = originalNormalizeRestoredBackup(parsedBackup);
    const restoredData = parsedBackup?.data || parsedBackup || {};
    return {
      ...normalized,
      estimates: Array.isArray(restoredData.estimates) ? restoredData.estimates : []
    };
  };

  const originalRestoreFarmBackup = restoreFarmBackup;
  restoreFarmBackup = function patchedEstimateRestoreFarmBackup(restoredData, options = {}) {
    const estimates = Array.isArray(restoredData.estimates) ? restoredData.estimates : [];
    originalRestoreFarmBackup(restoredData, options);
    state.estimates = estimates;
    saveData(ESTIMATE_KEY, state.estimates);
    renderEstimates();
  };

  const originalClearLocalFarmDataAfterDeletion = clearLocalFarmDataAfterDeletion;
  clearLocalFarmDataAfterDeletion = function patchedEstimateClearLocalFarmDataAfterDeletion() {
    originalClearLocalFarmDataAfterDeletion();
    state.estimates = [];
    saveData(ESTIMATE_KEY, state.estimates);
  };

  const originalRenderAll = renderAll;
  renderAll = function patchedEstimateRenderAll() {
    originalRenderAll();
    renderEstimates();
  };

  function bindEstimateEvents() {
    elements.estimateForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const estimate = getEstimateFormData(state.editingEstimateId || id());
      if (state.editingEstimateId) {
        state.estimates = state.estimates.map((item) => item.id === state.editingEstimateId ? estimate : item);
      } else {
        state.estimates.push(estimate);
      }
      state.editingEstimateId = null;
      persist("estimates");
      clearEstimateForm();
      renderAll();
      showEstimateMessage(`${estimate.number} saved.`, "success");
    });

    elements.cancelEstimateEdit?.addEventListener("click", clearEstimateForm);
    elements.clearEstimateForm?.addEventListener("click", clearEstimateForm);

    elements.estimateForm?.addEventListener("input", renderEstimateSummary);
    elements.estimateDistanceUnit?.addEventListener("change", () => {
      renderEstimateSelects();
      renderEstimateSummary();
    });

    elements.jobForm?.addEventListener("submit", () => {
      const estimateId = state.pendingEstimateIdForJob;
      if (!estimateId) {
        return;
      }
      window.setTimeout(() => {
        const linkedJob = [...state.jobs].reverse().find((job) => job.estimateId === estimateId);
        if (!linkedJob) {
          return;
        }
        state.estimates = state.estimates.map((estimate) => estimate.id === estimateId ? {
          ...estimate,
          status: "converted",
          jobId: linkedJob.id,
          updatedAt: new Date().toISOString()
        } : estimate);
        state.pendingEstimateIdForJob = null;
        persist("estimates");
        renderAll();
      }, 50);
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.editEstimate) {
      const estimate = getEstimateById(button.dataset.editEstimate);
      if (estimate) {
        setEstimateFormValues(estimate);
        showEstimateMessage("Editing estimate.", "success");
      }
    }

    if (button.dataset.deleteEstimate) {
      if (window.confirm("Delete this estimate?")) {
        state.estimates = state.estimates.filter((estimate) => estimate.id !== button.dataset.deleteEstimate);
        state.editingEstimateId = state.editingEstimateId === button.dataset.deleteEstimate ? null : state.editingEstimateId;
        persist("estimates");
        renderAll();
      }
    }

    if (button.dataset.convertEstimateJob) {
      const estimate = getEstimateById(button.dataset.convertEstimateJob);
      if (estimate) {
        convertEstimateToJob(estimate);
      }
    }

    if (button.dataset.createEstimateInvoice) {
      const estimate = getEstimateById(button.dataset.createEstimateInvoice);
      if (estimate) {
        createInvoiceFromEstimate(estimate);
      }
    }

    if (button.dataset.printEstimate) {
      const estimate = getEstimateById(button.dataset.printEstimate);
      if (estimate) {
        printEstimate(estimate);
      }
    }
  });

  insertEstimateUi();
  bindEstimateEvents();
  renderAll();
})();