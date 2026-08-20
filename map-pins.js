/* Tractor Tracker field and job-site map pins add-on */
(() => {
  if (window.__tractorMapPinsInstalled) {
    return;
  }
  window.__tractorMapPinsInstalled = true;

  function appMode() {
    return document.body?.dataset?.appMode || state.settings?.mode || state.appMode || "farm";
  }

  function isContracting() {
    return appMode() === "contracting";
  }

  function siteLabel(plural = false) {
    if (isContracting()) {
      return plural ? "job sites" : "job site";
    }
    return plural ? "fields" : "field";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function formatNumber(value, digits = 2) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) {
      return "0";
    }
    return number.toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    });
  }

  function formatCurrency(value) {
    const code = state.settings?.currencyCode || "USD";
    const number = Number(value || 0);
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: 0
      }).format(number);
    } catch (error) {
      return `$${formatNumber(number, 0)}`;
    }
  }

  function parseCoordinate(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getPin(record) {
    const latitude = parseCoordinate(record.latitude ?? record.pinLatitude ?? record.pinLat ?? record.lat);
    const longitude = parseCoordinate(record.longitude ?? record.pinLongitude ?? record.pinLng ?? record.lng);
    if (latitude === null || longitude === null) {
      return null;
    }
    return { latitude, longitude };
  }

  function hasPin(record) {
    return Boolean(getPin(record));
  }

  function fieldById(fieldId) {
    return (state.fields || []).find((field) => field.id === fieldId);
  }

  function jobsForField(fieldId) {
    return (state.jobs || []).filter((job) => job.fieldId === fieldId);
  }

  function estimateForField(fieldId) {
    return (state.estimates || []).find((estimate) => estimate.fieldId === fieldId);
  }

  function activeSeasonForField(fieldId) {
    const seasons = state.fieldSeasons || state.seasons || state.fieldSeasonPlans || [];
    return seasons
      .filter((season) => season.fieldId === fieldId)
      .sort((a, b) => Number(b.year || b.seasonYear || 0) - Number(a.year || a.seasonYear || 0))[0];
  }

  function jobDateValue(job) {
    return job.endTime || job.startTime || job.date || job.createdAt || "";
  }

  function latestJob(jobs) {
    return [...jobs].sort((a, b) => new Date(jobDateValue(b)).getTime() - new Date(jobDateValue(a)).getTime())[0];
  }

  function fuelAmount(job) {
    return Number(job.fuel || job.fuelUsed || job.fuelAmount || job.gallons || 0);
  }

  function jobCost(job) {
    return Number(
      job.totalCost ||
      job.totalCharge ||
      job.estimatedCost ||
      job.fuelCost ||
      job.cost ||
      0
    );
  }

  function fieldSummary(field) {
    const jobs = jobsForField(field.id);
    const lastJob = latestJob(jobs);
    const fuel = jobs.reduce((sum, job) => sum + fuelAmount(job), 0);
    const totalCost = jobs.reduce((sum, job) => sum + jobCost(job), 0);
    const acres = Number(field.acres || field.area || 0);
    const season = activeSeasonForField(field.id);
    const estimate = estimateForField(field.id);

    return {
      jobs,
      lastJob,
      fuel,
      totalCost,
      acres,
      season,
      estimate,
      costPerAcre: acres ? totalCost / acres : 0,
      fuelPerAcre: acres ? fuel / acres : 0
    };
  }

  function saveFields() {
    if (typeof saveData === "function" && STORAGE_KEYS?.fields) {
      saveData(STORAGE_KEYS.fields, state.fields || []);
    }
    if (typeof queueCloudSync === "function") {
      queueCloudSync();
    } else if (typeof scheduleSync === "function") {
      scheduleSync();
    } else if (typeof syncToCloud === "function") {
      syncToCloud();
    }
  }

  function switchToTab(tabName) {
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) {
      tab.click();
      return;
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const active = panel.id === tabName;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  }

  function insertStyles() {
    if (document.querySelector("#map-pins-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "map-pins-styles";
    style.textContent = `
      .map-pin-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: end;
        margin: 14px 0;
      }
      .map-pin-toolbar label {
        flex: 1 1 240px;
      }
      .map-pin-stage {
        position: relative;
        min-height: 340px;
        border-radius: 22px;
        overflow: hidden;
        border: 1px solid rgba(49, 95, 54, 0.18);
        background:
          linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px),
          linear-gradient(0deg, rgba(255,255,255,0.26) 1px, transparent 1px),
          radial-gradient(circle at 20% 25%, rgba(127, 172, 107, 0.32), transparent 32%),
          radial-gradient(circle at 78% 76%, rgba(97, 135, 82, 0.28), transparent 30%),
          linear-gradient(135deg, #dcebd2, #a8c492);
        background-size: 46px 46px, 46px 46px, auto, auto, auto;
      }
      body[data-app-mode="contracting"] .map-pin-stage {
        border-color: rgba(203, 102, 31, 0.28);
        background:
          linear-gradient(90deg, rgba(255,255,255,0.24) 1px, transparent 1px),
          linear-gradient(0deg, rgba(255,255,255,0.2) 1px, transparent 1px),
          radial-gradient(circle at 25% 30%, rgba(225, 158, 79, 0.34), transparent 32%),
          radial-gradient(circle at 78% 76%, rgba(180, 98, 42, 0.28), transparent 30%),
          linear-gradient(135deg, #f3ddc3, #d49a62);
        background-size: 46px 46px, 46px 46px, auto, auto, auto;
      }
      .map-pin-empty {
        position: absolute;
        inset: 24px;
        display: grid;
        place-items: center;
        text-align: center;
        color: #31412f;
      }
      .map-pin-empty div {
        max-width: 420px;
        background: rgba(255, 255, 255, 0.82);
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 16px 32px rgba(0,0,0,0.12);
      }
      .map-pin {
        position: absolute;
        transform: translate(-50%, -100%);
        border: 0;
        background: transparent;
        cursor: pointer;
        display: grid;
        place-items: center;
        min-width: 46px;
        min-height: 46px;
      }
      .map-pin-marker {
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 8px;
        transform: rotate(-45deg);
        background: #315f36;
        box-shadow: 0 10px 24px rgba(0,0,0,0.25);
        border: 3px solid rgba(255,255,255,0.95);
      }
      body[data-app-mode="contracting"] .map-pin-marker {
        background: #cb661f;
      }
      .map-pin span {
        position: absolute;
        top: 4px;
        left: 50%;
        transform: translateX(-50%);
        color: #fff;
        font-weight: 800;
        font-size: 0.78rem;
        pointer-events: none;
      }
      .map-pin-label {
        position: absolute;
        left: 50%;
        top: 48px;
        transform: translateX(-50%);
        background: rgba(255,255,255,0.92);
        border-radius: 999px;
        padding: 4px 9px;
        white-space: nowrap;
        font-size: 0.74rem;
        font-weight: 700;
        box-shadow: 0 6px 18px rgba(0,0,0,0.16);
        color: #243124;
      }
      .map-pin.selected .map-pin-marker {
        outline: 4px solid rgba(255,255,255,0.75);
        transform: rotate(-45deg) scale(1.12);
      }
      .map-pin-detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
        gap: 12px;
        margin-top: 14px;
      }
      .map-pin-detail-card {
        border: 1px solid rgba(49,95,54,0.15);
        background: rgba(49,95,54,0.06);
        border-radius: 14px;
        padding: 12px;
      }
      body[data-app-mode="contracting"] .map-pin-detail-card {
        border-color: rgba(203,102,31,0.22);
        background: rgba(203,102,31,0.08);
      }
      .map-pin-detail-card span {
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-size: 0.72rem;
        color: #65705f;
        margin-bottom: 4px;
      }
      .map-pin-detail-card strong {
        font-size: 1.05rem;
      }
      .map-pin-site-list {
        display: grid;
        gap: 10px;
      }
      .map-pin-site-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 14px;
        padding: 12px;
        background: rgba(255,255,255,0.72);
      }
      .map-pin-site-row small {
        display: block;
        color: #667062;
        margin-top: 3px;
      }
      .map-pin-row-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      @media (max-width: 680px) {
        .map-pin-stage {
          min-height: 280px;
        }
        .map-pin-site-row {
          align-items: stretch;
          flex-direction: column;
        }
        .map-pin-row-actions {
          justify-content: flex-start;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function insertUi() {
    insertStyles();

    const tabs = document.querySelector(".tabs");
    if (tabs && !document.querySelector('[data-tab="map-pins"]')) {
      const reportsTab = tabs.querySelector('[data-tab="reports"]');
      const mapTab = '<button class="tab" data-tab="map-pins" type="button">Map</button>';
      if (reportsTab) {
        reportsTab.insertAdjacentHTML("beforebegin", mapTab);
      } else {
        tabs.insertAdjacentHTML("beforeend", mapTab);
      }
    }

    if (!document.querySelector("#map-pins")) {
      const reportsPanel = document.querySelector("#reports");
      const anchor = reportsPanel || document.querySelector("main");
      const panelHtml = `
        <section id="map-pins" class="tab-panel" hidden>
          <section class="panel">
            <div class="section-heading">
              <div>
                <h2 id="map-pin-heading">Field & Job Site Map</h2>
                <p id="map-pin-copy">Save GPS points for fields and job sites, then tap a pin to see work, cost, fuel, and season details.</p>
              </div>
              <button id="map-pin-refresh" type="button" class="secondary-button">Refresh Map</button>
            </div>

            <div class="map-pin-toolbar">
              <label><span id="map-pin-select-label">Save location for field / job site</span><select id="map-pin-field-select"></select></label>
              <button id="map-pin-use-location" type="button">Use My Location</button>
            </div>
            <p id="map-pin-message" class="message" aria-live="polite"></p>

            <div id="map-pin-stage" class="map-pin-stage" aria-label="Saved field and job site map"></div>
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <h2 id="map-pin-summary-heading">Selected Location</h2>
                <p>Tap a pin or choose a saved location to review job history and open directions.</p>
              </div>
            </div>
            <div id="map-pin-detail" class="empty-state">No location selected yet.</div>
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <h2 id="map-pin-list-heading">Saved Fields & Job Sites</h2>
                <p>Use your phone GPS when you are standing at the field entrance, job site, driveway, or shop yard.</p>
              </div>
            </div>
            <div id="map-pin-site-list" class="map-pin-site-list"></div>
          </section>
        </section>
      `;

      if (reportsPanel) {
        reportsPanel.insertAdjacentHTML("beforebegin", panelHtml);
      } else if (anchor) {
        anchor.insertAdjacentHTML("beforeend", panelHtml);
      }
    }

    elements.mapPinFieldSelect = document.querySelector("#map-pin-field-select");
    elements.mapPinUseLocation = document.querySelector("#map-pin-use-location");
    elements.mapPinRefresh = document.querySelector("#map-pin-refresh");
    elements.mapPinStage = document.querySelector("#map-pin-stage");
    elements.mapPinDetail = document.querySelector("#map-pin-detail");
    elements.mapPinMessage = document.querySelector("#map-pin-message");
    elements.mapPinSiteList = document.querySelector("#map-pin-site-list");
    elements.mapPinHeading = document.querySelector("#map-pin-heading");
    elements.mapPinCopy = document.querySelector("#map-pin-copy");
    elements.mapPinSelectLabel = document.querySelector("#map-pin-select-label");
    elements.mapPinListHeading = document.querySelector("#map-pin-list-heading");

    elements.tabs = document.querySelectorAll(".tab");
    elements.panels = document.querySelectorAll(".tab-panel");

    document.querySelector('[data-tab="map-pins"]')?.addEventListener("click", (event) => {
      event.preventDefault();
      switchToTab("map-pins");
      renderMapPins();
    });

    elements.mapPinUseLocation?.addEventListener("click", () => {
      const fieldId = elements.mapPinFieldSelect?.value;
      saveCurrentLocation(fieldId);
    });

    elements.mapPinRefresh?.addEventListener("click", () => {
      renderMapPins();
      showMessage("Map refreshed.", "success");
    });
  }

  function showMessage(text, type = "") {
    if (!elements.mapPinMessage) {
      return;
    }
    elements.mapPinMessage.textContent = text;
    elements.mapPinMessage.className = `message ${type}`;
  }

  function renderSelect() {
    const select = elements.mapPinFieldSelect;
    if (!select) {
      return;
    }

    const previous = select.value;
    const label = siteLabel(false);
    select.innerHTML = `<option value="">Choose ${label}</option>`;
    (state.fields || []).forEach((field) => {
      const option = document.createElement("option");
      option.value = field.id;
      option.textContent = field.name || "Unnamed location";
      select.appendChild(option);
    });
    if (previous) {
      select.value = previous;
    }
  }

  function saveCurrentLocation(fieldId) {
    const field = fieldById(fieldId);
    if (!field) {
      showMessage(`Choose a ${siteLabel(false)} first.`, "error");
      return;
    }
    if (!navigator.geolocation) {
      showMessage("This device does not support GPS location.", "error");
      return;
    }

    showMessage("Waiting for location permission...", "");
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude, accuracy } = position.coords;
      field.latitude = Number(latitude.toFixed(7));
      field.longitude = Number(longitude.toFixed(7));
      field.pinLatitude = field.latitude;
      field.pinLongitude = field.longitude;
      field.locationAccuracy = accuracy ? Math.round(accuracy) : "";
      field.locationSavedAt = new Date().toISOString();

      saveFields();
      renderMapPins();
      selectPin(field.id);
      showMessage(`Saved GPS pin for ${field.name || siteLabel(false)}.`, "success");
    }, (error) => {
      const reason = error?.message || "Location permission was denied or unavailable.";
      showMessage(reason, "error");
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000
    });
  }

  function positionedPins(fieldsWithPins) {
    if (!fieldsWithPins.length) {
      return [];
    }

    const lats = fieldsWithPins.map(({ pin }) => pin.latitude);
    const lngs = fieldsWithPins.map(({ pin }) => pin.longitude);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);

    if (Math.abs(maxLat - minLat) < 0.001) {
      minLat -= 0.001;
      maxLat += 0.001;
    }
    if (Math.abs(maxLng - minLng) < 0.001) {
      minLng -= 0.001;
      maxLng += 0.001;
    }

    return fieldsWithPins.map(({ field, pin }) => {
      const x = 7 + ((pin.longitude - minLng) / (maxLng - minLng)) * 86;
      const y = 11 + ((maxLat - pin.latitude) / (maxLat - minLat)) * 78;
      return { field, pin, x, y };
    });
  }

  function renderStage() {
    const stage = elements.mapPinStage;
    if (!stage) {
      return;
    }

    const fieldsWithPins = (state.fields || [])
      .map((field) => ({ field, pin: getPin(field) }))
      .filter((item) => item.pin);

    if (!fieldsWithPins.length) {
      stage.innerHTML = `
        <div class="map-pin-empty">
          <div>
            <h3>No map pins yet</h3>
            <p>Choose a ${siteLabel(false)} above, tap <strong>Use My Location</strong>, and Tractor Tracker will save a GPS pin for it.</p>
          </div>
        </div>
      `;
      return;
    }

    stage.innerHTML = positionedPins(fieldsWithPins).map(({ field, x, y }, index) => `
      <button class="map-pin" type="button" data-map-pin-id="${escapeHtml(field.id)}" style="left:${x}%; top:${y}%;">
        <i class="map-pin-marker" aria-hidden="true"></i>
        <span>${index + 1}</span>
        <b class="map-pin-label">${escapeHtml(field.name || siteLabel(false))}</b>
      </button>
    `).join("");

    stage.querySelectorAll("[data-map-pin-id]").forEach((button) => {
      button.addEventListener("click", () => selectPin(button.dataset.mapPinId));
    });
  }

  function renderDetail(fieldId) {
    const detail = elements.mapPinDetail;
    if (!detail) {
      return;
    }

    const field = fieldById(fieldId) || (state.fields || []).find(hasPin);
    if (!field) {
      detail.className = "empty-state";
      detail.textContent = `No ${siteLabel(true)} with GPS pins yet.`;
      return;
    }

    const summary = fieldSummary(field);
    const pin = getPin(field);
    const lastDate = summary.lastJob ? new Date(jobDateValue(summary.lastJob)).toLocaleDateString() : "No jobs yet";
    const mode = appMode();
    const title = mode === "contracting" ? "Job Site Summary" : "Field Summary";
    const crop = summary.season?.crop || field.crop || "Not set";
    const seasonYear = summary.season?.year || summary.season?.seasonYear || new Date().getFullYear();
    const estimateLine = summary.estimate
      ? `<div class="map-pin-detail-card"><span>Estimate</span><strong>${formatCurrency(summary.estimate.quoteAmount || summary.estimate.suggestedQuote || 0)}</strong></div>`
      : "";

    detail.className = "";
    detail.innerHTML = `
      <div class="section-heading">
        <div>
          <h3>${escapeHtml(field.name || siteLabel(false))}</h3>
          <p>${title}${pin ? ` • ${formatNumber(pin.latitude, 5)}, ${formatNumber(pin.longitude, 5)}` : ""}</p>
        </div>
        ${pin ? `<a class="secondary-button" href="https://www.google.com/maps/search/?api=1&query=${pin.latitude},${pin.longitude}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
      </div>
      <div class="map-pin-detail-grid">
        <div class="map-pin-detail-card"><span>${mode === "contracting" ? "Jobs logged" : "Jobs completed"}</span><strong>${summary.jobs.length}</strong></div>
        <div class="map-pin-detail-card"><span>Last worked</span><strong>${escapeHtml(lastDate)}</strong></div>
        <div class="map-pin-detail-card"><span>${mode === "contracting" ? "Job cost" : "Season cost"}</span><strong>${formatCurrency(summary.totalCost)}</strong></div>
        <div class="map-pin-detail-card"><span>Fuel used</span><strong>${formatNumber(summary.fuel, 1)}</strong></div>
        ${mode === "farm" ? `<div class="map-pin-detail-card"><span>Crop / season</span><strong>${escapeHtml(crop)} ${escapeHtml(seasonYear)}</strong></div>` : ""}
        ${mode === "farm" ? `<div class="map-pin-detail-card"><span>Cost / acre</span><strong>${formatCurrency(summary.costPerAcre)}</strong></div>` : ""}
        ${estimateLine}
      </div>
      ${field.notes ? `<p style="margin-top:12px;"><strong>Notes:</strong> ${escapeHtml(field.notes)}</p>` : ""}
    `;

    document.querySelectorAll(".map-pin").forEach((button) => {
      button.classList.toggle("selected", button.dataset.mapPinId === field.id);
    });
  }

  function renderSiteList() {
    const list = elements.mapPinSiteList;
    if (!list) {
      return;
    }

    const fields = state.fields || [];
    if (!fields.length) {
      list.innerHTML = `<div class="empty-state">Add a ${siteLabel(false)} in Setup first, then come back to save its GPS pin.</div>`;
      return;
    }

    list.innerHTML = fields.map((field) => {
      const pin = getPin(field);
      const summary = fieldSummary(field);
      const saved = pin
        ? `GPS saved${field.locationAccuracy ? ` • ~${escapeHtml(field.locationAccuracy)}m accuracy` : ""}`
        : "No GPS pin saved";
      return `
        <div class="map-pin-site-row">
          <div>
            <strong>${escapeHtml(field.name || siteLabel(false))}</strong>
            <small>${saved} • ${summary.jobs.length} job${summary.jobs.length === 1 ? "" : "s"} logged</small>
          </div>
          <div class="map-pin-row-actions">
            <button type="button" class="secondary-button" data-map-save="${escapeHtml(field.id)}">${pin ? "Update Pin" : "Save Pin"}</button>
            ${pin ? `<button type="button" class="ghost-button" data-map-view="${escapeHtml(field.id)}">View</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-map-save]").forEach((button) => {
      button.addEventListener("click", () => saveCurrentLocation(button.dataset.mapSave));
    });
    list.querySelectorAll("[data-map-view]").forEach((button) => {
      button.addEventListener("click", () => {
        selectPin(button.dataset.mapView);
        switchToTab("map-pins");
      });
    });
  }

  function updateCopy() {
    if (elements.mapPinHeading) {
      elements.mapPinHeading.textContent = isContracting() ? "Job Site Map" : "Field Map";
    }
    if (elements.mapPinCopy) {
      elements.mapPinCopy.textContent = isContracting()
        ? "Save GPS pins for customer job sites, then tap a pin to see estimates, jobs, fuel, cost, and profit."
        : "Save GPS pins for fields, then tap a pin to see crop season, completed jobs, fuel, and cost per acre.";
    }
    if (elements.mapPinSelectLabel) {
      elements.mapPinSelectLabel.textContent = `Save location for ${siteLabel(false)}`;
    }
    if (elements.mapPinListHeading) {
      elements.mapPinListHeading.textContent = `Saved ${siteLabel(true)}`;
    }
  }

  function renderMapPins() {
    insertUi();
    updateCopy();
    renderSelect();
    renderStage();
    renderSiteList();

    const selectedId = elements.mapPinFieldSelect?.value || (state.fields || []).find(hasPin)?.id;
    renderDetail(selectedId);
  }

  function selectPin(fieldId) {
    if (elements.mapPinFieldSelect) {
      elements.mapPinFieldSelect.value = fieldId || "";
    }
    renderDetail(fieldId);
  }

  function patchRenderAll() {
    if (window.__tractorMapPinsRenderPatched) {
      return;
    }
    window.__tractorMapPinsRenderPatched = true;

    const originalRenderAll = window.renderAll;
    if (typeof originalRenderAll === "function") {
      window.renderAll = function patchedRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderMapPins();
        return result;
      };
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    insertUi();
    patchRenderAll();
    renderMapPins();
  });

  setTimeout(() => {
    insertUi();
    patchRenderAll();
    renderMapPins();
  }, 500);

  window.renderMapPins = renderMapPins;
})();
