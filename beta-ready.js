/* Tractor Tracker beta-ready polish: onboarding, mobile layout, backups, and documents */
(() => {
  if (window.__tractorBetaReadyInstalled) return;
  window.__tractorBetaReadyInstalled = true;

  const DOC_KEY = "tractorTracker.documents.v1";
  const MAX_SIDE = 1400;
  const JPEG_QUALITY = 0.72;
  const MAX_FILE_BYTES = 3 * 1024 * 1024;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[char]));
  const getState = () => {
    try { return typeof state !== "undefined" ? state : {}; }
    catch { return {}; }
  };
  const arr = (value) => Array.isArray(value) ? value : [];
  const mode = () => document.body?.dataset?.appMode || getState().settings?.mode || getState().appMode || "farm";
  const contracting = () => mode() === "contracting";

  function installStyles() {
    if ($("#beta-ready-styles")) return;
    const style = document.createElement("style");
    style.id = "beta-ready-styles";
    style.textContent = `
      .beta-ready-panel{border:1px solid rgba(49,95,54,.16);background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(231,242,224,.9))}
      body[data-app-mode="contracting"] .beta-ready-panel{border-color:rgba(203,102,31,.22);background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(248,230,210,.94))}
      .beta-progress{display:flex;align-items:center;gap:12px;margin:10px 0 14px}.beta-bar{height:10px;border-radius:999px;background:rgba(0,0,0,.09);overflow:hidden;flex:1}.beta-fill{height:100%;background:#315f36;border-radius:inherit}body[data-app-mode="contracting"] .beta-fill{background:#cb661f}
      .beta-check-grid,.beta-safety-grid,.doc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px}
      .beta-check,.beta-safety-card,.doc-stat{border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:14px;background:rgba(255,255,255,.82)}
      .beta-check.done{border-color:rgba(49,95,54,.28);background:rgba(49,95,54,.08)}body[data-app-mode="contracting"] .beta-check.done{border-color:rgba(203,102,31,.28);background:rgba(203,102,31,.08)}
      .beta-check strong,.beta-safety-card strong,.doc-stat strong{display:block;margin-bottom:4px}.beta-check small,.beta-safety-card small,.doc-stat span,.doc-meta small{display:block;color:#667062}
      .beta-safety-actions,.doc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
      .doc-row{display:grid;grid-template-columns:86px 1fr auto;gap:14px;align-items:center;border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:12px;background:rgba(255,255,255,.78);margin-bottom:12px}
      .doc-thumb{width:86px;height:70px;border-radius:14px;overflow:hidden;display:grid;place-items:center;background:rgba(49,95,54,.1);color:#315f36;font-weight:800}body[data-app-mode="contracting"] .doc-thumb{background:rgba(203,102,31,.12);color:#cb661f}.doc-thumb img{width:100%;height:100%;object-fit:cover}
      .mobile-quick-actions{display:none}
      @media(max-width:760px){
        .tabs{position:sticky;top:0;z-index:20;overflow-x:auto;flex-wrap:nowrap;padding:8px 0;background:rgba(246,242,232,.96);backdrop-filter:blur(10px)}
        .tab{flex:0 0 auto;min-height:44px;white-space:nowrap;padding:10px 14px}
        button,.secondary-button,.ghost-button{min-height:44px}button,input,select,textarea{font-size:16px}.form-actions{gap:10px}
        .doc-row{grid-template-columns:72px 1fr}.doc-thumb{width:72px;height:62px}.doc-actions{grid-column:1/-1;justify-content:flex-start}
        .mobile-quick-actions{display:flex;position:sticky;bottom:0;z-index:25;gap:8px;padding:10px;margin:16px -4px -4px;border-radius:18px 18px 0 0;background:rgba(255,255,255,.96);box-shadow:0 -10px 26px rgba(0,0,0,.12);overflow-x:auto}.mobile-quick-actions button{flex:1 0 auto;min-width:92px}
      }`;
    document.head.appendChild(style);
  }

  function switchTab(name) {
    const tab = document.querySelector(`[data-tab="${name}"]`);
    if (tab) return tab.click();
    $$(".tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
    $$(".tab-panel").forEach((panel) => {
      const active = panel.id === name;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
    scrollTo({ top: 0, behavior: "smooth" });
  }

  function equipmentCount(s) {
    if (Array.isArray(s.equipment)) return s.equipment.length;
    return s.equipment && typeof s.equipment === "object" && Object.keys(s.equipment).length ? 1 : 0;
  }
  const fuelCount = (s) => arr(s.fuelPrices || s.localFuelPrices || s.savedFuelPrices).length;
  const templateCount = (s) => arr(s.workTemplates || s.quickLogTemplates || s.templates).length;
  const seasonCount = (s) => arr(s.fieldSeasons || s.seasons || s.fieldSeasonPlans).length;

  function setupSteps() {
    const s = getState();
    return [
      ["Choose mode", true, contracting() ? "Contracting layout active" : "Farm work layout active", "reports"],
      ["Add equipment", equipmentCount(s) > 0, `${equipmentCount(s)} saved`, "records"],
      [contracting() ? "Add job site" : "Add field", arr(s.fields).length > 0, `${arr(s.fields).length} saved`, "records"],
      ["Add fuel price", fuelCount(s) > 0, fuelCount(s) ? `${fuelCount(s)} saved` : "Improves job costs", "records"],
      ["Create template", templateCount(s) > 0, "Speeds up repeated work", "dashboard"],
      [contracting() ? "Build estimate" : "Create season", contracting() ? arr(s.estimates).length > 0 : seasonCount(s) > 0, contracting() ? "Quote before work" : "Track crop cost", contracting() ? "estimates" : "seasons"],
      ["Log first job", arr(s.jobs).length > 0, `${arr(s.jobs).length} logged`, "jobs"]
    ];
  }

  function renderStartHere() {
    const grid = $("#beta-start-grid");
    if (!grid) return;
    const steps = setupSteps();
    const done = steps.filter((step) => step[1]).length;
    const pct = Math.round((done / steps.length) * 100);
    $("#beta-start-fill").style.width = `${pct}%`;
    $("#beta-start-percent").textContent = `${pct}%`;
    $("#beta-start-copy").textContent = contracting()
      ? "Contracting path: equipment, customers/job sites, fuel, estimates, docs, then jobs and invoices."
      : "Farm path: equipment, fields, fuel, seasons, docs, then job logs and reports.";
    grid.innerHTML = steps.map((step, index) => `
      <article class="beta-check ${step[1] ? "done" : ""}">
        <strong>${step[1] ? "✓" : index + 1 + "."} ${esc(step[0])}</strong>
        <small>${esc(step[2])}</small>
        <button type="button" class="${step[1] ? "secondary-button" : ""}" data-beta-tab="${esc(step[3])}">${step[1] ? "Review" : "Start"}</button>
      </article>`).join("");
    $$('[data-beta-tab]', grid).forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.betaTab)));
  }

  function ensureStartHere() {
    const dashboard = $("#dashboard");
    if (!dashboard || $("#beta-start-here")) return;
    dashboard.insertAdjacentHTML("afterbegin", `
      <section id="beta-start-here" class="panel beta-ready-panel">
        <div class="section-heading"><div><p class="eyebrow">Start here</p><h2>Beta Setup Checklist</h2><p id="beta-start-copy"></p></div><button id="beta-start-refresh" class="secondary-button" type="button">Refresh</button></div>
        <div class="beta-progress"><div class="beta-bar"><div id="beta-start-fill" class="beta-fill"></div></div><strong id="beta-start-percent">0%</strong></div>
        <div id="beta-start-grid" class="beta-check-grid"></div>
      </section>`);
    $("#beta-start-refresh").addEventListener("click", renderStartHere);
    renderStartHere();
  }

  function backupPayload() {
    const data = {};
    const skipped = [];
    Object.keys(localStorage).sort().forEach((key) => {
      const lower = key.toLowerCase();
      if (lower.includes("password") || lower.includes("token") || lower.includes("secret") || lower.includes("auth")) {
        skipped.push(key);
      } else {
        data[key] = localStorage.getItem(key);
      }
    });
    return { app: "Tractor Tracker", exportedAt: new Date().toISOString(), note: "Sensitive auth/password/token keys excluded.", skippedKeys: skipped, data };
  }

  function downloadJson(name, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (!payload?.data || typeof payload.data !== "object") throw new Error("Not a Tractor Tracker backup.");
        if (!confirm("Restore this backup on this device? Matching local records will be overwritten.")) return;
        Object.entries(payload.data).forEach(([key, value]) => typeof value === "string" && localStorage.setItem(key, value));
        alert("Backup restored. Tractor Tracker will reload.");
        location.reload();
      } catch (error) {
        $("#beta-safety-message").textContent = `Restore failed: ${error.message}`;
      }
    };
    reader.readAsText(file);
  }

  function ensureSafetyCenter() {
    const anchor = $("#account") || $("#reports");
    if (!anchor || $("#beta-safety-center")) return;
    anchor.insertAdjacentHTML("beforeend", `
      <section id="beta-safety-center" class="panel">
        <div class="section-heading"><div><p class="eyebrow">Data safety</p><h2>Backup / Export / Restore</h2><p>Use this before beta testing, switching phones, clearing browser data, or reinstalling the PWA.</p></div></div>
        <div class="beta-safety-grid">
          <article class="beta-safety-card"><strong>Cloud sync</strong><small>Log in so farm and contractor records can sync between devices.</small></article>
          <article class="beta-safety-card"><strong>Local backup</strong><small>Download a backup of safe local app records. Auth tokens and passwords are excluded.</small></article>
          <article class="beta-safety-card"><strong>Documents</strong><small>Photos and receipts are local-first in this beta. Export backups before changing devices.</small></article>
        </div>
        <div class="beta-safety-actions">
          <button id="beta-download-backup" type="button">Download Backup</button>
          <label class="secondary-button" for="beta-restore-backup" style="display:inline-flex;align-items:center;cursor:pointer">Restore Backup</label>
          <input id="beta-restore-backup" type="file" accept="application/json,.json" hidden>
        </div>
        <p id="beta-safety-message" class="message" aria-live="polite"></p>
      </section>`);
    $("#beta-download-backup").addEventListener("click", () => {
      downloadJson(`tractor-tracker-backup-${new Date().toISOString().slice(0,10)}.json`, backupPayload());
      $("#beta-safety-message").textContent = "Backup downloaded. Keep it somewhere safe.";
    });
    $("#beta-restore-backup").addEventListener("change", (event) => importBackup(event.target.files?.[0]));
  }

  function docs() {
    try { const parsed = JSON.parse(localStorage.getItem(DOC_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  const saveDocs = (items) => localStorage.setItem(DOC_KEY, JSON.stringify(items));

  function recordOptions(type) {
    const s = getState();
    if (type === "job") return arr(s.jobs).map((job, i) => ({ id: job.id || `job-${i}`, label: [job.jobType || job.type || "Job", job.date || job.startTime].filter(Boolean).join(" - ") || `Job ${i + 1}` }));
    if (type === "field") return arr(s.fields).map((field, i) => ({ id: field.id || `field-${i}`, label: field.name || `${contracting() ? "Job site" : "Field"} ${i + 1}` }));
    if (type === "equipment") {
      if (Array.isArray(s.equipment)) return s.equipment.map((item, i) => ({ id: item.id || `equipment-${i}`, label: item.name || item.model || `Equipment ${i + 1}` }));
      return s.equipment && typeof s.equipment === "object" ? [{ id: s.equipment.id || "equipment-main", label: s.equipment.name || s.equipment.model || "Main equipment" }] : [];
    }
    if (type === "maintenance") return arr(s.maintenance || s.maintenanceRecords || s.reminders).map((item, i) => ({ id: item.id || `maintenance-${i}`, label: item.title || item.task || `Maintenance ${i + 1}` }));
    if (type === "invoice") return arr(s.invoices).map((item, i) => ({ id: item.id || `invoice-${i}`, label: item.number || item.customerName || `Invoice ${i + 1}` }));
    return [];
  }

  function updateRecordSelect() {
    const type = $("#doc-related-type")?.value || "general";
    const wrap = $("#doc-related-wrap");
    const select = $("#doc-related-id");
    if (!wrap || !select) return;
    wrap.hidden = type === "general";
    const options = recordOptions(type);
    select.innerHTML = options.length ? options.map((opt) => `<option value="${esc(opt.id)}">${esc(opt.label)}</option>`).join("") : '<option value="">No saved records yet</option>';
  }

  function relatedName(type, id) {
    if (type === "general") return "General";
    return recordOptions(type).find((item) => item.id === id)?.label || type;
  }

  function bytes(dataUrl) {
    const b64 = String(dataUrl).split(",", 2)[1] || "";
    return Math.round(b64.length * 3 / 4);
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image.")); };
      image.src = url;
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  async function prepareFile(file) {
    if (!file) throw new Error("Choose a photo, receipt, or PDF first.");
    let dataUrl = "";
    let mimeType = file.type;
    if (file.type.startsWith("image/")) {
      dataUrl = await compressImage(file);
      mimeType = "image/jpeg";
    } else if (file.type === "application/pdf") {
      if (file.size > 1.5 * 1024 * 1024) throw new Error("PDF is too large for local beta storage. Use a photo/screenshot for now.");
      dataUrl = await readFile(file);
    } else {
      throw new Error("Use an image or PDF.");
    }
    const storedBytes = file.type.startsWith("image/") ? bytes(dataUrl) : file.size;
    if (storedBytes > MAX_FILE_BYTES) throw new Error("File is too large for local beta storage.");
    return { dataUrl, mimeType, storedBytes };
  }

  function sizeLabel(value) {
    const n = Number(value || 0);
    return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
  }

  function renderDocs() {
    updateRecordSelect();
    const items = docs();
    const list = $("#doc-list");
    const stats = $("#doc-stats");
    if (!list || !stats) return;
    const photos = items.filter((item) => item.mimeType?.startsWith("image/")).length;
    const receipts = items.filter((item) => /receipt|ticket|invoice/i.test(item.category)).length;
    const storage = items.reduce((sum, item) => sum + Number(item.storedBytes || 0), 0);
    stats.innerHTML = `
      <article class="doc-stat"><span>Total saved</span><strong>${items.length}</strong></article>
      <article class="doc-stat"><span>Photos</span><strong>${photos}</strong></article>
      <article class="doc-stat"><span>Receipts / proof</span><strong>${receipts}</strong></article>
      <article class="doc-stat"><span>Storage used</span><strong>${sizeLabel(storage)}</strong></article>`;
    if (!items.length) {
      list.innerHTML = '<div class="empty-state">No photos or receipts saved yet.</div>';
      return;
    }
    list.innerHTML = items.map((doc) => `
      <article class="doc-row">
        <div class="doc-thumb">${doc.mimeType?.startsWith("image/") ? `<img src="${doc.dataUrl}" alt="${esc(doc.category)}">` : "PDF"}</div>
        <div class="doc-meta">
          <strong>${esc(doc.category)}</strong>
          <small>${esc(doc.relatedLabel || "General")} • ${esc(new Date(doc.createdAt).toLocaleString())}</small>
          <small>${esc(doc.fileName || "file")} • ${esc(sizeLabel(doc.storedBytes))}</small>
          ${doc.note ? `<small>${esc(doc.note)}</small>` : ""}
        </div>
        <div class="doc-actions">
          <button type="button" class="secondary-button" data-doc-open="${esc(doc.id)}">Open</button>
          <button type="button" class="secondary-button" data-doc-download="${esc(doc.id)}">Download</button>
          <button type="button" class="ghost-button" data-doc-delete="${esc(doc.id)}">Delete</button>
        </div>
      </article>`).join("");
    $$('[data-doc-open]', list).forEach((btn) => btn.addEventListener("click", () => openDoc(btn.dataset.docOpen)));
    $$('[data-doc-download]', list).forEach((btn) => btn.addEventListener("click", () => downloadDoc(btn.dataset.docDownload)));
    $$('[data-doc-delete]', list).forEach((btn) => btn.addEventListener("click", () => deleteDoc(btn.dataset.docDelete)));
  }

  function docById(id) { return docs().find((doc) => doc.id === id); }
  function openDoc(id) {
    const doc = docById(id);
    if (!doc) return;
    const win = window.open();
    if (!win) return;
    win.document.write(`<title>${esc(doc.category)}</title><body style="font-family:system-ui;margin:24px"><h1>${esc(doc.category)}</h1><p>${esc(doc.relatedLabel || "General")} • ${esc(new Date(doc.createdAt).toLocaleString())}</p>${doc.note ? `<p>${esc(doc.note)}</p>` : ""}${doc.mimeType?.startsWith("image/") ? `<img src="${doc.dataUrl}" style="max-width:100%;height:auto;border-radius:12px" alt="${esc(doc.category)}">` : `<embed src="${doc.dataUrl}" type="application/pdf" width="100%" height="800">`}</body>`);
    win.document.close();
  }
  function downloadDoc(id) {
    const doc = docById(id);
    if (!doc) return;
    const link = document.createElement("a");
    link.href = doc.dataUrl;
    link.download = doc.fileName || `${doc.category.replace(/\s+/g, "-").toLowerCase()}`;
    link.click();
  }
  function deleteDoc(id) {
    const doc = docById(id);
    if (!doc || !confirm(`Delete ${doc.category}?`)) return;
    saveDocs(docs().filter((item) => item.id !== id));
    renderDocs();
    $("#doc-message").textContent = "Document deleted.";
  }

  async function saveDocument(event) {
    event.preventDefault();
    try {
      $("#doc-message").textContent = "Saving document...";
      const type = $("#doc-related-type").value;
      const relatedId = $("#doc-related-id").value;
      const file = $("#doc-file").files?.[0];
      const prepared = await prepareFile(file);
      const item = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        category: $("#doc-category").value,
        relatedType: type,
        relatedId,
        relatedLabel: relatedName(type, relatedId),
        note: $("#doc-note").value,
        fileName: file.name,
        mimeType: prepared.mimeType,
        storedBytes: prepared.storedBytes,
        dataUrl: prepared.dataUrl
      };
      saveDocs([item, ...docs()]);
      event.target.reset();
      updateRecordSelect();
      renderDocs();
      $("#doc-message").textContent = "Document saved. Export a backup before changing devices.";
    } catch (error) {
      $("#doc-message").textContent = error.message;
    }
  }

  function ensureDocs() {
    const tabs = $(".tabs");
    if (tabs && !$('[data-tab="photos-receipts"]')) {
      const reportsTab = $('[data-tab="reports"]');
      (reportsTab || tabs).insertAdjacentHTML(reportsTab ? "beforebegin" : "beforeend", '<button class="tab" data-tab="photos-receipts" type="button">Docs</button>');
    }
    if (!$("#photos-receipts")) {
      const reports = $("#reports");
      const main = $("main");
      const html = `
        <section id="photos-receipts" class="tab-panel" hidden>
          <section class="panel">
            <div class="section-heading"><div><p class="eyebrow">Photos & receipts</p><h2>Job Documents</h2><p>Attach fuel receipts, repair receipts, before/after photos, field condition photos, material tickets, and invoice proof.</p></div></div>
            <div id="doc-stats" class="doc-stats"></div>
            <form id="doc-form" class="form-grid compact-form">
              <label>Document type<select id="doc-category"><option>Fuel receipt</option><option>Repair receipt</option><option>Before photo</option><option>After photo</option><option>Field condition photo</option><option>Broken part photo</option><option>Material ticket</option><option>Invoice proof</option><option>Other document</option></select></label>
              <label>Attach to<select id="doc-related-type"><option value="general">General</option><option value="job">Job</option><option value="field">Field / Job site</option><option value="equipment">Equipment</option><option value="maintenance">Maintenance</option><option value="invoice">Invoice</option></select></label>
              <label id="doc-related-wrap">Choose record<select id="doc-related-id"></select></label>
              <label class="full-width">Photo / receipt / PDF<input id="doc-file" type="file" accept="image/*,application/pdf" required></label>
              <label class="full-width">Note<textarea id="doc-note" rows="3" placeholder="Example: fuel receipt, before grading photo, broken belt, material ticket, invoice proof"></textarea></label>
              <p class="full-width document-form-note">Beta note: documents are stored locally on this device. Use Backup / Export before switching phones or clearing browser data.</p>
              <div class="form-actions full-width"><button type="submit">Save Document</button><button id="doc-export" type="button" class="secondary-button">Export Documents</button></div>
            </form>
            <p id="doc-message" class="message" aria-live="polite"></p>
          </section>
          <section class="panel"><div class="section-heading"><div><h2>Saved Documents</h2><p>Review, download, or delete saved photos and receipts.</p></div><button id="doc-refresh" type="button" class="secondary-button">Refresh</button></div><div id="doc-list"></div></section>
        </section>`;
      (reports || main)?.insertAdjacentHTML(reports ? "beforebegin" : "beforeend", html);
    }
    $('[data-tab="photos-receipts"]')?.addEventListener("click", () => switchTab("photos-receipts"));
    $("#doc-related-type")?.addEventListener("change", updateRecordSelect);
    $("#doc-refresh")?.addEventListener("click", renderDocs);
    $("#doc-form")?.addEventListener("submit", saveDocument);
    $("#doc-export")?.addEventListener("click", () => {
      downloadJson(`tractor-tracker-documents-${new Date().toISOString().slice(0,10)}.json`, { app: "Tractor Tracker", exportedAt: new Date().toISOString(), documents: docs() });
      $("#doc-message").textContent = "Documents exported.";
    });
    renderDocs();
  }

  function ensureMobileQuickActions() {
    if ($("#mobile-quick-actions")) return;
    const main = $("main");
    if (!main) return;
    main.insertAdjacentHTML("beforeend", `
      <div id="mobile-quick-actions" class="mobile-quick-actions">
        <button type="button" data-mobile-tab="jobs">Jobs</button>
        <button type="button" data-mobile-tab="records">Setup</button>
        <button type="button" data-mobile-tab="map-pins">Map</button>
        <button type="button" data-mobile-tab="photos-receipts">Docs</button>
      </div>`);
    $$('[data-mobile-tab]').forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.mobileTab)));
  }

  function boot() {
    installStyles();
    ensureDocs();
    ensureStartHere();
    ensureSafetyCenter();
    ensureMobileQuickActions();
    setInterval(() => { renderStartHere(); renderDocs(); }, 6000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
