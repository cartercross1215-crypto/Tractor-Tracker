/* Tractor Tracker local fuel price add-on */
(() => {
  if (window.__tractorFuelPricesInstalled) {
    return;
  }
  window.__tractorFuelPricesInstalled = true;

  const FUEL_PRICE_KEY = "tractor-tracker-fuel-prices-v1";
  STORAGE_KEYS.fuelPrices = FUEL_PRICE_KEY;
  state.fuelPrices = Array.isArray(state.fuelPrices) ? state.fuelPrices : loadData(FUEL_PRICE_KEY, []);
  state.editingFuelPriceId = state.editingFuelPriceId || null;

  function insertFuelPriceUi() {
    const fieldList = document.querySelector("#field-list");
    if (fieldList && !document.querySelector("#fuel-price-form")) {
      fieldList.insertAdjacentHTML("afterend", `
        <section class="sub-panel fuel-price-panel">
          <h2>Local Fuel Prices</h2>
          <p class="muted-text">Save prices by town, supplier, cardlock, co-op, or job area. Jobs can pull the saved price into fuel cost calculations.</p>
          <form id="fuel-price-form" class="form-grid compact-form">
            <label>Area or supplier<input id="fuel-price-area" type="text" placeholder="Local diesel stop" required /></label>
            <label>Fuel type<select id="fuel-price-type">
              <option>Diesel</option>
              <option>Off-road diesel</option>
              <option>Gasoline</option>
              <option>DEF</option>
              <option>Other</option>
            </select></label>
            <label>Price<input id="fuel-price-value" type="number" min="0" step="0.001" placeholder="3.899" required /></label>
            <label>Price unit<select id="fuel-price-unit">
              <option value="gal">per gallon</option>
              <option value="l">per liter</option>
            </select></label>
            <label class="full-width">Notes<input id="fuel-price-notes" type="text" placeholder="Station, county, tax status, or updated date" /></label>
            <div class="form-actions full-width">
              <button id="save-fuel-price" type="submit">Add Fuel Price</button>
              <button id="cancel-fuel-price-edit" type="button" class="secondary-button" hidden>Cancel Edit</button>
            </div>
          </form>
          <div id="fuel-price-list" class="list"></div>
        </section>
      `);
    }

    const fuelUnitLabel = document.querySelector("#job-fuel-unit")?.closest("label");
    if (fuelUnitLabel && !document.querySelector("#job-fuel-price-area")) {
      fuelUnitLabel.insertAdjacentHTML("afterend", `
        <label>Fuel price area<select id="job-fuel-price-area"></select></label>
        <label>Fuel price<input id="job-fuel-price" type="number" min="0" step="0.001" placeholder="Optional" /></label>
        <label>Fuel price unit<select id="job-fuel-price-unit">
          <option value="gal">per gallon</option>
          <option value="l">per liter</option>
        </select></label>
        <p id="job-fuel-price-hint" class="muted-text full-width">Choose a saved local price or enter a one-time fuel price for this job.</p>
      `);
    }

    Object.assign(elements, {
      fuelPriceForm: document.querySelector("#fuel-price-form"),
      fuelPriceList: document.querySelector("#fuel-price-list"),
      saveFuelPrice: document.querySelector("#save-fuel-price"),
      cancelFuelPriceEdit: document.querySelector("#cancel-fuel-price-edit"),
      jobFuelPriceArea: document.querySelector("#job-fuel-price-area"),
      jobFuelPrice: document.querySelector("#job-fuel-price"),
      jobFuelPriceUnit: document.querySelector("#job-fuel-price-unit"),
      jobFuelPriceHint: document.querySelector("#job-fuel-price-hint")
    });
  }

  function getFuelPriceById(fuelPriceId) {
    return state.fuelPrices.find((item) => item.id === fuelPriceId);
  }

  function formatFuelPriceRecord(fuelPrice) {
    if (!fuelPrice) {
      return "Manual price";
    }
    return `${fuelPrice.areaName} - ${fuelPrice.fuelType} (${currency(fuelPrice.price)}/${unitLabel(fuelPrice.priceUnit || getPreferredFuelUnit())})`;
  }

  function fuelAmountInUnit(value, fromUnit, toUnit) {
    const gallons = fuelToGallons(value, fromUnit || "gal");
    return toUnit === "l" ? gallonsToFuel(gallons, "l") : gallons;
  }

  function getJobFuelPrice(job) {
    const manualPrice = Number(job.fuelPrice || 0);
    if (manualPrice > 0) {
      return {
        price: manualPrice,
        priceUnit: job.fuelPriceUnit || job.fuelUnit || getPreferredFuelUnit(),
        areaName: job.fuelPriceAreaName || "Manual price",
        fuelType: job.fuelType || "Fuel"
      };
    }

    const savedPrice = getFuelPriceById(job.fuelPriceAreaId);
    if (!savedPrice) {
      return null;
    }

    return {
      price: Number(savedPrice.price || 0),
      priceUnit: savedPrice.priceUnit || getPreferredFuelUnit(),
      areaName: savedPrice.areaName,
      fuelType: savedPrice.fuelType
    };
  }

  function getJobFuelCost(job) {
    const fuelPrice = getJobFuelPrice(job);
    if (!fuelPrice?.price) {
      return 0;
    }

    const fuelAmount = fuelAmountInUnit(job.fuel, job.fuelUnit || getPreferredFuelUnit(), fuelPrice.priceUnit || getPreferredFuelUnit());
    return fuelAmount * Number(fuelPrice.price || 0);
  }

  function updateFuelPriceHint() {
    if (!elements.jobFuelPriceHint) {
      return;
    }

    const savedPrice = getFuelPriceById(elements.jobFuelPriceArea?.value);
    if (!savedPrice) {
      const manualPrice = Number(elements.jobFuelPrice?.value || 0);
      const manualUnit = elements.jobFuelPriceUnit?.value || getPreferredFuelUnit();
      const fuelAmount = Number(document.querySelector("#job-fuel")?.value || 0);
      const fuelUnit = elements.jobFuelUnit?.value || getPreferredFuelUnit();
      const manualCost = manualPrice > 0 ? fuelAmountInUnit(fuelAmount, fuelUnit, manualUnit) * manualPrice : 0;
      elements.jobFuelPriceHint.textContent = manualCost > 0
        ? `Manual fuel estimate: ${currency(manualCost)}`
        : "Choose a saved local price or enter a one-time fuel price for this job.";
      return;
    }

    const jobFuel = Number(document.querySelector("#job-fuel")?.value || 0);
    const jobFuelUnit = elements.jobFuelUnit?.value || getPreferredFuelUnit();
    const estimatedCost = getJobFuelCost({
      fuel: jobFuel,
      fuelUnit: jobFuelUnit,
      fuelPriceAreaId: savedPrice.id,
      fuelPrice: elements.jobFuelPrice?.value || savedPrice.price,
      fuelPriceUnit: elements.jobFuelPriceUnit?.value || savedPrice.priceUnit
    });
    elements.jobFuelPriceHint.textContent = `${formatFuelPriceRecord(savedPrice)}${jobFuel > 0 ? ` - estimated fuel cost ${currency(estimatedCost)}` : ""}`;
  }

  function applyFuelPriceSelection() {
    const savedPrice = getFuelPriceById(elements.jobFuelPriceArea?.value);
    if (!savedPrice) {
      updateFuelPriceHint();
      return;
    }
    elements.jobFuelPrice.value = savedPrice.price || "";
    elements.jobFuelPriceUnit.value = savedPrice.priceUnit || getPreferredFuelUnit();
    updateFuelPriceHint();
  }

  function renderFuelPrices() {
    insertFuelPriceUi();

    if (!elements.fuelPriceList || !elements.jobFuelPriceArea) {
      return;
    }

    const currentSelection = elements.jobFuelPriceArea.value;
    elements.jobFuelPriceArea.innerHTML = '<option value="">Manual / no saved area</option>';
    state.fuelPrices.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = formatFuelPriceRecord(item);
      elements.jobFuelPriceArea.appendChild(option);
    });
    if (currentSelection) {
      elements.jobFuelPriceArea.value = currentSelection;
    }

    if (elements.saveFuelPrice) {
      elements.saveFuelPrice.textContent = state.editingFuelPriceId ? "Update Fuel Price" : "Add Fuel Price";
    }
    if (elements.cancelFuelPriceEdit) {
      elements.cancelFuelPriceEdit.hidden = !state.editingFuelPriceId;
    }

    elements.fuelPriceList.innerHTML = "";
    if (!state.fuelPrices.length) {
      elements.fuelPriceList.innerHTML = '<div class="empty-state">No local fuel prices saved yet.</div>';
      updateFuelPriceHint();
      return;
    }

    state.fuelPrices.forEach((fuelPrice) => {
      elements.fuelPriceList.insertAdjacentHTML("beforeend", `
        <article class="list-item">
          <div class="list-item-row">
            <div>
              <h3>${escapeHtml(fuelPrice.areaName)}</h3>
              <p><strong>Fuel:</strong> ${escapeHtml(fuelPrice.fuelType)} / <strong>Price:</strong> ${currency(fuelPrice.price)}/${unitLabel(fuelPrice.priceUnit || getPreferredFuelUnit())}</p>
              ${fuelPrice.notes ? `<p>${escapeHtml(fuelPrice.notes)}</p>` : ""}
              <p class="muted-text">Updated ${dateTime(fuelPrice.updatedAt || fuelPrice.createdAt || new Date().toISOString())}</p>
            </div>
            <div class="item-actions">
              <button class="small-button secondary-button" data-edit-fuel-price="${fuelPrice.id}" type="button">Edit</button>
              <button class="small-button ghost-button" data-delete-fuel-price="${fuelPrice.id}" type="button">Delete</button>
            </div>
          </div>
        </article>
      `);
    });

    updateFuelPriceHint();
  }

  const originalGetJobFormData = getJobFormData;
  getJobFormData = function patchedGetJobFormData(jobId = id()) {
    const job = originalGetJobFormData(jobId);
    const savedPrice = getFuelPriceById(elements.jobFuelPriceArea?.value);
    return {
      ...job,
      fuelPriceAreaId: elements.jobFuelPriceArea?.value || "",
      fuelPriceAreaName: savedPrice?.areaName || "",
      fuelType: savedPrice?.fuelType || "",
      fuelPrice: Number(elements.jobFuelPrice?.value || 0),
      fuelPriceUnit: elements.jobFuelPriceUnit?.value || getPreferredFuelUnit()
    };
  };

  const originalGetJobDetails = getJobDetails;
  getJobDetails = function patchedGetJobDetails(job) {
    const details = originalGetJobDetails(job);
    const fuelCost = getJobFuelCost(job);
    const totalCost = Number(details.cost || 0) + fuelCost;
    return {
      ...details,
      fuelCost,
      totalCost,
      fuelCostPerAcre: job.acres > 0 ? fuelCost / job.acres : 0,
      totalCostPerAcre: job.acres > 0 ? totalCost / job.acres : 0,
      fuelCostPerMile: details.distanceMiles > 0 ? fuelCost / details.distanceMiles : 0,
      totalCostPerMile: details.distanceMiles > 0 ? totalCost / details.distanceMiles : 0,
      fuelCostPerKm: details.distanceKm > 0 ? fuelCost / details.distanceKm : 0,
      totalCostPerKm: details.distanceKm > 0 ? totalCost / details.distanceKm : 0
    };
  };

  getTotals = function patchedGetTotals() {
    return state.jobs.reduce((totals, job) => {
      const details = getJobDetails(job);
      totals.acres += Number(job.acres || 0);
      totals.fuel += details.fuelGallons;
      totals.distanceMiles += details.distanceMiles;
      totals.hours += details.duration;
      totals.cost += details.cost;
      totals.fuelCost += details.fuelCost;
      totals.totalCost += details.totalCost;
      totals.loads += Number(job.loads || 0);
      return totals;
    }, { acres: 0, fuel: 0, distanceMiles: 0, hours: 0, cost: 0, fuelCost: 0, totalCost: 0, loads: 0 });
  };

  getWeeklyTotals = function patchedGetWeeklyTotals() {
    return state.jobs
      .filter((job) => isThisWeek(job.end || job.start))
      .reduce((totals, job) => {
        const details = getJobDetails(job);
        totals.acres += Number(job.acres || 0);
        totals.fuel += details.fuelGallons;
        totals.distanceMiles += details.distanceMiles;
        totals.hours += details.duration;
        totals.cost += details.cost;
        totals.fuelCost += details.fuelCost;
        totals.totalCost += details.totalCost;
        totals.loads += Number(job.loads || 0);
        return totals;
      }, { acres: 0, fuel: 0, distanceMiles: 0, hours: 0, cost: 0, fuelCost: 0, totalCost: 0, loads: 0 });
  };

  const originalRenderJobs = renderJobs;
  renderJobs = function patchedRenderJobs() {
    originalRenderJobs();
    document.querySelectorAll("[data-edit-job]").forEach((button) => {
      const job = state.jobs.find((item) => item.id === button.dataset.editJob);
      const article = button.closest(".list-item");
      const content = article?.querySelector(".list-item-row > div");
      if (!job || !content || content.querySelector(".fuel-cost-line")) {
        return;
      }
      const details = getJobDetails(job);
      if (!details.fuelCost) {
        return;
      }
      const fuelPrice = getJobFuelPrice(job);
      content.insertAdjacentHTML("beforeend", `<p class="fuel-cost-line"><strong>Fuel cost:</strong> ${currency(details.fuelCost)}${fuelPrice ? ` / <strong>Price:</strong> ${currency(fuelPrice.price)}/${unitLabel(fuelPrice.priceUnit)}${fuelPrice.areaName ? ` at ${escapeHtml(fuelPrice.areaName)}` : ""}` : ""}</p>`);
    });
  };

  const originalRenderReports = renderReports;
  renderReports = function patchedRenderReports() {
    originalRenderReports();
    const totals = getTotals();
    if (!elements.reportGrid || elements.reportGrid.querySelector(".fuel-price-report-card")) {
      return;
    }
    const displayDistance = milesToDistance(totals.distanceMiles);
    const fuelCostPerDistance = displayDistance > 0 ? totals.fuelCost / displayDistance : 0;
    const fuelCostPerAcre = totals.acres > 0 ? totals.fuelCost / totals.acres : 0;
    elements.reportGrid.insertAdjacentHTML("beforeend", `
      <article class="report-card fuel-price-report-card"><span>Fuel cost</span><strong>${currency(totals.fuelCost)}</strong></article>
      <article class="report-card fuel-price-report-card"><span>Total estimated cost</span><strong>${currency(totals.totalCost)}</strong></article>
      <article class="report-card fuel-price-report-card"><span>${isContractingMode() ? `Fuel cost per ${unitLabel(getPreferredDistanceUnit())}` : "Fuel cost per acre"}</span><strong>${currency(isContractingMode() ? fuelCostPerDistance : fuelCostPerAcre)}</strong></article>
    `);
  };

  const originalRenderDashboardSnapshot = renderDashboardSnapshot;
  renderDashboardSnapshot = function patchedRenderDashboardSnapshot() {
    originalRenderDashboardSnapshot();
    const weekly = getWeeklyTotals();
    if (!elements.dashboardSnapshot || elements.dashboardSnapshot.querySelector(".fuel-cost-dashboard-card")) {
      return;
    }
    elements.dashboardSnapshot.insertAdjacentHTML("beforeend", `<article class="dashboard-card fuel-cost-dashboard-card"><span>Fuel cost this week</span><strong>${currency(weekly.fuelCost)}</strong></article>`);
  };

  const originalGetBackupData = getBackupData;
  getBackupData = function patchedGetBackupData() {
    return {
      ...originalGetBackupData(),
      fuelPrices: state.fuelPrices
    };
  };

  const originalNormalizeRestoredBackup = normalizeRestoredBackup;
  normalizeRestoredBackup = function patchedNormalizeRestoredBackup(parsedBackup) {
    const normalized = originalNormalizeRestoredBackup(parsedBackup);
    const restoredData = parsedBackup?.data || parsedBackup || {};
    return {
      ...normalized,
      fuelPrices: Array.isArray(restoredData.fuelPrices) ? restoredData.fuelPrices : []
    };
  };

  const originalRestoreFarmBackup = restoreFarmBackup;
  restoreFarmBackup = function patchedRestoreFarmBackup(restoredData, options = {}) {
    const fuelPrices = Array.isArray(restoredData.fuelPrices) ? restoredData.fuelPrices : [];
    originalRestoreFarmBackup(restoredData, options);
    state.fuelPrices = fuelPrices;
    saveData(FUEL_PRICE_KEY, state.fuelPrices);
    renderFuelPrices();
  };

  const originalClearEditState = clearEditState;
  clearEditState = function patchedClearEditState() {
    originalClearEditState();
    state.editingFuelPriceId = null;
    elements.fuelPriceForm?.reset();
  };

  const originalClearLocalFarmDataAfterDeletion = clearLocalFarmDataAfterDeletion;
  clearLocalFarmDataAfterDeletion = function patchedClearLocalFarmDataAfterDeletion() {
    originalClearLocalFarmDataAfterDeletion();
    state.fuelPrices = [];
    saveData(FUEL_PRICE_KEY, state.fuelPrices);
  };

  const originalRenderAll = renderAll;
  renderAll = function patchedRenderAll() {
    originalRenderAll();
    renderFuelPrices();
  };

  function bindFuelPriceEvents() {
    elements.fuelPriceForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const fuelPrice = {
        id: state.editingFuelPriceId || id(),
        areaName: document.querySelector("#fuel-price-area").value.trim(),
        fuelType: document.querySelector("#fuel-price-type").value,
        price: Number(document.querySelector("#fuel-price-value").value || 0),
        priceUnit: document.querySelector("#fuel-price-unit").value || getPreferredFuelUnit(),
        notes: document.querySelector("#fuel-price-notes").value.trim(),
        createdAt: getFuelPriceById(state.editingFuelPriceId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (state.editingFuelPriceId) {
        state.fuelPrices = state.fuelPrices.map((item) => item.id === state.editingFuelPriceId ? fuelPrice : item);
        state.editingFuelPriceId = null;
      } else {
        state.fuelPrices.push(fuelPrice);
      }

      persist("fuelPrices");
      elements.fuelPriceForm.reset();
      renderAll();
      showMessage("Fuel price saved.", "success");
    });

    elements.cancelFuelPriceEdit?.addEventListener("click", () => {
      state.editingFuelPriceId = null;
      elements.fuelPriceForm.reset();
      renderAll();
    });

    elements.jobFuelPriceArea?.addEventListener("change", applyFuelPriceSelection);
    elements.jobFuelPrice?.addEventListener("input", updateFuelPriceHint);
    elements.jobFuelPriceUnit?.addEventListener("change", updateFuelPriceHint);
    elements.jobFuelUnit?.addEventListener("change", updateFuelPriceHint);
    document.querySelector("#job-fuel")?.addEventListener("input", updateFuelPriceHint);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.deleteFuelPrice) {
      if (window.confirm("Delete this saved fuel price? Existing jobs keep their copied price.")) {
        state.fuelPrices = state.fuelPrices.filter((item) => item.id !== button.dataset.deleteFuelPrice);
        state.editingFuelPriceId = state.editingFuelPriceId === button.dataset.deleteFuelPrice ? null : state.editingFuelPriceId;
        persist("fuelPrices");
        renderAll();
      }
    }

    if (button.dataset.editFuelPrice) {
      const fuelPrice = getFuelPriceById(button.dataset.editFuelPrice);
      if (fuelPrice) {
        state.editingFuelPriceId = fuelPrice.id;
        switchTab("records");
        renderAll();
        document.querySelector("#fuel-price-area").value = fuelPrice.areaName;
        document.querySelector("#fuel-price-type").value = fuelPrice.fuelType;
        document.querySelector("#fuel-price-value").value = fuelPrice.price;
        document.querySelector("#fuel-price-unit").value = fuelPrice.priceUnit || getPreferredFuelUnit();
        document.querySelector("#fuel-price-notes").value = fuelPrice.notes || "";
        document.querySelector("#fuel-price-area").focus();
      }
    }

    if (button.dataset.editJob) {
      const job = state.jobs.find((item) => item.id === button.dataset.editJob);
      if (job && elements.jobFuelPriceArea) {
        elements.jobFuelPriceArea.value = job.fuelPriceAreaId || "";
        elements.jobFuelPrice.value = job.fuelPrice || "";
        elements.jobFuelPriceUnit.value = job.fuelPriceUnit || getPreferredFuelUnit();
        updateFuelPriceHint();
      }
    }
  });

  insertFuelPriceUi();
  bindFuelPriceEvents();
  renderAll();
})();
