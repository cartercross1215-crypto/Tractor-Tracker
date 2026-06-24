const STORAGE_KEYS = {
  equipment: "fieldwork-equipment-v2",
  fields: "fieldwork-fields-v2",
  customers: "tractor-tracker-customers-v1",
  operators: "fieldwork-operators-v2",
  implements: "fieldwork-implements-v2",
  jobs: "fieldwork-jobs-v2",
  activeJob: "fieldwork-active-job-v2",
  maintenance: "fieldwork-maintenance-v2",
  maintenanceHistory: "tractor-tracker-maintenance-history-v1",
  cloudSession: "tractor-tracker-cloud-session-v1",
  syncMeta: "tractor-tracker-sync-meta-v1",
  settings: "tractor-tracker-settings-v1"
};

const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    price: "$0/month",
    limits: {
      equipment: 1,
      operators: 1,
      fields: 5
    },
    features: {
      advancedReports: false,
      exportTools: false,
      cloudSync: false
    }
  },
  farm: {
    name: "Unlimited",
    price: "$9.99/month",
    limits: {
      equipment: Infinity,
      operators: Infinity,
      fields: Infinity
    },
    features: {
      advancedReports: true,
      exportTools: true,
      cloudSync: true
    }
  }
};

const UNIT_FACTORS = {
  kilometersPerMile: 1.609344,
  litersPerGallon: 3.785411784
};

const AUTO_SYNC_DELAY_MS = 1200;

const APP_MODES = {
  farm: {
    subtitle: "Modern field and equipment records for farms running dependable older iron.",
    planSummary: "1 machine / 1 operator / 5 fields",
    dashboardCopy: "Quick view of recent jobs, current limits, and machine status.",
    snapshotHeading: "Farm Dashboard",
    setupHeading: "Operators, Implements, Fields",
    locationSingular: "field",
    locationPlural: "fields",
    locationLabel: "Field",
    locationNameLabel: "Field name",
    locationPlaceholder: "North 80",
    areaLabel: "Acres",
    areaJobLabel: "Acres completed",
    areaRequired: true,
    notesLabel: "Notes",
    notesPlaceholder: "Soil, drainage, crop, landlord, or custom work notes",
    implementLabel: "Implement",
    implementPlaceholder: "Implement or attachment",
    jobHeading: "Log Fieldwork",
    timerSummary: "Choose the field, machine, implement, operator, and job type before starting.",
    conditionsLabel: "Field conditions",
    conditionsPlaceholder: "Dry, damp, rough, heavy residue",
    costHourLabel: "Operating cost/hour",
    costDistanceLabel: "Cost per mile",
    productionLabel: "Acres Logged",
    fuelRateLabel: "Fuel Per Acre",
    jobTypes: ["Planting", "Tilling", "Spraying", "Fertilizing", "Harvesting", "Mowing", "Baling", "Disking", "Hauling", "Trucking", "Custom job"]
  },
  contracting: {
    subtitle: "Job-site, hauling, equipment, fuel, and billing records for independent contractors.",
    planSummary: "1 machine / 1 operator / 5 job sites",
    dashboardCopy: "Quick view of recent jobs, current limits, and equipment status.",
    snapshotHeading: "Contracting Dashboard",
    setupHeading: "Operators, Attachments, Job Sites",
    locationSingular: "job site",
    locationPlural: "job sites",
    locationLabel: "Job site",
    locationNameLabel: "Job site or customer",
    locationPlaceholder: "Smith Driveway",
    areaLabel: "Area or acres",
    areaJobLabel: "Area/acres completed",
    areaRequired: false,
    notesLabel: "Customer, company, or site notes",
    notesPlaceholder: "Customer, company, address, contact, or site notes",
    implementLabel: "Attachment",
    implementPlaceholder: "Bucket, trailer, blade, grapple",
    jobHeading: "Log Contract Job",
    timerSummary: "Choose the job site, equipment, attachment, operator, and job type before starting.",
    conditionsLabel: "Site conditions",
    conditionsPlaceholder: "Muddy, tight access, steep grade, traffic, scale tickets",
    costHourLabel: "Billing or cost/hour",
    costDistanceLabel: "Cost per mile",
    productionLabel: "Loads Hauled",
    fuelRateLabel: "Fuel Per Hour",
    jobTypes: ["Hauling", "Trucking", "Excavating", "Grading", "Skid-steer work", "Land clearing", "Site prep", "Snow removal", "Landscaping", "Custom job"]
  }
};

const state = {
  equipment: loadEquipment(),
  fields: loadData(STORAGE_KEYS.fields, []),
  customers: loadData(STORAGE_KEYS.customers, []),
  operators: loadData(STORAGE_KEYS.operators, []),
  implements: loadData(STORAGE_KEYS.implements, []),
  jobs: loadData(STORAGE_KEYS.jobs, []),
  activeJob: loadData(STORAGE_KEYS.activeJob, null),
  maintenance: loadData(STORAGE_KEYS.maintenance, []),
  maintenanceHistory: loadData(STORAGE_KEYS.maintenanceHistory, []),
  cloudSession: loadData(STORAGE_KEYS.cloudSession, null),
  syncMeta: loadData(STORAGE_KEYS.syncMeta, {
    status: "local",
    pending: false,
    lastLocalSaveAt: null,
    lastSyncedAt: null,
    message: "Saved locally"
  }),
  settings: loadData(STORAGE_KEYS.settings, {
    appMode: null,
    setupComplete: false,
    businessName: "",
    subscriptionPlan: "free",
    measurementSystem: "us",
    currency: "USD"
  }),
  editingEquipmentId: null,
  editingFieldId: null,
  editingCustomerId: null,
  editingOperatorId: null,
  editingImplementId: null,
  editingJobId: null,
  editingMaintenanceId: null
};

let autoSyncTimer = null;
let isAutoSyncing = false;
let suppressSyncTracking = false;

const elements = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".tab-panel"),
  equipmentForm: document.querySelector("#equipment-form"),
  fieldForm: document.querySelector("#field-form"),
  customerForm: document.querySelector("#customer-form"),
  operatorForm: document.querySelector("#operator-form"),
  implementForm: document.querySelector("#implement-form"),
  firstUseForm: document.querySelector("#first-use-form"),
  jobForm: document.querySelector("#job-form"),
  maintenanceForm: document.querySelector("#maintenance-form"),
  settingsForm: document.querySelector("#settings-form"),
  registerForm: document.querySelector("#register-form"),
  loginForm: document.querySelector("#login-form"),
  equipmentDisplay: document.querySelector("#equipment-display"),
  fieldList: document.querySelector("#field-list"),
  customerList: document.querySelector("#customer-list"),
  operatorList: document.querySelector("#operator-list"),
  implementList: document.querySelector("#implement-list"),
  jobList: document.querySelector("#job-list"),
  recentJobs: document.querySelector("#recent-jobs"),
  dashboardSnapshot: document.querySelector("#dashboard-snapshot"),
  maintenanceList: document.querySelector("#maintenance-list"),
  reportGrid: document.querySelector("#report-grid"),
  limitStatus: document.querySelector("#limit-status"),
  jobMessage: document.querySelector("#job-message"),
  backupMessage: document.querySelector("#backup-message"),
  cloudMessage: document.querySelector("#cloud-message"),
  cloudStatus: document.querySelector("#cloud-status"),
  cloudFarmName: document.querySelector("#cloud-farm-name"),
  cloudAccountEmail: document.querySelector("#cloud-account-email"),
  syncStatus: document.querySelector("#sync-status"),
  cloudSyncStatus: document.querySelector("#cloud-sync-status"),
  cloudLastSync: document.querySelector("#cloud-last-sync"),
  planName: document.querySelector("#plan-name"),
  subscriptionStatus: document.querySelector("#subscription-status"),
  subscriptionPrice: document.querySelector("#subscription-price"),
  freePlanCard: document.querySelector("#free-plan-card"),
  farmPlanCard: document.querySelector("#farm-plan-card"),
  useFreePlan: document.querySelector("#use-free-plan"),
  activateFarmPlan: document.querySelector("#activate-farm-plan"),
  logoutAccount: document.querySelector("#logout-account"),
  uploadCloud: document.querySelector("#upload-cloud"),
  downloadCloud: document.querySelector("#download-cloud"),
  clearJobs: document.querySelector("#clear-jobs"),
  sampleData: document.querySelector("#sample-data"),
  exportCsv: document.querySelector("#export-csv"),
  exportMaintenanceCsv: document.querySelector("#export-maintenance-csv"),
  downloadBackup: document.querySelector("#download-backup"),
  restoreBackup: document.querySelector("#restore-backup"),
  restoreBackupFile: document.querySelector("#restore-backup-file"),
  saveEquipment: document.querySelector("#save-equipment"),
  cancelEquipmentEdit: document.querySelector("#cancel-equipment-edit"),
  saveField: document.querySelector("#save-field"),
  cancelFieldEdit: document.querySelector("#cancel-field-edit"),
  saveCustomer: document.querySelector("#save-customer"),
  cancelCustomerEdit: document.querySelector("#cancel-customer-edit"),
  saveOperator: document.querySelector("#save-operator"),
  cancelOperatorEdit: document.querySelector("#cancel-operator-edit"),
  saveImplement: document.querySelector("#save-implement"),
  cancelImplementEdit: document.querySelector("#cancel-implement-edit"),
  saveJob: document.querySelector("#save-job"),
  cancelJobEdit: document.querySelector("#cancel-job-edit"),
  saveMaintenance: document.querySelector("#save-maintenance"),
  cancelMaintenanceEdit: document.querySelector("#cancel-maintenance-edit"),
  fieldAcres: document.querySelector("#field-acres"),
  activeJobTimer: document.querySelector("#job-timer"),
  jobTimerElapsed: document.querySelector("#job-timer-elapsed"),
  jobTimerSummary: document.querySelector("#job-timer-summary"),
  startJob: document.querySelector("#start-job"),
  finishJob: document.querySelector("#finish-job"),
  cancelJob: document.querySelector("#cancel-job"),
  jobField: document.querySelector("#job-field"),
  fieldCustomer: document.querySelector("#field-customer"),
  jobEquipment: document.querySelector("#job-equipment"),
  jobImplement: document.querySelector("#job-implement"),
  jobOperator: document.querySelector("#job-operator"),
  jobType: document.querySelector("#job-type"),
  jobStart: document.querySelector("#job-start"),
  jobEnd: document.querySelector("#job-end"),
  jobAcres: document.querySelector("#job-acres"),
  equipmentFuelCapacityUnit: document.querySelector("#equipment-fuel-capacity-unit"),
  jobDistance: document.querySelector("#job-distance"),
  jobDistanceUnit: document.querySelector("#job-distance-unit"),
  jobFuelUnit: document.querySelector("#job-fuel-unit"),
  measurementSystem: document.querySelector("#measurement-system"),
  currencyCode: document.querySelector("#currency-code"),
  maintenanceEquipment: document.querySelector("#maintenance-equipment")
};

Object.assign(elements, {
  modeChooser: document.querySelector("#mode-chooser"),
  setupWizard: document.querySelector("#setup-wizard"),
  appMode: document.querySelector("#app-mode"),
  settingsBusinessLabel: document.querySelector("#settings-business-label"),
  settingsBusinessName: document.querySelector("#settings-business-name"),
  appSubtitle: document.querySelector("#app-subtitle"),
  planSummary: document.querySelector("#plan-summary"),
  dashboardCopy: document.querySelector("#dashboard-copy"),
  snapshotHeading: document.querySelector("#snapshot-heading"),
  setupListHeading: document.querySelector("#setup-list-heading"),
  customerSection: document.querySelector("#customer-section"),
  fieldCustomerWrap: document.querySelector("#field-customer-wrap"),
  fieldNameLabel: document.querySelector("#field-name-label"),
  fieldAcresLabel: document.querySelector("#field-acres-label"),
  fieldNotesLabel: document.querySelector("#field-notes-label"),
  jobFormHeading: document.querySelector("#job-form-heading"),
  jobLocationLabel: document.querySelector("#job-location-label"),
  jobImplementLabel: document.querySelector("#job-implement-label"),
  jobAcresLabel: document.querySelector("#job-acres-label"),
  jobConditionsLabel: document.querySelector("#job-conditions-label"),
  jobCostHourLabel: document.querySelector("#job-cost-hour-label"),
  jobCostDistanceLabel: document.querySelector("#job-cost-distance-label"),
  jobCostDistance: document.querySelector("#job-cost-distance"),
  jobLoadsWrap: document.querySelector("#job-loads-wrap"),
  jobLoads: document.querySelector("#job-loads"),
  jobMaterialWrap: document.querySelector("#job-material-wrap"),
  jobMaterial: document.querySelector("#job-material"),
  setupBusinessLabel: document.querySelector("#setup-business-label"),
  setupBusinessName: document.querySelector("#setup-business-name"),
  setupMeasurementSystem: document.querySelector("#setup-measurement-system"),
  setupCurrencyCode: document.querySelector("#setup-currency-code"),
  setupEquipmentName: document.querySelector("#setup-equipment-name"),
  setupEquipmentModel: document.querySelector("#setup-equipment-model"),
  setupEquipmentHours: document.querySelector("#setup-equipment-hours"),
  setupOperatorName: document.querySelector("#setup-operator-name"),
  setupCustomerNameWrap: document.querySelector("#setup-customer-name-wrap"),
  setupCustomerName: document.querySelector("#setup-customer-name"),
  setupCustomerCompanyWrap: document.querySelector("#setup-customer-company-wrap"),
  setupCustomerCompany: document.querySelector("#setup-customer-company"),
  setupFieldNameLabel: document.querySelector("#setup-field-name-label"),
  setupFieldName: document.querySelector("#setup-field-name"),
  setupFieldAcresLabel: document.querySelector("#setup-field-acres-label"),
  setupFieldAcres: document.querySelector("#setup-field-acres"),
  setupImplementLabel: document.querySelector("#setup-implement-label"),
  setupImplementName: document.querySelector("#setup-implement-name"),
  setupFieldNotesLabel: document.querySelector("#setup-field-notes-label"),
  setupFieldNotes: document.querySelector("#setup-field-notes"),
  metricHoursLabel: document.querySelector("#metric-hours-label"),
  metricProductionLabel: document.querySelector("#metric-production-label"),
  metricFuelRateLabel: document.querySelector("#metric-fuel-rate-label")
});

function loadData(key, fallback) {
  try {
    const savedValue = localStorage.getItem(key);
    return savedValue ? JSON.parse(savedValue) : fallback;
  } catch (error) {
    console.error(`Could not load ${key}:`, error);
    return fallback;
  }
}

function loadEquipment() {
  const savedEquipment = loadData(STORAGE_KEYS.equipment, []);

  if (Array.isArray(savedEquipment)) {
    return savedEquipment;
  }

  return savedEquipment ? [savedEquipment] : [];
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeSyncMeta(syncMeta = {}) {
  return {
    status: syncMeta.status || "local",
    pending: Boolean(syncMeta.pending),
    lastLocalSaveAt: syncMeta.lastLocalSaveAt || null,
    lastSyncedAt: syncMeta.lastSyncedAt || null,
    message: syncMeta.message || "Saved locally"
  };
}

state.syncMeta = normalizeSyncMeta(state.syncMeta);

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value, decimals = 1) {
  return Number(value || 0).toFixed(decimals);
}

function normalizeSettings(settings = {}) {
  return {
    appMode: settings.appMode || null,
    setupComplete: Boolean(settings.setupComplete),
    businessName: settings.businessName || "",
    subscriptionPlan: settings.subscriptionPlan === "farm" ? "farm" : "free",
    measurementSystem: settings.measurementSystem || "us",
    currency: settings.currency || "USD"
  };
}

state.settings = normalizeSettings(state.settings);

if (!state.settings.setupComplete && (state.equipment.length || state.operators.length || state.fields.length)) {
  state.settings.setupComplete = true;
  saveData(STORAGE_KEYS.settings, state.settings);
}

function getAppMode() {
  return state.settings.appMode === "contracting" ? "contracting" : "farm";
}

function getModeCopy() {
  return APP_MODES[getAppMode()];
}

function isContractingMode() {
  return getAppMode() === "contracting";
}

function hasStarterRecords() {
  return Boolean(state.equipment.length && state.operators.length && state.fields.length);
}

function shouldShowSetupWizard() {
  return Boolean(state.settings.appMode && !state.settings.setupComplete && !hasStarterRecords());
}

function getActivePlanKey() {
  return state.settings.subscriptionPlan === "farm" ? "farm" : "free";
}

function getActivePlan() {
  return SUBSCRIPTION_PLANS[getActivePlanKey()];
}

function hasPlanFeature(feature) {
  return Boolean(getActivePlan().features[feature]);
}

function getPlanLimit(limitName) {
  return getActivePlan().limits[limitName];
}

function formatLimit(limit) {
  return Number.isFinite(limit) ? String(limit) : "Unlimited";
}

function isAtPlanLimit(listName) {
  const limit = getPlanLimit(listName);
  return Number.isFinite(limit) && state[listName].length >= limit;
}

function planUpgradeMessage(featureName) {
  return `${featureName} is included with Unlimited at $9.99/month.`;
}

function currency(value) {
  return Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: state.settings.currency || "USD"
  });
}

function getPreferredDistanceUnit() {
  return state.settings.measurementSystem === "metric" ? "km" : "mi";
}

function getPreferredFuelUnit() {
  return state.settings.measurementSystem === "metric" ? "l" : "gal";
}

function distanceToMiles(value, unit = "mi") {
  const amount = Number(value || 0);
  return unit === "km" ? amount / UNIT_FACTORS.kilometersPerMile : amount;
}

function milesToDistance(value, unit = getPreferredDistanceUnit()) {
  return unit === "km" ? Number(value || 0) * UNIT_FACTORS.kilometersPerMile : Number(value || 0);
}

function getDistanceForUnit(job, unit = getPreferredDistanceUnit()) {
  return milesToDistance(getJobDistanceMiles(job), unit);
}

function fuelToGallons(value, unit = "gal") {
  const amount = Number(value || 0);
  return unit === "l" ? amount / UNIT_FACTORS.litersPerGallon : amount;
}

function gallonsToFuel(value, unit = getPreferredFuelUnit()) {
  return unit === "l" ? Number(value || 0) * UNIT_FACTORS.litersPerGallon : Number(value || 0);
}

function getJobDistanceMiles(job) {
  return distanceToMiles(job.distance, job.distanceUnit || "mi");
}

function getJobFuelGallons(job) {
  return fuelToGallons(job.fuel, job.fuelUnit || "gal");
}

function unitLabel(unit) {
  return unit === "km" ? "km" : unit === "l" ? "L" : unit === "gal" ? "gal" : "mi";
}

function getDurationHours(start, end) {
  return (new Date(end) - new Date(start)) / 1000 / 60 / 60;
}

function dateTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function startOfThisWeek() {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isThisWeek(value) {
  return value && new Date(value) >= startOfThisWeek();
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  parts.push(`${String(minutes).padStart(2, "0")}m`);
  parts.push(`${String(seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}

function toDateTimeLocal(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 19);
}

function setDefaultJobTimes() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  document.querySelector("#job-start").value = toDateTimeLocal(oneHourAgo);
  document.querySelector("#job-end").value = toDateTimeLocal(now);
}

function showMessage(text, type = "") {
  elements.jobMessage.textContent = text;
  elements.jobMessage.className = `message ${type}`;
}

function showBackupMessage(text, type = "") {
  elements.backupMessage.textContent = text;
  elements.backupMessage.className = `message ${type}`;
}

function showCloudMessage(text, type = "") {
  elements.cloudMessage.textContent = text;
  elements.cloudMessage.className = `message ${type}`;
}

function showPlanUpgrade(featureName) {
  const message = planUpgradeMessage(featureName);
  showBackupMessage(message, "error");
  showCloudMessage(message, "error");
  alert(message);
}

function persist(key) {
  saveData(STORAGE_KEYS[key], state[key]);

  if (key !== "cloudSession" && key !== "syncMeta" && !suppressSyncTracking) {
    markLocalChange();
  }
}

function isCloudSyncReady() {
  return hasPlanFeature("cloudSync") && Boolean(state.cloudSession?.token);
}

function isBrowserOffline() {
  return window.navigator && window.navigator.onLine === false;
}

function getSyncStatusText() {
  if (!hasPlanFeature("cloudSync") || !state.cloudSession?.token) {
    return "Saved locally";
  }

  if (state.syncMeta.status === "syncing") {
    return "Syncing...";
  }

  if (state.syncMeta.status === "synced" && !state.syncMeta.pending) {
    return "Synced";
  }

  if (state.syncMeta.status === "offline") {
    return "Offline -- will sync later";
  }

  if (state.syncMeta.status === "conflict") {
    return "Cloud copy is newer";
  }

  if (state.syncMeta.status === "error") {
    return "Sync needs attention";
  }

  return "Saved locally";
}

function renderSyncStatus() {
  const text = getSyncStatusText();
  elements.syncStatus.textContent = text;
  elements.cloudSyncStatus.textContent = text;
  elements.syncStatus.dataset.status = state.syncMeta.status || "local";
  elements.cloudSyncStatus.dataset.status = state.syncMeta.status || "local";
}

function setSyncMeta(updates) {
  state.syncMeta = normalizeSyncMeta({
    ...state.syncMeta,
    ...updates
  });
  saveData(STORAGE_KEYS.syncMeta, state.syncMeta);
  renderSyncStatus();
}

function scheduleAutoSync() {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }

  if (!isCloudSyncReady()) {
    renderSyncStatus();
    return;
  }

  if (isBrowserOffline()) {
    setSyncMeta({
      status: "offline",
      pending: true,
      message: "Offline -- will sync later"
    });
    return;
  }

  autoSyncTimer = setTimeout(() => {
    syncLocalChanges();
  }, AUTO_SYNC_DELAY_MS);
}

function markLocalChange() {
  setSyncMeta({
    status: "local",
    pending: true,
    lastLocalSaveAt: new Date().toISOString(),
    message: "Saved locally"
  });
  scheduleAutoSync();
}

function persistWithoutSyncTracking(callback) {
  suppressSyncTracking = true;
  try {
    callback();
  } finally {
    suppressSyncTracking = false;
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function getEquipmentOptions() {
  return state.equipment;
}

function getEquipmentById(equipmentId) {
  return state.equipment.find((item) => item.id === equipmentId);
}

function getCustomerById(customerId) {
  return state.customers.find((item) => item.id === customerId);
}

function getCustomerForField(fieldId) {
  const field = state.fields.find((item) => item.id === fieldId);
  return field?.customerId ? getCustomerById(field.customerId) : null;
}

function getPrimaryEquipment() {
  return state.equipment[0] || null;
}

function getEquipmentHours() {
  return state.equipment.reduce((total, equipment) => total + Number(equipment.hours || 0), 0);
}

function getEquipmentFuelCapacityUnit(equipment) {
  return equipment.fuelCapacityUnit || "gal";
}

function formatFuelCapacity(equipment) {
  if (!equipment.fuelCapacity) {
    return "Not entered";
  }

  return `${number(equipment.fuelCapacity)} ${unitLabel(getEquipmentFuelCapacityUnit(equipment))}`;
}

function getJobFormData(jobId = id()) {
  return {
    id: jobId,
    fieldId: elements.jobField.value,
    equipmentId: elements.jobEquipment.value,
    implementId: elements.jobImplement.value,
    operatorId: elements.jobOperator.value,
    type: elements.jobType.value,
    start: elements.jobStart.value,
    end: elements.jobEnd.value,
    acres: Number(document.querySelector("#job-acres").value),
    distance: Number(elements.jobDistance.value || 0),
    distanceUnit: elements.jobDistanceUnit.value || getPreferredDistanceUnit(),
    fuel: Number(document.querySelector("#job-fuel").value),
    fuelUnit: elements.jobFuelUnit.value || getPreferredFuelUnit(),
    conditions: document.querySelector("#job-conditions").value.trim(),
    weather: document.querySelector("#job-weather").value.trim(),
    costPerHour: Number(document.querySelector("#job-cost-hour").value || 0),
    costPerDistance: Number(elements.jobCostDistance.value || 0),
    costDistanceUnit: elements.jobDistanceUnit.value || getPreferredDistanceUnit(),
    loads: Number(elements.jobLoads.value || 0),
    materialType: elements.jobMaterial.value.trim(),
    notes: document.querySelector("#job-notes").value.trim()
  };
}

function updateEquipmentHoursForJobChange(oldJob, newJob) {
  if (oldJob) {
    const oldEquipment = getEquipmentById(oldJob.equipmentId);
    if (oldEquipment) {
      oldEquipment.hours = Number(oldEquipment.hours || 0) - getDurationHours(oldJob.start, oldJob.end);
    }
  }

  const newEquipment = getEquipmentById(newJob.equipmentId);
  if (newEquipment) {
    newEquipment.hours = Number(newEquipment.hours || 0) + getDurationHours(newJob.start, newJob.end);
  }
}

function switchTab(tabName) {
  const tab = [...elements.tabs].find((item) => item.dataset.tab === tabName);
  const panel = document.querySelector(`#${tabName}`);

  if (!tab || !panel) {
    return;
  }

  elements.tabs.forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-selected", String(isActive));
  });
  elements.panels.forEach((item) => {
    const isActive = item === panel;
    item.classList.toggle("active", isActive);
    item.hidden = !isActive;
  });
  tab.classList.add("active");
  panel.classList.add("active");
}

function normalizeEquipmentReferences() {
  const primaryEquipment = getPrimaryEquipment();

  if (!primaryEquipment) {
    return;
  }

  let changedJobs = false;
  let changedMaintenance = false;

  state.jobs = state.jobs.map((job) => {
    if (job.equipmentId) {
      return job;
    }

    changedJobs = true;
    return { ...job, equipmentId: primaryEquipment.id };
  });

  state.maintenance = state.maintenance.map((item) => {
    if (item.equipmentId) {
      return item;
    }

    changedMaintenance = true;
    return { ...item, equipmentId: primaryEquipment.id };
  });

  if (changedJobs) {
    persist("jobs");
  }

  if (changedMaintenance) {
    persist("maintenance");
  }
}

function updateEditControls() {
  elements.saveEquipment.textContent = state.editingEquipmentId ? "Update Equipment" : "Save Equipment";
  elements.cancelEquipmentEdit.hidden = !state.editingEquipmentId;
  elements.saveField.textContent = state.editingFieldId ? "Update Field" : "Add Field";
  elements.cancelFieldEdit.hidden = !state.editingFieldId;
  elements.saveCustomer.textContent = state.editingCustomerId ? "Update Customer" : "Add Customer";
  elements.cancelCustomerEdit.hidden = !state.editingCustomerId;
  elements.saveOperator.textContent = state.editingOperatorId ? "Update Operator" : "Add Operator";
  elements.cancelOperatorEdit.hidden = !state.editingOperatorId;
  elements.saveImplement.textContent = state.editingImplementId ? "Update Implement" : "Add Implement";
  elements.cancelImplementEdit.hidden = !state.editingImplementId;
  elements.saveJob.textContent = state.editingJobId ? "Update Job" : "Save Job";
  elements.cancelJobEdit.hidden = !state.editingJobId;
  elements.saveMaintenance.textContent = state.editingMaintenanceId ? "Update Reminder" : "Add Reminder";
  elements.cancelMaintenanceEdit.hidden = !state.editingMaintenanceId;
}

function formatSyncTime(value) {
  return value ? new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }) : "Never";
}

function saveCloudSession(session) {
  state.cloudSession = session;
  persist("cloudSession");
  renderAll();

  if (state.syncMeta.pending && !isAutoSyncing) {
    scheduleAutoSync();
  }
}

function renderCloudAccount() {
  const session = state.cloudSession;
  const isConnected = Boolean(session?.token);
  const canSync = hasPlanFeature("cloudSync");
  const registerFarm = document.querySelector("#register-farm");
  elements.cloudStatus.textContent = canSync
    ? (isConnected ? "Connected to Tractor Tracker sync." : "Local-only mode. Start the Tractor Tracker server to use accounts and sync.")
    : planUpgradeMessage("Cloud backup and device syncing");
  elements.cloudFarmName.textContent = session?.farmName || "Not connected";
  elements.cloudAccountEmail.textContent = session?.email || "Not connected";
  elements.cloudLastSync.textContent = formatSyncTime(session?.lastSync);
  elements.logoutAccount.hidden = !isConnected;
  elements.uploadCloud.disabled = !isConnected || !canSync;
  elements.downloadCloud.disabled = !isConnected || !canSync;
  elements.registerForm.hidden = isConnected;
  elements.loginForm.hidden = isConnected;

  if (!registerFarm.value) {
    registerFarm.value = state.settings.businessName || "Home Farm";
  }
}

function renderSubscriptionPlan() {
  const planKey = getActivePlanKey();
  const plan = getActivePlan();
  elements.subscriptionPrice.textContent = plan.price;
  elements.subscriptionStatus.textContent = `${plan.name} plan is active. ${planKey === "farm" ? "Unlimited equipment, operators, and sites are unlocked." : "Upgrade to Unlimited for unlimited records, cloud sync, advanced reports, and full export tools."}`;
  elements.freePlanCard.classList.toggle("active-plan", planKey === "free");
  elements.farmPlanCard.classList.toggle("active-plan", planKey === "farm");
  elements.useFreePlan.disabled = planKey === "free";
  elements.activateFarmPlan.disabled = planKey === "farm";
  elements.exportCsv.disabled = !hasPlanFeature("exportTools");
  elements.exportMaintenanceCsv.disabled = !hasPlanFeature("exportTools");
  elements.downloadBackup.disabled = !hasPlanFeature("exportTools");
  elements.restoreBackup.disabled = !hasPlanFeature("exportTools");
  elements.exportCsv.title = hasPlanFeature("exportTools") ? "" : planUpgradeMessage("CSV export");
  elements.exportMaintenanceCsv.title = hasPlanFeature("exportTools") ? "" : planUpgradeMessage("Maintenance CSV export");
  elements.downloadBackup.title = hasPlanFeature("exportTools") ? "" : planUpgradeMessage("Backup download");
  elements.restoreBackup.title = hasPlanFeature("exportTools") ? "" : planUpgradeMessage("Backup restore");
}

function renderMeasurementSettings() {
  elements.settingsBusinessName.value = state.settings.businessName || "";
  elements.appMode.value = getAppMode();
  elements.measurementSystem.value = state.settings.measurementSystem || "us";
  elements.currencyCode.value = state.settings.currency || "USD";

  if (!state.editingJobId && !state.activeJob) {
    elements.equipmentFuelCapacityUnit.value = getPreferredFuelUnit();
    elements.jobDistanceUnit.value = getPreferredDistanceUnit();
    elements.jobFuelUnit.value = getPreferredFuelUnit();
  }
}

function renderJobTypeOptions() {
  const currentValue = elements.jobType.value;
  const mode = getModeCopy();
  elements.jobType.innerHTML = '<option value="">Choose a job</option>';
  mode.jobTypes.forEach((jobType) => {
    const option = document.createElement("option");
    option.textContent = jobType;
    option.value = jobType;
    elements.jobType.appendChild(option);
  });

  if (currentValue && !mode.jobTypes.includes(currentValue)) {
    const option = document.createElement("option");
    option.textContent = currentValue;
    option.value = currentValue;
    elements.jobType.appendChild(option);
  }

  elements.jobType.value = currentValue;
}

function renderAppModeContent() {
  const mode = getModeCopy();
  const plan = getActivePlan();
  const equipmentLimit = getPlanLimit("equipment");
  const operatorLimit = getPlanLimit("operators");
  const fieldLimit = getPlanLimit("fields");
  const selectedDistanceUnit = elements.jobDistanceUnit.value || getPreferredDistanceUnit();
  const distanceUnit = unitLabel(selectedDistanceUnit);
  const modeWasChosen = Boolean(state.settings.appMode);

  document.body.dataset.appMode = getAppMode();
  document.body.dataset.subscriptionPlan = getActivePlanKey();
  elements.modeChooser.hidden = modeWasChosen;
  elements.setupWizard.hidden = !shouldShowSetupWizard();
  elements.appSubtitle.textContent = mode.subtitle;
  elements.planName.textContent = `${plan.name} Plan`;
  elements.planSummary.textContent = getActivePlanKey() === "farm"
    ? `Unlimited machines / operators / ${mode.locationPlural}`
    : `${formatLimit(equipmentLimit)} machine / ${formatLimit(operatorLimit)} operator / ${formatLimit(fieldLimit)} ${mode.locationPlural}`;
  elements.dashboardCopy.textContent = mode.dashboardCopy;
  elements.snapshotHeading.textContent = mode.snapshotHeading;
  elements.setupListHeading.textContent = mode.setupHeading;
  elements.fieldNameLabel.textContent = mode.locationNameLabel;
  elements.fieldAcresLabel.textContent = mode.areaLabel;
  elements.fieldNotesLabel.textContent = mode.notesLabel;
  elements.jobFormHeading.textContent = mode.jobHeading;
  elements.jobLocationLabel.textContent = mode.locationLabel;
  elements.jobImplementLabel.textContent = mode.implementLabel;
  elements.jobAcresLabel.textContent = mode.areaJobLabel;
  elements.jobConditionsLabel.textContent = mode.conditionsLabel;
  elements.jobCostHourLabel.textContent = mode.costHourLabel;
  elements.jobCostDistanceLabel.textContent = `Cost per ${selectedDistanceUnit === "km" ? "kilometer" : "mile"}`;
  elements.metricProductionLabel.textContent = mode.productionLabel;
  elements.metricFuelRateLabel.textContent = mode.fuelRateLabel;
  elements.fieldAcres.required = mode.areaRequired;
  document.querySelector("#field-name").placeholder = mode.locationPlaceholder;
  elements.fieldAcres.placeholder = mode.areaRequired ? "80" : "Optional";
  document.querySelector("#field-notes").placeholder = mode.notesPlaceholder;
  document.querySelector("#implement-name").placeholder = mode.implementPlaceholder;
  document.querySelector("#job-conditions").placeholder = mode.conditionsPlaceholder;
  elements.setupBusinessLabel.textContent = isContractingMode() ? "Business name" : "Farm name";
  elements.settingsBusinessLabel.textContent = isContractingMode() ? "Business name" : "Farm name";
  elements.setupBusinessName.placeholder = isContractingMode() ? "Carter Contracting" : "Home Farm";
  elements.settingsBusinessName.placeholder = elements.setupBusinessName.placeholder;
  elements.setupEquipmentName.placeholder = isContractingMode() ? "Main Truck" : "Main Tractor";
  elements.setupEquipmentModel.placeholder = isContractingMode() ? "Freightliner M2" : "John Deere 4440";
  elements.setupFieldNameLabel.textContent = `First ${mode.locationSingular}`;
  elements.setupFieldName.placeholder = mode.locationPlaceholder;
  elements.setupFieldAcresLabel.textContent = mode.areaLabel;
  elements.setupFieldAcres.required = mode.areaRequired;
  elements.setupFieldAcres.placeholder = mode.areaRequired ? "80" : "Optional";
  elements.setupImplementLabel.textContent = `Primary ${mode.implementLabel.toLowerCase()}`;
  elements.setupImplementName.placeholder = mode.implementPlaceholder;
  elements.setupFieldNotesLabel.textContent = mode.notesLabel;
  elements.setupFieldNotes.placeholder = mode.notesPlaceholder;
  elements.customerSection.hidden = !isContractingMode();
  elements.fieldCustomerWrap.hidden = !isContractingMode();
  elements.setupCustomerNameWrap.hidden = !isContractingMode();
  elements.setupCustomerCompanyWrap.hidden = !isContractingMode();
  elements.setupCustomerName.required = isContractingMode();
  elements.setupCustomerName.placeholder = isContractingMode() ? "Customer name" : "";
  elements.setupCustomerCompany.placeholder = isContractingMode() ? "Company name" : "";
  elements.setupMeasurementSystem.value = state.settings.measurementSystem || "us";
  elements.setupCurrencyCode.value = state.settings.currency || "USD";
  elements.jobCostDistance.placeholder = `Optional ${distanceUnit} rate`;
  elements.jobLoadsWrap.hidden = !isContractingMode();
  elements.jobMaterialWrap.hidden = !isContractingMode();
  renderJobTypeOptions();
}

async function cloudRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.cloudSession?.token) {
    headers.Authorization = `Bearer ${state.cloudSession.token}`;
  }

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (error) {
    throw new Error("Could not reach the Tractor Tracker server. If you are testing locally, start server.py and open the app from the server address.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "Cloud sync failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function sessionFromPayload(payload, existingToken = null) {
  return {
    token: payload.token || existingToken || state.cloudSession?.token,
    email: payload.email,
    farmId: payload.farm?.id,
    farmName: payload.farm?.name,
    lastSync: payload.farm?.updatedAt || new Date().toISOString(),
    expiresAt: payload.expiresAt || state.cloudSession?.expiresAt
  };
}

async function uploadFarmToCloud() {
  if (!hasPlanFeature("cloudSync")) {
    showPlanUpgrade("Cloud backup and device syncing");
    return;
  }

  await syncLocalChanges({ manual: true });
}

async function syncLocalChanges({ manual = false } = {}) {
  if (!isCloudSyncReady()) {
    renderSyncStatus();
    return;
  }

  if (isAutoSyncing) {
    return;
  }

  if (isBrowserOffline()) {
    setSyncMeta({
      status: "offline",
      pending: true,
      message: "Offline -- will sync later"
    });
    return;
  }

  isAutoSyncing = true;
  setSyncMeta({
    status: "syncing",
    pending: true,
    message: "Syncing..."
  });

  const farmName = state.cloudSession?.farmName || state.settings.businessName || "Home Farm";
  try {
    const payload = await cloudRequest("/api/farm", {
      method: "POST",
      body: JSON.stringify({
        farmName,
        data: getBackupData(),
        baseUpdatedAt: state.cloudSession?.lastSync || null
      })
    });
    saveCloudSession(sessionFromPayload(payload));
    setSyncMeta({
      status: "synced",
      pending: false,
      lastSyncedAt: payload.farm?.updatedAt || new Date().toISOString(),
      message: "Synced"
    });
    showCloudMessage(manual ? "This device is synced." : "Synced.", "success");
  } catch (error) {
    if (error.status === 409) {
      const cloudUpdatedAt = error.payload?.farm?.updatedAt;
      setSyncMeta({
        status: "conflict",
        pending: true,
        message: "Cloud copy is newer"
      });
      showCloudMessage(`Cloud copy is newer${cloudUpdatedAt ? ` (${formatSyncTime(cloudUpdatedAt)})` : ""}. Download Cloud Copy before uploading this device.`, "error");
    } else {
      setSyncMeta({
        status: "offline",
        pending: true,
        message: "Offline -- will sync later"
      });
      showCloudMessage("Offline -- local changes will sync later.", "error");
    }
  } finally {
    isAutoSyncing = false;
  }
}

async function downloadFarmFromCloud() {
  if (!hasPlanFeature("cloudSync")) {
    showPlanUpgrade("Cloud backup and device syncing");
    return;
  }

  const payload = await cloudRequest("/api/farm");
  const restoredData = normalizeRestoredBackup(payload.farm.data);
  restoreFarmBackup(restoredData, { source: "cloud", cloudUpdatedAt: payload.farm.updatedAt });
  saveCloudSession(sessionFromPayload(payload));
  setSyncMeta({
    status: "synced",
    pending: false,
    lastSyncedAt: payload.farm.updatedAt,
    message: "Synced"
  });
  showCloudMessage("Cloud copy downloaded to this device.", "success");
}

function clearEditState() {
  state.editingEquipmentId = null;
  state.editingFieldId = null;
  state.editingCustomerId = null;
  state.editingOperatorId = null;
  state.editingImplementId = null;
  state.editingJobId = null;
  state.editingMaintenanceId = null;
  elements.equipmentForm.reset();
  elements.fieldForm.reset();
  elements.customerForm.reset();
  elements.operatorForm.reset();
  elements.implementForm.reset();
  elements.jobForm.reset();
  elements.maintenanceForm.reset();
}

function getBackupData() {
  return {
    equipment: state.equipment,
    fields: state.fields,
    customers: state.customers,
    operators: state.operators,
    implements: state.implements,
    jobs: state.jobs,
    activeJob: state.activeJob,
    maintenance: state.maintenance,
    maintenanceHistory: state.maintenanceHistory,
    settings: state.settings
  };
}

function createFarmBackup() {
  return {
    app: "Tractor Tracker",
    version: 10,
    exportedAt: new Date().toISOString(),
    data: getBackupData()
  };
}

function normalizeRestoredBackup(parsedBackup) {
  const restoredData = parsedBackup?.data || parsedBackup;
  const requiredLists = ["fields", "operators", "implements", "jobs", "maintenance"];

  if (!restoredData || typeof restoredData !== "object") {
    throw new Error("That file does not look like a Tractor Tracker backup.");
  }

  requiredLists.forEach((key) => {
    if (!Array.isArray(restoredData[key])) {
      throw new Error(`The backup is missing ${key}.`);
    }
  });

  if (
    restoredData.equipment !== null &&
    !Array.isArray(restoredData.equipment) &&
    !(restoredData.equipment && typeof restoredData.equipment === "object")
  ) {
    throw new Error("The backup is missing equipment.");
  }

  return {
    equipment: Array.isArray(restoredData.equipment) ? restoredData.equipment : restoredData.equipment ? [restoredData.equipment] : [],
    fields: restoredData.fields,
    customers: Array.isArray(restoredData.customers) ? restoredData.customers : [],
    operators: restoredData.operators,
    implements: restoredData.implements,
    jobs: restoredData.jobs,
    activeJob: restoredData.activeJob || null,
    maintenance: restoredData.maintenance,
    maintenanceHistory: Array.isArray(restoredData.maintenanceHistory) ? restoredData.maintenanceHistory : [],
    settings: normalizeSettings(restoredData.settings || {})
  };
}

function restoreFarmBackup(restoredData, options = {}) {
  state.equipment = restoredData.equipment;
  state.fields = restoredData.fields;
  state.customers = restoredData.customers;
  state.operators = restoredData.operators;
  state.implements = restoredData.implements;
  state.jobs = restoredData.jobs;
  state.activeJob = restoredData.activeJob;
  state.maintenance = restoredData.maintenance;
  state.maintenanceHistory = restoredData.maintenanceHistory;
  state.settings = restoredData.settings;
  clearEditState();
  persistWithoutSyncTracking(() => {
    ["equipment", "fields", "customers", "operators", "implements", "jobs", "activeJob", "maintenance", "maintenanceHistory", "settings"].forEach((key) => persist(key));
    normalizeEquipmentReferences();
  });

  if (!state.activeJob) {
    setDefaultJobTimes();
  }

  renderAll();

  if (options.source === "cloud") {
    setSyncMeta({
      status: "synced",
      pending: false,
      lastSyncedAt: options.cloudUpdatedAt || new Date().toISOString(),
      message: "Synced"
    });
  } else {
    markLocalChange();
  }
}

function renderSelect(select, options, placeholder, labelKey = "name") {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.id;
    optionElement.textContent = option[labelKey];
    select.appendChild(optionElement);
  });
}

function renderEquipment() {
  if (!state.equipment.length) {
    elements.equipmentDisplay.className = "saved-item empty-state";
    elements.equipmentDisplay.textContent = "No equipment saved yet.";
    renderSelect(elements.jobEquipment, [], "Save equipment first");
    renderSelect(elements.maintenanceEquipment, [], "Save equipment first");
    return;
  }

  elements.equipmentDisplay.className = "equipment-list";
  elements.equipmentDisplay.innerHTML = "";

  state.equipment.forEach((equipment) => {
    const jobs = state.jobs.filter((job) => job.equipmentId === equipment.id);
    const totals = jobs.reduce((summary, job) => {
      summary.acres += Number(job.acres || 0);
      summary.hours += getDurationHours(job.start, job.end);
      return summary;
    }, { acres: 0, hours: 0 });
    const maintenanceItems = state.maintenance.filter((item) => item.equipmentId === equipment.id);
    const recentJobs = jobs
      .slice(-3)
      .reverse()
      .map((job) => {
        const details = getJobDetails(job);
        return `<li>${escapeHtml(job.type)} - ${escapeHtml(details.fieldName)} (${number(details.duration)} hrs)</li>`;
      })
      .join("");

    elements.equipmentDisplay.insertAdjacentHTML("beforeend", `
      <article class="list-item">
        <div class="list-item-row">
          <div>
            <h3>${escapeHtml(equipment.name)}</h3>
            <p>${escapeHtml(equipment.year || "")} ${escapeHtml(equipment.model)}</p>
            <p><strong>Engine hours:</strong> ${number(equipment.hours)} / <strong>Jobs:</strong> ${jobs.length} / <strong>Acres:</strong> ${number(totals.acres)}</p>
            <p><strong>Field hours on record:</strong> ${number(totals.hours)} / <strong>Maintenance reminders:</strong> ${maintenanceItems.length}</p>
            <p><strong>Serial:</strong> ${escapeHtml(equipment.serial || "Not entered")}</p>
            <p><strong>Fuel capacity:</strong> ${escapeHtml(formatFuelCapacity(equipment))}</p>
            ${equipment.notes ? `<p><strong>Repair notes:</strong> ${escapeHtml(equipment.notes)}</p>` : ""}
            ${recentJobs ? `<ul class="mini-list">${recentJobs}</ul>` : '<p class="muted-text">No jobs logged for this machine yet.</p>'}
          </div>
          <div class="item-actions">
            <button class="small-button secondary-button" data-edit-equipment="${equipment.id}" type="button">Edit</button>
            <button class="small-button ghost-button" data-delete-equipment="${equipment.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `);
  });

  renderSelect(elements.jobEquipment, getEquipmentOptions(), "Choose equipment");
  renderSelect(elements.maintenanceEquipment, getEquipmentOptions(), "Choose equipment");
}

function renderCustomers() {
  renderSelect(elements.fieldCustomer, state.customers, "Choose a customer");
  elements.customerList.innerHTML = "";

  if (!isContractingMode()) {
    return;
  }

  if (!state.customers.length) {
    elements.customerList.innerHTML = '<div class="empty-state">No customers added yet.</div>';
    return;
  }

  state.customers.forEach((customer) => {
    const customerFields = state.fields.filter((field) => field.customerId === customer.id);
    const customerFieldIds = new Set(customerFields.map((field) => field.id));
    const customerJobs = state.jobs.filter((job) => customerFieldIds.has(job.fieldId));
    const customerRevenue = customerJobs.reduce((total, job) => total + getJobDetails(job).cost, 0);

    elements.customerList.insertAdjacentHTML("beforeend", `
      <article class="list-item">
        <div class="list-item-row">
          <div>
            <h3>${escapeHtml(customer.name)}</h3>
            ${customer.company ? `<p><strong>Company:</strong> ${escapeHtml(customer.company)}</p>` : ""}
            ${customer.phone || customer.email ? `<p><strong>Contact:</strong> ${escapeHtml(customer.phone || "No phone")} / ${escapeHtml(customer.email || "No email")}</p>` : ""}
            ${customer.address ? `<p><strong>Billing address:</strong> ${escapeHtml(customer.address)}</p>` : ""}
            <p><strong>Job sites:</strong> ${customerFields.length} / <strong>Job history:</strong> ${customerJobs.length}</p>
            <p><strong>Outstanding balance:</strong> ${currency(customer.outstandingBalance || 0)} / <strong>Recorded revenue:</strong> ${currency(customerRevenue)}</p>
          </div>
          <div class="item-actions">
            <button class="small-button secondary-button" data-edit-customer="${customer.id}" type="button">Edit</button>
            <button class="small-button ghost-button" data-delete-customer="${customer.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `);
  });
}

function renderFields() {
  const mode = getModeCopy();
  elements.fieldList.innerHTML = "";
  renderSelect(
    elements.jobField,
    state.fields.map((field) => ({
      ...field,
      name: `${field.name}${isContractingMode() && getCustomerById(field.customerId) ? ` - ${getCustomerById(field.customerId).name}` : ""}${field.acres ? ` (${number(field.acres)} acres)` : ""}`
    })),
    `Choose a ${mode.locationSingular}`
  );

  if (!state.fields.length) {
    elements.fieldList.innerHTML = `<div class="empty-state">No ${mode.locationPlural} added yet.</div>`;
    return;
  }

  state.fields.forEach((field) => {
    const customer = getCustomerById(field.customerId);
    elements.fieldList.insertAdjacentHTML("beforeend", `
      <article class="list-item">
        <div class="list-item-row">
          <div>
            <h3>${escapeHtml(field.name)}</h3>
            ${isContractingMode() && customer ? `<p><strong>Customer:</strong> ${escapeHtml(customer.name)}${customer.company ? ` / ${escapeHtml(customer.company)}` : ""}</p>` : ""}
            ${field.acres ? `<p>${number(field.acres)} acres</p>` : ""}
            ${field.notes ? `<p>${escapeHtml(field.notes)}</p>` : ""}
          </div>
          <div class="item-actions">
            <button class="small-button secondary-button" data-edit-field="${field.id}" type="button">Edit</button>
            <button class="small-button ghost-button" data-delete-field="${field.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `);
  });
}

function renderChips() {
  const mode = getModeCopy();
  renderChipList(elements.operatorList, state.operators, "No operator added yet.", "operator");
  renderChipList(elements.implementList, state.implements, `No ${mode.implementLabel.toLowerCase()}s added yet.`, "implement");
  renderSelect(elements.jobOperator, state.operators, "Choose an operator");
  renderSelect(elements.jobImplement, state.implements, `Choose an ${mode.implementLabel.toLowerCase()}`);
}

function renderChipList(container, items, emptyText, type) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<span class="empty-state">${emptyText}</span>`;
    return;
  }

  items.forEach((item) => {
    container.insertAdjacentHTML("beforeend", `
      <span class="chip">
        ${escapeHtml(item.name)}
        <button class="small-button secondary-button" data-edit-${type}="${item.id}" type="button">Edit</button>
        <button class="small-button ghost-button" data-delete-${type}="${item.id}" type="button">Remove</button>
      </span>
    `);
  });
}

function getJobDetails(job) {
  const field = state.fields.find((item) => item.id === job.fieldId);
  const customer = getCustomerForField(job.fieldId);
  const equipment = getEquipmentById(job.equipmentId);
  const operator = state.operators.find((item) => item.id === job.operatorId);
  const implement = state.implements.find((item) => item.id === job.implementId);
  const duration = getDurationHours(job.start, job.end);
  const fuelGallons = getJobFuelGallons(job);
  const fuelLiters = gallonsToFuel(fuelGallons, "l");
  const distanceMiles = getJobDistanceMiles(job);
  const distanceKm = milesToDistance(distanceMiles, "km");
  const costDistanceUnit = job.costDistanceUnit || job.distanceUnit || "mi";
  const distanceForRate = getDistanceForUnit(job, costDistanceUnit);
  const hourlyCost = duration * Number(job.costPerHour || 0);
  const distanceCost = distanceForRate * Number(job.costPerDistance || 0);
  const cost = hourlyCost + distanceCost;

  return {
    fieldName: field?.name || "Deleted field",
    customerName: customer?.name || "",
    customerCompany: customer?.company || "",
    equipmentName: equipment?.name || "Deleted equipment",
    operatorName: operator?.name || "Deleted operator",
    implementName: implement?.name || "Deleted implement",
    duration,
    acresPerHour: duration > 0 ? job.acres / duration : 0,
    fuelGallons,
    fuelLiters,
    fuelPerAcre: job.acres > 0 ? gallonsToFuel(fuelGallons) / job.acres : 0,
    distanceMiles,
    distanceKm,
    milesPerGallon: fuelGallons > 0 ? distanceMiles / fuelGallons : 0,
    kilometersPerLiter: fuelLiters > 0 ? distanceKm / fuelLiters : 0,
    litersPer100Km: distanceKm > 0 ? (fuelLiters / distanceKm) * 100 : 0,
    cost,
    hourlyCost,
    distanceCost,
    costPerAcre: job.acres > 0 ? cost / job.acres : 0,
    costPerMile: distanceMiles > 0 ? cost / distanceMiles : 0,
    costPerKm: distanceKm > 0 ? cost / distanceKm : 0
  };
}

function getActiveJobNames(job) {
  const field = state.fields.find((item) => item.id === job.fieldId);
  const equipment = getEquipmentById(job.equipmentId);
  const implement = state.implements.find((item) => item.id === job.implementId);
  const operator = state.operators.find((item) => item.id === job.operatorId);

  return {
    fieldName: field?.name || "Selected field",
    equipmentName: equipment?.name || "Selected equipment",
    implementName: implement?.name || "Selected implement",
    operatorName: operator?.name || "Selected operator"
  };
}

function lockJobSetup(isLocked) {
  [
    elements.jobField,
    elements.jobEquipment,
    elements.jobImplement,
    elements.jobOperator,
    elements.jobType,
    elements.jobStart,
    elements.jobEnd
  ].forEach((control) => {
    control.disabled = isLocked;
  });
}

function syncActiveJobForm() {
  if (!state.activeJob) {
    return;
  }

  elements.jobField.value = state.activeJob.fieldId;
  elements.jobEquipment.value = state.activeJob.equipmentId;
  elements.jobImplement.value = state.activeJob.implementId;
  elements.jobOperator.value = state.activeJob.operatorId;
  elements.jobType.value = state.activeJob.type;
  elements.jobStart.value = state.activeJob.start;
  elements.jobEnd.value = "";
}

function updateJobTimer() {
  const isActive = Boolean(state.activeJob);
  elements.activeJobTimer.classList.toggle("active", isActive);
  elements.startJob.disabled = isActive;
  elements.finishJob.disabled = !isActive;
  elements.cancelJob.disabled = !isActive;
  lockJobSetup(isActive);

  if (!isActive) {
    elements.jobTimerElapsed.textContent = "Ready";
    elements.jobTimerSummary.textContent = getModeCopy().timerSummary;
    return;
  }

  const names = getActiveJobNames(state.activeJob);
  const start = new Date(state.activeJob.start);
  elements.jobTimerElapsed.textContent = formatElapsed(Date.now() - start.getTime());
  elements.jobTimerSummary.textContent = `${state.activeJob.type} at ${names.fieldName} with ${names.equipmentName} and ${names.implementName}. ${names.operatorName} started at ${dateTime(state.activeJob.start)}.`;
}

function renderActiveJobTimer() {
  syncActiveJobForm();
  updateJobTimer();
}

function renderJobs() {
  elements.jobList.innerHTML = "";

  if (!state.jobs.length) {
    const empty = '<div class="empty-state">No jobs recorded yet.</div>';
    elements.jobList.innerHTML = empty;
    return;
  }

  [...state.jobs].reverse().forEach((job) => {
    const mode = getModeCopy();
    const details = getJobDetails(job);
    const distanceLine = details.distanceMiles > 0 ? `<p><strong>Distance:</strong> ${number(job.distance)} ${unitLabel(job.distanceUnit || "mi")} / <strong>Fuel economy:</strong> ${state.settings.measurementSystem === "metric" ? `${number(details.litersPer100Km, 2)} L/100 km` : `${number(details.milesPerGallon, 2)} MPG`} / <strong>Cost:</strong> ${state.settings.measurementSystem === "metric" ? `${currency(details.costPerKm)}/km` : `${currency(details.costPerMile)}/mi`}</p>` : "";
    const areaLine = job.acres ? `<strong>Acres:</strong> ${number(job.acres)} / ` : "";
    const contractorDetails = [
      job.loads ? `<strong>Loads hauled:</strong> ${number(job.loads, 0)}` : "",
      job.materialType ? `<strong>Material:</strong> ${escapeHtml(job.materialType)}` : ""
    ].filter(Boolean).join(" / ");
    const contractorLine = isContractingMode() && contractorDetails
      ? `<p>${contractorDetails}</p>`
      : "";
    const customerLine = isContractingMode() && (details.customerName || details.customerCompany)
      ? `<p><strong>Customer:</strong> ${escapeHtml(details.customerName || details.customerCompany)}${details.customerCompany && details.customerCompany !== details.customerName ? ` / ${escapeHtml(details.customerCompany)}` : ""}</p>`
      : "";
    const costLine = isContractingMode()
      ? `<p><strong>Billing total:</strong> ${currency(details.cost)} / <strong>Hourly:</strong> ${currency(job.costPerHour || 0)}/hr / <strong>Distance:</strong> ${currency(job.costPerDistance || 0)}/${unitLabel(job.costDistanceUnit || job.distanceUnit || getPreferredDistanceUnit())}</p>`
      : `<p><strong>Fuel rate:</strong> ${number(details.fuelPerAcre, 2)} ${unitLabel(getPreferredFuelUnit())}/acre / <strong>Cost/acre:</strong> ${currency(details.costPerAcre)}</p>`;
    const markup = `
      <article class="list-item">
        <div class="list-item-row">
          <div>
            <h3>${escapeHtml(job.type)} - ${escapeHtml(details.fieldName)}</h3>
            ${customerLine}
            <p><strong>Time:</strong> ${dateTime(job.start)} to ${dateTime(job.end)} (${number(details.duration)} hrs)</p>
            <p><strong>Equipment:</strong> ${escapeHtml(details.equipmentName)} / <strong>Operator:</strong> ${escapeHtml(details.operatorName)} / <strong>Implement:</strong> ${escapeHtml(details.implementName)}</p>
            <p>${areaLine}<strong>Fuel:</strong> ${number(job.fuel)} ${unitLabel(job.fuelUnit || "gal")} / <strong>Work rate:</strong> ${job.acres ? `${number(details.acresPerHour)} acres/hr` : `${number(details.duration)} hrs`}</p>
            ${contractorLine}
            ${costLine}
            ${distanceLine}
            ${job.conditions || job.weather ? `<p><strong>Conditions:</strong> ${escapeHtml(job.conditions || "Not entered")} / ${escapeHtml(job.weather || "Weather not entered")}</p>` : ""}
            ${job.notes ? `<p><strong>Notes:</strong> ${escapeHtml(job.notes)}</p>` : ""}
          </div>
          <div class="item-actions">
            <button class="small-button secondary-button" data-edit-job="${job.id}" type="button">Edit</button>
            <button class="small-button ghost-button" data-delete-job="${job.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `;
    elements.jobList.insertAdjacentHTML("beforeend", markup);

  });
}

function renderMaintenance() {
  elements.maintenanceList.innerHTML = "";

  if (!state.maintenance.length) {
    elements.maintenanceList.innerHTML = '<div class="empty-state">No maintenance reminders yet.</div>';
    return;
  }

  state.maintenance
    .slice()
    .sort((a, b) => Number(a.dueHours) - Number(b.dueHours))
    .forEach((item) => {
      const equipment = getEquipmentById(item.equipmentId) || getPrimaryEquipment();
      const currentHours = Number(equipment?.hours || 0);
      const hoursLeft = Number(item.dueHours) - currentHours;
      const isDue = hoursLeft <= 0;
      const latestCompletion = state.maintenanceHistory
        .filter((record) => record.reminderId === item.id && record.equipmentId === equipment?.id)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
      const isCompleted = Boolean(
        !isDue
        && latestCompletion
        && Number(latestCompletion.nextDueHours || 0) === Number(item.dueHours || 0)
      );
      const status = isDue ? "Due now" : isCompleted ? "Done" : `${number(hoursLeft)} hours left`;
      const className = isDue ? "due" : isCompleted ? "done" : hoursLeft <= 10 ? "warn" : "";
      const doneDisabled = isDue ? "" : `disabled title="Already marked done. Due again at ${number(item.dueHours)} engine hours."`;
      const doneButtonText = isCompleted ? "Completed" : "Done";
      const completionNote = isCompleted
        ? `<p><strong>Done:</strong> ${dateTime(latestCompletion.completedAt)} at ${number(latestCompletion.completedHours)} engine hours. Next due in ${number(hoursLeft)} hours.</p>`
        : "";

      elements.maintenanceList.insertAdjacentHTML("beforeend", `
        <article class="list-item">
          <div class="list-item-row">
            <div>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(equipment?.name || "Deleted equipment")} / Due at ${number(item.dueHours)} engine hours${item.dueDate ? ` / ${escapeHtml(item.dueDate)}` : ""}</p>
              <span class="status-pill ${className}">${status}</span>
              ${completionNote}
              ${item.cost ? `<p><strong>Estimated cost:</strong> ${currency(item.cost)}</p>` : ""}
              ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ""}
            </div>
            <div class="item-actions">
              <button class="small-button secondary-button" data-edit-maintenance="${item.id}" type="button">Edit</button>
              <button class="small-button secondary-button" data-complete-maintenance="${item.id}" type="button" ${doneDisabled}>${doneButtonText}</button>
              <button class="small-button ghost-button" data-delete-maintenance="${item.id}" type="button">Delete</button>
            </div>
          </div>
        </article>
      `);
    });
}

function getTotals() {
  return state.jobs.reduce((totals, job) => {
    const details = getJobDetails(job);
    totals.acres += Number(job.acres || 0);
    totals.fuel += details.fuelGallons;
    totals.distanceMiles += details.distanceMiles;
    totals.hours += details.duration;
    totals.cost += details.cost;
    totals.loads += Number(job.loads || 0);
    return totals;
  }, { acres: 0, fuel: 0, distanceMiles: 0, hours: 0, cost: 0, loads: 0 });
}

function getWeeklyTotals() {
  return state.jobs
    .filter((job) => isThisWeek(job.end || job.start))
    .reduce((totals, job) => {
      const details = getJobDetails(job);
      totals.acres += Number(job.acres || 0);
      totals.fuel += details.fuelGallons;
      totals.distanceMiles += details.distanceMiles;
      totals.hours += details.duration;
      totals.cost += details.cost;
      totals.loads += Number(job.loads || 0);
      return totals;
    }, { acres: 0, fuel: 0, distanceMiles: 0, hours: 0, cost: 0, loads: 0 });
}

function getDueSoonMaintenance(limit = 3) {
  return state.maintenance
    .map((item) => {
      const equipment = getEquipmentById(item.equipmentId) || getPrimaryEquipment();
      const hoursLeft = Number(item.dueHours || 0) - Number(equipment?.hours || 0);
      return { ...item, equipmentName: equipment?.name || "Deleted equipment", hoursLeft };
    })
    .sort((a, b) => a.hoursLeft - b.hoursLeft)
    .slice(0, limit);
}

function getRecentWorkedLocations(limit = 4) {
  const recentByField = new Map();
  state.jobs.forEach((job) => {
    const details = getJobDetails(job);
    const previous = recentByField.get(job.fieldId);
    if (!previous || new Date(job.end) > new Date(previous.end)) {
      recentByField.set(job.fieldId, {
        name: details.fieldName,
        end: job.end,
        acres: Number(job.acres || 0),
        loads: Number(job.loads || 0),
        hours: details.duration
      });
    }
  });

  return [...recentByField.values()]
    .sort((a, b) => new Date(b.end) - new Date(a.end))
    .slice(0, limit);
}

function renderDashboardSnapshot() {
  const weekly = getWeeklyTotals();
  const displayFuel = gallonsToFuel(weekly.fuel);
  const displayDistance = milesToDistance(weekly.distanceMiles);
  const fuelUnit = unitLabel(getPreferredFuelUnit());
  const distanceUnit = unitLabel(getPreferredDistanceUnit());
  const activeText = state.activeJob ? `${escapeHtml(state.activeJob.type)} running` : "None";
  const unfinishedJobs = state.activeJob ? 1 : 0;

  if (isContractingMode()) {
    elements.dashboardSnapshot.innerHTML = `
      <article class="dashboard-card"><span>Active job sites</span><strong>${state.fields.length}</strong></article>
      <article class="dashboard-card"><span>Loads this week</span><strong>${number(weekly.loads, 0)}</strong></article>
      <article class="dashboard-card"><span>Billable hours</span><strong>${number(weekly.hours)}</strong></article>
      <article class="dashboard-card"><span>Distance traveled</span><strong>${number(displayDistance)} ${distanceUnit}</strong></article>
      <article class="dashboard-card"><span>Estimated revenue</span><strong>${currency(weekly.cost)}</strong></article>
      <article class="dashboard-card"><span>Unfinished jobs</span><strong>${unfinishedJobs}</strong></article>
    `;
    return;
  }

  const maintenanceItems = getDueSoonMaintenance();
  const maintenanceText = maintenanceItems.length
    ? maintenanceItems.map((item) => `${escapeHtml(item.name)}: ${number(item.hoursLeft)} hrs`).join("<br>")
    : "None";

  elements.dashboardSnapshot.innerHTML = `
    <article class="dashboard-card"><span>Acres this week</span><strong>${number(weekly.acres)}</strong></article>
    <article class="dashboard-card"><span>Fuel this week</span><strong>${number(displayFuel, 1)} ${fuelUnit}</strong></article>
    <article class="dashboard-card"><span>Maintenance coming due</span><p>${maintenanceText}</p></article>
    <article class="dashboard-card"><span>Active job</span><strong>${activeText}</strong></article>
  `;
}

function renderDashboardWork() {
  const locations = getRecentWorkedLocations();
  elements.recentJobs.innerHTML = "";

  if (state.activeJob) {
    const names = getActiveJobNames(state.activeJob);
    elements.recentJobs.insertAdjacentHTML("beforeend", `
      <article class="timeline-entry active-entry">
        <h3>Active job: ${escapeHtml(state.activeJob.type)}</h3>
        <p>${escapeHtml(names.fieldName)} / ${escapeHtml(names.equipmentName)}</p>
        <span class="status-pill due">Running now</span>
      </article>
    `);
  }

  if (!locations.length && !state.activeJob) {
    elements.recentJobs.innerHTML = `<div class="empty-state">No ${getModeCopy().locationPlural} worked yet.</div>`;
    return;
  }

  locations.forEach((location) => {
    elements.recentJobs.insertAdjacentHTML("beforeend", `
      <article class="timeline-entry">
        <h3>${escapeHtml(location.name)}</h3>
        <p>${isContractingMode() ? `${number(location.hours)} hrs${location.loads ? ` / ${number(location.loads, 0)} loads` : ""}` : `${number(location.acres)} acres / ${number(location.hours)} hrs`}</p>
        <span class="status-pill">${dateTime(location.end)}</span>
      </article>
    `);
  });
}

function renderReports() {
  const totals = getTotals();
  const displayFuel = gallonsToFuel(totals.fuel);
  const displayDistance = milesToDistance(totals.distanceMiles);
  const fuelPerAcre = totals.acres > 0 ? displayFuel / totals.acres : 0;
  const acresPerHour = totals.hours > 0 ? totals.acres / totals.hours : 0;
  const costPerAcre = totals.acres > 0 ? totals.cost / totals.acres : 0;
  const totalLiters = gallonsToFuel(totals.fuel, "l");
  const totalKm = milesToDistance(totals.distanceMiles, "km");
  const mpg = totals.fuel > 0 ? totals.distanceMiles / totals.fuel : 0;
  const kmPerLiter = totalLiters > 0 ? totalKm / totalLiters : 0;
  const litersPer100Km = totalKm > 0 ? (totalLiters / totalKm) * 100 : 0;
  const costPerDistance = displayDistance > 0 ? totals.cost / displayDistance : 0;
  const distanceUnit = getPreferredDistanceUnit();
  const fuelUnit = getPreferredFuelUnit();
  const upgradeCard = '<article class="report-card locked-card"><span>Unlimited</span><strong>Advanced reports</strong><p>Unlock fuel economy, cost per distance, billing totals, and full export tools.</p></article>';

  if (isContractingMode()) {
    const fuelPerHour = totals.hours > 0 ? displayFuel / totals.hours : 0;
    const costPerHour = totals.hours > 0 ? totals.cost / totals.hours : 0;

    if (!hasPlanFeature("advancedReports")) {
      elements.reportGrid.innerHTML = `
        <article class="report-card"><span>Total jobs</span><strong>${state.jobs.length}</strong></article>
        <article class="report-card"><span>Work hours</span><strong>${number(totals.hours)}</strong></article>
        <article class="report-card"><span>Loads hauled</span><strong>${number(totals.loads, 0)}</strong></article>
        <article class="report-card"><span>Hauling distance</span><strong>${number(displayDistance)} ${unitLabel(distanceUnit)}</strong></article>
        <article class="report-card"><span>Fuel per hour</span><strong>${number(fuelPerHour, 2)} ${unitLabel(fuelUnit)}</strong></article>
        <article class="report-card"><span>Job sites</span><strong>${state.fields.length}</strong></article>
        ${upgradeCard}
      `;
      return;
    }

    elements.reportGrid.innerHTML = `
      <article class="report-card"><span>Total jobs</span><strong>${state.jobs.length}</strong></article>
      <article class="report-card"><span>Work hours</span><strong>${number(totals.hours)}</strong></article>
      <article class="report-card"><span>Loads hauled</span><strong>${number(totals.loads, 0)}</strong></article>
      <article class="report-card"><span>Hauling distance</span><strong>${number(displayDistance)} ${unitLabel(distanceUnit)}</strong></article>
      <article class="report-card"><span>${state.settings.measurementSystem === "metric" ? "Kilometers per liter" : "Miles per gallon"}</span><strong>${number(state.settings.measurementSystem === "metric" ? kmPerLiter : mpg, 2)}</strong></article>
      <article class="report-card"><span>Liters per 100 km</span><strong>${number(litersPer100Km, 2)}</strong></article>
      <article class="report-card"><span>Fuel per hour</span><strong>${number(fuelPerHour, 2)} ${unitLabel(fuelUnit)}</strong></article>
      <article class="report-card"><span>Billing total</span><strong>${currency(totals.cost)}</strong></article>
      <article class="report-card"><span>Cost per hour</span><strong>${currency(costPerHour)}</strong></article>
      <article class="report-card"><span>Cost per ${unitLabel(distanceUnit)}</span><strong>${currency(costPerDistance)}</strong></article>
      <article class="report-card"><span>Job sites</span><strong>${state.fields.length}</strong></article>
      <article class="report-card"><span>Attachments</span><strong>${state.implements.length}</strong></article>
    `;
    return;
  }

  if (!hasPlanFeature("advancedReports")) {
    elements.reportGrid.innerHTML = `
      <article class="report-card"><span>Total jobs</span><strong>${state.jobs.length}</strong></article>
      <article class="report-card"><span>Total acres</span><strong>${number(totals.acres)}</strong></article>
      <article class="report-card"><span>Total field hours</span><strong>${number(totals.hours)}</strong></article>
      <article class="report-card"><span>Acres per hour</span><strong>${number(acresPerHour)}</strong></article>
      <article class="report-card"><span>Fuel per acre</span><strong>${number(fuelPerAcre, 2)} ${unitLabel(fuelUnit)}</strong></article>
      <article class="report-card"><span>Fields tracked</span><strong>${state.fields.length}</strong></article>
      ${upgradeCard}
    `;
    return;
  }

  elements.reportGrid.innerHTML = `
    <article class="report-card"><span>Total jobs</span><strong>${state.jobs.length}</strong></article>
    <article class="report-card"><span>Total acres</span><strong>${number(totals.acres)}</strong></article>
    <article class="report-card"><span>Total field hours</span><strong>${number(totals.hours)}</strong></article>
    <article class="report-card"><span>Acres per hour</span><strong>${number(acresPerHour)}</strong></article>
    <article class="report-card"><span>Fuel per acre</span><strong>${number(fuelPerAcre, 2)} ${unitLabel(fuelUnit)}</strong></article>
    <article class="report-card"><span>Hauling distance</span><strong>${number(displayDistance)} ${unitLabel(distanceUnit)}</strong></article>
    <article class="report-card"><span>${state.settings.measurementSystem === "metric" ? "Kilometers per liter" : "Miles per gallon"}</span><strong>${number(state.settings.measurementSystem === "metric" ? kmPerLiter : mpg, 2)}</strong></article>
    <article class="report-card"><span>Liters per 100 km</span><strong>${number(litersPer100Km, 2)}</strong></article>
    <article class="report-card"><span>Cost per ${unitLabel(distanceUnit)}</span><strong>${currency(costPerDistance)}</strong></article>
    <article class="report-card"><span>Operating cost</span><strong>${currency(totals.cost)}</strong></article>
    <article class="report-card"><span>Cost per acre</span><strong>${currency(costPerAcre)}</strong></article>
    <article class="report-card"><span>Fields tracked</span><strong>${state.fields.length}</strong></article>
    <article class="report-card"><span>Implements</span><strong>${state.implements.length}</strong></article>
  `;
}

function renderSummary() {
  const totals = getTotals();
  const mode = getModeCopy();
  const equipmentLimit = getPlanLimit("equipment");
  const operatorLimit = getPlanLimit("operators");
  const fieldLimit = getPlanLimit("fields");
  const dueCount = state.maintenance.filter((item) => {
    const equipment = getEquipmentById(item.equipmentId) || getPrimaryEquipment();
    return Number(item.dueHours) <= Number(equipment?.hours || 0);
  }).length;
  const fuelPerAcre = totals.acres > 0 ? gallonsToFuel(totals.fuel) / totals.acres : 0;
  const fuelPerHour = totals.hours > 0 ? gallonsToFuel(totals.fuel) / totals.hours : 0;

  document.querySelector("#metric-hours").textContent = number(getEquipmentHours());
  document.querySelector("#metric-acres").textContent = isContractingMode() ? number(totals.loads, 0) : number(totals.acres);
  document.querySelector("#metric-fuel-rate").textContent = isContractingMode()
    ? `${number(fuelPerHour, 2)} ${unitLabel(getPreferredFuelUnit())}/hr`
    : `${number(fuelPerAcre, 2)} ${unitLabel(getPreferredFuelUnit())}`;
  document.querySelector("#metric-reminders").textContent = dueCount;

  elements.limitStatus.innerHTML = `
    <h3>${getActivePlan().name} Plan</h3>
    <p>Equipment: ${state.equipment.length}/${formatLimit(equipmentLimit)}</p>
    <p>Operators: ${state.operators.length}/${formatLimit(operatorLimit)}</p>
    <p>${mode.locationPlural[0].toUpperCase()}${mode.locationPlural.slice(1)}: ${state.fields.length}/${formatLimit(fieldLimit)}</p>
    <p><strong>Unlimited:</strong> unlimited equipment, ${mode.locationPlural}, operators, advanced reports, cloud backup, device syncing, and full export tools.</p>
  `;
}

function renderAll() {
  renderAppModeContent();
  updateEditControls();
  renderEquipment();
  renderCustomers();
  renderFields();
  renderChips();
  renderActiveJobTimer();
  renderJobs();
  renderDashboardWork();
  renderDashboardSnapshot();
  renderMaintenance();
  renderReports();
  renderSummary();
  renderCloudAccount();
  renderSubscriptionPlan();
  renderSyncStatus();
  renderMeasurementSettings();
}

function addListItem(listName, name) {
  if (isAtPlanLimit(listName)) {
    return false;
  }

  state[listName].push({ id: id(), name });
  persist(listName);
  return true;
}

function deleteById(listName, itemId) {
  state[listName] = state[listName].filter((item) => item.id !== itemId);

  if (listName === "fields" && state.editingFieldId === itemId) {
    state.editingFieldId = null;
    elements.fieldForm.reset();
  }

  if (listName === "customers" && state.editingCustomerId === itemId) {
    state.editingCustomerId = null;
    elements.customerForm.reset();
  }

  if (listName === "operators" && state.editingOperatorId === itemId) {
    state.editingOperatorId = null;
    elements.operatorForm.reset();
  }

  if (listName === "implements" && state.editingImplementId === itemId) {
    state.editingImplementId = null;
    elements.implementForm.reset();
  }

  if (listName === "maintenance" && state.editingMaintenanceId === itemId) {
    state.editingMaintenanceId = null;
    elements.maintenanceForm.reset();
  }

  persist(listName);
  renderAll();
}

document.querySelector(".tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");

  if (!tab) {
    return;
  }

  switchTab(tab.dataset.tab);
});

elements.equipmentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!state.editingEquipmentId && isAtPlanLimit("equipment")) {
    alert(planUpgradeMessage("Unlimited equipment"));
    return;
  }

  const equipment = {
    id: state.editingEquipmentId || id(),
    name: document.querySelector("#equipment-name").value.trim(),
    model: document.querySelector("#equipment-model").value.trim(),
    year: document.querySelector("#equipment-year").value,
    hours: Number(document.querySelector("#equipment-hours").value),
    serial: document.querySelector("#equipment-serial").value.trim(),
    fuelCapacity: document.querySelector("#equipment-fuel-capacity").value,
    fuelCapacityUnit: elements.equipmentFuelCapacityUnit.value || getPreferredFuelUnit(),
    notes: document.querySelector("#equipment-notes").value.trim()
  };

  if (state.editingEquipmentId) {
    state.equipment = state.equipment.map((item) => item.id === state.editingEquipmentId ? equipment : item);
  } else {
    state.equipment.push(equipment);
  }

  state.editingEquipmentId = null;
  persist("equipment");
  elements.equipmentForm.reset();
  renderAll();
});

elements.cancelEquipmentEdit.addEventListener("click", () => {
  state.editingEquipmentId = null;
  elements.equipmentForm.reset();
  renderAll();
});

elements.operatorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#operator-name").value.trim();

  if (state.editingOperatorId) {
    state.operators = state.operators.map((operator) => (
      operator.id === state.editingOperatorId ? { ...operator, name } : operator
    ));
    state.editingOperatorId = null;
    persist("operators");
    elements.operatorForm.reset();
    renderAll();
    return;
  }

  const added = addListItem("operators", name);
  elements.operatorForm.reset();
  if (!added) {
    alert(planUpgradeMessage("Multiple operators"));
  }
  renderAll();
});

elements.cancelOperatorEdit.addEventListener("click", () => {
  state.editingOperatorId = null;
  elements.operatorForm.reset();
  renderAll();
});

elements.implementForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#implement-name").value.trim();

  if (state.editingImplementId) {
    state.implements = state.implements.map((implement) => (
      implement.id === state.editingImplementId ? { ...implement, name } : implement
    ));
    state.editingImplementId = null;
    persist("implements");
    elements.implementForm.reset();
    renderAll();
    return;
  }

  addListItem("implements", name);
  elements.implementForm.reset();
  renderAll();
});

elements.cancelImplementEdit.addEventListener("click", () => {
  state.editingImplementId = null;
  elements.implementForm.reset();
  renderAll();
});

elements.customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const customer = {
    id: state.editingCustomerId || id(),
    name: document.querySelector("#customer-name").value.trim(),
    company: document.querySelector("#customer-company").value.trim(),
    phone: document.querySelector("#customer-phone").value.trim(),
    email: document.querySelector("#customer-email").value.trim(),
    address: document.querySelector("#customer-address").value.trim(),
    outstandingBalance: Number(document.querySelector("#customer-balance").value || 0)
  };

  if (state.editingCustomerId) {
    state.customers = state.customers.map((item) => item.id === state.editingCustomerId ? customer : item);
    state.editingCustomerId = null;
  } else {
    state.customers.push(customer);
  }

  persist("customers");
  elements.customerForm.reset();
  renderAll();
});

elements.cancelCustomerEdit.addEventListener("click", () => {
  state.editingCustomerId = null;
  elements.customerForm.reset();
  renderAll();
});

elements.fieldForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const field = {
    id: state.editingFieldId || id(),
    customerId: isContractingMode() ? elements.fieldCustomer.value : "",
    name: document.querySelector("#field-name").value.trim(),
    acres: Number(document.querySelector("#field-acres").value),
    notes: document.querySelector("#field-notes").value.trim()
  };

  if (state.editingFieldId) {
    state.fields = state.fields.map((item) => item.id === state.editingFieldId ? field : item);
    state.editingFieldId = null;
    persist("fields");
    elements.fieldForm.reset();
    renderAll();
    return;
  }

  if (isAtPlanLimit("fields")) {
    alert(planUpgradeMessage(`Unlimited ${getModeCopy().locationPlural}`));
    return;
  }

  state.fields.push(field);
  persist("fields");
  elements.fieldForm.reset();
  renderAll();
});

elements.cancelFieldEdit.addEventListener("click", () => {
  state.editingFieldId = null;
  elements.fieldForm.reset();
  renderAll();
});

elements.jobDistanceUnit.addEventListener("change", renderAppModeContent);

elements.startJob.addEventListener("click", () => {
  showMessage("");
  const mode = getModeCopy();

  if (state.editingJobId) {
    showMessage("Finish or cancel the job edit before starting a timer.", "error");
    return;
  }

  if (!state.equipment.length) {
    showMessage("Save equipment before starting a job timer.", "error");
    return;
  }

  const requiredFields = [
    [elements.jobField, `Choose a ${mode.locationSingular} before starting the timer.`],
    [elements.jobEquipment, "Choose equipment before starting the timer."],
    [elements.jobImplement, `Choose an ${mode.implementLabel.toLowerCase()} before starting the timer.`],
    [elements.jobOperator, "Choose an operator before starting the timer."],
    [elements.jobType, "Choose a job type before starting the timer."]
  ];
  const missingField = requiredFields.find(([control]) => !control.value);

  if (missingField) {
    missingField[0].focus();
    showMessage(missingField[1], "error");
    return;
  }

  state.activeJob = {
    id: id(),
    fieldId: elements.jobField.value,
    equipmentId: elements.jobEquipment.value,
    implementId: elements.jobImplement.value,
    operatorId: elements.jobOperator.value,
    type: elements.jobType.value,
    start: toDateTimeLocal(new Date())
  };
  persist("activeJob");
  renderAll();
  showMessage("Job timer started.", "success");
});

elements.finishJob.addEventListener("click", () => {
  if (!state.activeJob) {
    return;
  }

  const finishedJob = state.activeJob;
  const startDate = new Date(finishedJob.start);
  const endDate = new Date(Math.max(Date.now(), startDate.getTime() + 1000));
  const end = toDateTimeLocal(endDate);
  state.activeJob = null;
  persist("activeJob");
  renderAll();

  elements.jobField.value = finishedJob.fieldId;
  elements.jobEquipment.value = finishedJob.equipmentId;
  elements.jobImplement.value = finishedJob.implementId;
  elements.jobOperator.value = finishedJob.operatorId;
  elements.jobType.value = finishedJob.type;
  elements.jobStart.value = finishedJob.start;
  elements.jobEnd.value = end;
  (isContractingMode() ? elements.jobLoads : elements.jobAcres).focus();
  showMessage(isContractingMode() ? "Job timer finished. Add loads, fuel, material, and notes, then save the job." : "Job timer finished. Add acres, fuel, and notes, then save the job.", "success");
});

elements.cancelJob.addEventListener("click", () => {
  if (!state.activeJob || !window.confirm("Cancel this active job timer?")) {
    return;
  }

  state.activeJob = null;
  persist("activeJob");
  renderAll();
  setDefaultJobTimes();
  showMessage("Job timer canceled.", "success");
});

elements.jobForm.addEventListener("submit", (event) => {
  event.preventDefault();
  showMessage("");

  if (!state.equipment.length) {
    showMessage("Save equipment before logging a job.", "error");
    return;
  }

  if (state.activeJob) {
    showMessage("Finish or cancel the active job timer before saving.", "error");
    return;
  }

  const start = elements.jobStart.value;
  const end = elements.jobEnd.value;
  const duration = getDurationHours(start, end);

  if (duration <= 0) {
    showMessage("The end time must be later than the start time.", "error");
    return;
  }

  const oldJob = state.editingJobId ? state.jobs.find((job) => job.id === state.editingJobId) : null;
  const newJob = getJobFormData(state.editingJobId || id());

  if (state.editingJobId) {
    state.jobs = state.jobs.map((job) => job.id === state.editingJobId ? newJob : job);
  } else {
    state.jobs.push(newJob);
  }

  persist("jobs");
  updateEquipmentHoursForJobChange(oldJob, newJob);
  persist("equipment");

  state.editingJobId = null;
  elements.jobForm.reset();
  setDefaultJobTimes();
  renderAll();
  showMessage(oldJob ? "Job updated successfully." : "Job saved successfully.", "success");
});

elements.cancelJobEdit.addEventListener("click", () => {
  state.editingJobId = null;
  elements.jobForm.reset();
  setDefaultJobTimes();
  renderAll();
  showMessage("Job edit canceled.", "success");
});

elements.maintenanceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const reminder = {
    id: state.editingMaintenanceId || id(),
    equipmentId: elements.maintenanceEquipment.value,
    name: document.querySelector("#maintenance-name").value.trim(),
    dueHours: Number(document.querySelector("#maintenance-hours").value),
    dueDate: document.querySelector("#maintenance-date").value,
    cost: Number(document.querySelector("#maintenance-cost").value || 0),
    notes: document.querySelector("#maintenance-notes").value.trim()
  };

  if (state.editingMaintenanceId) {
    state.maintenance = state.maintenance.map((item) => item.id === state.editingMaintenanceId ? reminder : item);
    state.editingMaintenanceId = null;
  } else {
    state.maintenance.push(reminder);
  }

  persist("maintenance");
  elements.maintenanceForm.reset();
  renderAll();
});

elements.cancelMaintenanceEdit.addEventListener("click", () => {
  state.editingMaintenanceId = null;
  elements.maintenanceForm.reset();
  renderAll();
});

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.settings = {
    appMode: elements.appMode.value,
    setupComplete: state.settings.setupComplete,
    businessName: elements.settingsBusinessName.value.trim(),
    subscriptionPlan: getActivePlanKey(),
    measurementSystem: elements.measurementSystem.value,
    currency: elements.currencyCode.value
  };
  persist("settings");
  renderAll();
});

elements.modeChooser.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-mode]");
  if (!button) {
    return;
  }

  state.settings = normalizeSettings({
    ...state.settings,
    appMode: button.dataset.selectMode
  });
  persist("settings");
  renderAll();
});

elements.firstUseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const equipmentId = id();
  const operatorId = id();
  const fieldId = id();
  const implementId = id();
  const customerId = isContractingMode() ? id() : "";
  const mode = getModeCopy();
  const businessName = elements.setupBusinessName.value.trim();
  const implementName = elements.setupImplementName.value.trim() || (isContractingMode() ? "General attachment" : "General implement");

  state.settings = normalizeSettings({
    ...state.settings,
    businessName,
    setupComplete: true,
    measurementSystem: elements.setupMeasurementSystem.value,
    currency: elements.setupCurrencyCode.value
  });
  state.equipment = [{
    id: equipmentId,
    name: elements.setupEquipmentName.value.trim(),
    model: elements.setupEquipmentModel.value.trim(),
    year: "",
    hours: Number(elements.setupEquipmentHours.value || 0),
    serial: "",
    fuelCapacity: "",
    fuelCapacityUnit: getPreferredFuelUnit(),
    notes: ""
  }];
  state.operators = [{ id: operatorId, name: elements.setupOperatorName.value.trim() }];
  state.customers = isContractingMode()
    ? [{
      id: customerId,
      name: elements.setupCustomerName.value.trim(),
      company: elements.setupCustomerCompany.value.trim(),
      phone: "",
      email: "",
      address: "",
      outstandingBalance: 0
    }]
    : [];
  state.implements = [{ id: implementId, name: implementName }];
  state.fields = [{
    id: fieldId,
    customerId,
    name: elements.setupFieldName.value.trim(),
    acres: Number(elements.setupFieldAcres.value || 0),
    notes: elements.setupFieldNotes.value.trim()
  }];
  state.jobs = [];
  state.activeJob = null;
  state.maintenance = [];
  state.maintenanceHistory = [];

  persistWithoutSyncTracking(() => {
    ["settings", "equipment", "customers", "operators", "implements", "fields", "jobs", "activeJob", "maintenance", "maintenanceHistory"].forEach((key) => persist(key));
  });
  markLocalChange();
  elements.firstUseForm.reset();
  setDefaultJobTimes();
  switchTab("dashboard");
  renderAll();
  showCloudMessage(`${businessName || mode.locationLabel} setup is ready.`, "success");
});

elements.useFreePlan.addEventListener("click", () => {
  state.settings = normalizeSettings({
    ...state.settings,
    subscriptionPlan: "free"
  });
  persist("settings");
  renderAll();
  showCloudMessage("Free plan is active. Existing records stay saved, but Free limits apply to new records.", "success");
});

elements.activateFarmPlan.addEventListener("click", () => {
  state.settings = normalizeSettings({
    ...state.settings,
    subscriptionPlan: "farm"
  });
  persist("settings");
  renderAll();
  showCloudMessage("Unlimited is active for testing. Unlimited records and paid tools are unlocked.", "success");
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  if (button.dataset.deleteField) deleteById("fields", button.dataset.deleteField);
  if (button.dataset.deleteCustomer) {
    const usedByFields = state.fields.some((field) => field.customerId === button.dataset.deleteCustomer);
    if (usedByFields) {
      alert("This customer has job sites. Move or delete those job sites before deleting the customer.");
      return;
    }

    if (window.confirm("Delete this customer?")) {
      deleteById("customers", button.dataset.deleteCustomer);
    }
  }
  if (button.dataset.deleteOperator) deleteById("operators", button.dataset.deleteOperator);
  if (button.dataset.deleteImplement) deleteById("implements", button.dataset.deleteImplement);
  if (button.dataset.deleteMaintenance) deleteById("maintenance", button.dataset.deleteMaintenance);

  if (button.dataset.editField) {
    const field = state.fields.find((item) => item.id === button.dataset.editField);
    if (field) {
      state.editingFieldId = field.id;
      switchTab("records");
      renderAll();
      elements.fieldCustomer.value = field.customerId || "";
      document.querySelector("#field-name").value = field.name;
      document.querySelector("#field-acres").value = field.acres;
      document.querySelector("#field-notes").value = field.notes || "";
      document.querySelector("#field-name").focus();
    }
  }

  if (button.dataset.editCustomer) {
    const customer = state.customers.find((item) => item.id === button.dataset.editCustomer);
    if (customer) {
      state.editingCustomerId = customer.id;
      switchTab("records");
      renderAll();
      document.querySelector("#customer-name").value = customer.name;
      document.querySelector("#customer-company").value = customer.company || "";
      document.querySelector("#customer-phone").value = customer.phone || "";
      document.querySelector("#customer-email").value = customer.email || "";
      document.querySelector("#customer-address").value = customer.address || "";
      document.querySelector("#customer-balance").value = customer.outstandingBalance || "";
      document.querySelector("#customer-name").focus();
    }
  }

  if (button.dataset.editOperator) {
    const operator = state.operators.find((item) => item.id === button.dataset.editOperator);
    if (operator) {
      state.editingOperatorId = operator.id;
      switchTab("records");
      renderAll();
      document.querySelector("#operator-name").value = operator.name;
      document.querySelector("#operator-name").focus();
    }
  }

  if (button.dataset.editImplement) {
    const implement = state.implements.find((item) => item.id === button.dataset.editImplement);
    if (implement) {
      state.editingImplementId = implement.id;
      switchTab("records");
      renderAll();
      document.querySelector("#implement-name").value = implement.name;
      document.querySelector("#implement-name").focus();
    }
  }

  if (button.dataset.editEquipment) {
    const equipment = getEquipmentById(button.dataset.editEquipment);
    if (equipment) {
      state.editingEquipmentId = equipment.id;
      switchTab("records");
      renderAll();
      document.querySelector("#equipment-name").value = equipment.name;
      document.querySelector("#equipment-model").value = equipment.model;
      document.querySelector("#equipment-year").value = equipment.year || "";
      document.querySelector("#equipment-hours").value = equipment.hours;
      document.querySelector("#equipment-serial").value = equipment.serial || "";
      document.querySelector("#equipment-fuel-capacity").value = equipment.fuelCapacity || "";
      elements.equipmentFuelCapacityUnit.value = getEquipmentFuelCapacityUnit(equipment);
      document.querySelector("#equipment-notes").value = equipment.notes || "";
      document.querySelector("#equipment-name").focus();
    }
  }

  if (button.dataset.deleteEquipment) {
    const usedByJobs = state.jobs.some((job) => job.equipmentId === button.dataset.deleteEquipment);
    const usedByMaintenance = state.maintenance.some((item) => item.equipmentId === button.dataset.deleteEquipment);
    const usedByActiveJob = state.activeJob?.equipmentId === button.dataset.deleteEquipment;

    if (usedByJobs || usedByMaintenance || usedByActiveJob) {
      alert("This machine has job history or maintenance reminders. Delete those records before deleting the machine.");
      return;
    }

    if (!window.confirm("Delete this machine from the equipment list?")) {
      return;
    }

    state.equipment = state.equipment.filter((item) => item.id !== button.dataset.deleteEquipment);
    state.editingEquipmentId = state.editingEquipmentId === button.dataset.deleteEquipment ? null : state.editingEquipmentId;
    persist("equipment");
    renderAll();
  }

  if (button.dataset.deleteJob) {
    state.jobs = state.jobs.filter((job) => job.id !== button.dataset.deleteJob);
    state.editingJobId = state.editingJobId === button.dataset.deleteJob ? null : state.editingJobId;
    persist("jobs");
    renderAll();
  }

  if (button.dataset.editJob) {
    const job = state.jobs.find((item) => item.id === button.dataset.editJob);

    if (state.activeJob) {
      showMessage("Finish or cancel the active job timer before editing a saved job.", "error");
      return;
    }

    if (job) {
      state.editingJobId = job.id;
      switchTab("jobs");
      renderAll();
      elements.jobField.value = job.fieldId;
      elements.jobEquipment.value = job.equipmentId;
      elements.jobImplement.value = job.implementId;
      elements.jobOperator.value = job.operatorId;
      elements.jobType.value = job.type;
      elements.jobStart.value = job.start;
      elements.jobEnd.value = job.end;
      document.querySelector("#job-acres").value = job.acres;
      elements.jobDistance.value = job.distance || "";
      elements.jobDistanceUnit.value = job.distanceUnit || getPreferredDistanceUnit();
      document.querySelector("#job-fuel").value = job.fuel;
      elements.jobFuelUnit.value = job.fuelUnit || "gal";
      document.querySelector("#job-conditions").value = job.conditions || "";
      document.querySelector("#job-weather").value = job.weather || "";
      document.querySelector("#job-cost-hour").value = job.costPerHour || "";
      elements.jobCostDistance.value = job.costPerDistance || "";
      elements.jobLoads.value = job.loads || "";
      elements.jobMaterial.value = job.materialType || "";
      document.querySelector("#job-notes").value = job.notes || "";
      elements.jobField.focus();
      showMessage("Editing saved job.", "success");
    }
  }

  if (button.dataset.editMaintenance) {
    const reminder = state.maintenance.find((item) => item.id === button.dataset.editMaintenance);
    if (reminder) {
      state.editingMaintenanceId = reminder.id;
      switchTab("maintenance");
      renderAll();
      elements.maintenanceEquipment.value = reminder.equipmentId;
      document.querySelector("#maintenance-name").value = reminder.name;
      document.querySelector("#maintenance-hours").value = reminder.dueHours;
      document.querySelector("#maintenance-date").value = reminder.dueDate || "";
      document.querySelector("#maintenance-cost").value = reminder.cost || "";
      document.querySelector("#maintenance-notes").value = reminder.notes || "";
      document.querySelector("#maintenance-name").focus();
    }
  }

  if (button.dataset.completeMaintenance) {
    button.disabled = true;
    const item = state.maintenance.find((reminder) => reminder.id === button.dataset.completeMaintenance);
    const equipment = getEquipmentById(item?.equipmentId) || getPrimaryEquipment();
    if (item && equipment) {
      const completedHours = Number(equipment.hours || 0);
      const previousDueHours = Number(item.dueHours || 0);

      if (previousDueHours > completedHours) {
        window.alert(`This maintenance item is already marked done. It can be completed again when ${equipment.name} reaches ${number(previousDueHours)} engine hours.`);
        button.disabled = false;
        return;
      }

      const alreadyRecorded = state.maintenanceHistory.some((record) => (
        record.reminderId === item.id
        && record.equipmentId === equipment.id
        && Number(record.completedHours || 0) === completedHours
      ));

      if (alreadyRecorded) {
        window.alert("This maintenance completion was already recorded at the current engine hours.");
        button.disabled = false;
        return;
      }

      const nextDueHours = completedHours + 50;

      state.maintenanceHistory.push({
        id: id(),
        reminderId: item.id,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        name: item.name,
        completedAt: new Date().toISOString(),
        completedHours,
        previousDueHours,
        nextDueHours,
        dueDate: item.dueDate || "",
        cost: Number(item.cost || 0),
        notes: item.notes || ""
      });

      item.dueHours = nextDueHours;
      persist("maintenanceHistory");
      persist("maintenance");
      renderAll();
    }
  }
});

elements.clearJobs.addEventListener("click", () => {
  if (!window.confirm("Delete all saved job history from this device? Equipment hours will stay as-is.")) {
    return;
  }

  state.jobs = [];
  state.editingJobId = null;
  persist("jobs");
  elements.jobForm.reset();
  setDefaultJobTimes();
  renderAll();
});

elements.sampleData.addEventListener("click", () => {
  const equipmentId = id();
  const operatorId = id();
  const implementId = id();
  const fieldId = id();
  const customerId = id();
  const now = new Date();
  const contractorMode = isContractingMode();

  state.equipment = [{
    id: equipmentId,
    name: contractorMode ? "Main Truck" : "Main Tractor",
    model: contractorMode ? "Freightliner M2" : "John Deere 4440",
    year: contractorMode ? "2016" : "1982",
    hours: 6423.4,
    serial: contractorMode ? "M2-SAMPLE" : "4440-SAMPLE",
    fuelCapacity: contractorMode ? 80 : 65,
    fuelCapacityUnit: "gal",
    notes: contractorMode ? "Service air dryer before winter." : "Watch hydraulic seep near rear remote."
  }];
  state.operators = [{ id: operatorId, name: "Carter" }];
  state.customers = contractorMode
    ? [{
      id: customerId,
      name: "Miller Construction",
      company: "Miller Construction",
      phone: "555-0142",
      email: "billing@miller.example",
      address: "120 County Road 9",
      outstandingBalance: 420
    }]
    : [];
  state.implements = contractorMode
    ? [
      { id: implementId, name: "Dump trailer" },
      { id: id(), name: "Skid-steer bucket" }
    ]
    : [
      { id: implementId, name: "15 ft disk" },
      { id: id(), name: "6 row planter" }
    ];
  state.fields = contractorMode
    ? [
      { id: fieldId, customerId, name: "Miller Driveway", acres: 0, notes: "South entrance." },
      { id: id(), customerId, name: "Quarry Run", acres: 0, notes: "Material pickup and scale tickets." }
    ]
    : [
      { id: fieldId, name: "North 80", acres: 80, notes: "Corn ground, rolling." },
      { id: id(), name: "Home 40", acres: 40, notes: "Close to shop." }
    ];
  state.jobs = [
    {
      id: id(),
      fieldId,
      equipmentId,
      implementId,
      operatorId,
      type: contractorMode ? "Grading" : "Disking",
      start: toDateTimeLocal(new Date(now.getTime() - 3.5 * 60 * 60 * 1000)),
      end: toDateTimeLocal(now),
      acres: contractorMode ? 0 : 32,
      distance: contractorMode ? 18 : 0,
      distanceUnit: "mi",
      fuel: contractorMode ? 11 : 18,
      fuelUnit: "gal",
      conditions: contractorMode ? "Packed gravel, light washout" : "Dry top, damp low spots",
      weather: "Sunny, light wind",
      costPerHour: contractorMode ? 115 : 62,
      costPerDistance: contractorMode ? 2.75 : 0,
      costDistanceUnit: "mi",
      loads: contractorMode ? 5 : 0,
      materialType: contractorMode ? "Road gravel" : "",
      notes: contractorMode ? "Final grade at entrance and two culvert passes." : "One stop to tighten gang bolt."
    },
    {
      id: id(),
      fieldId,
      equipmentId,
      implementId,
      operatorId,
      type: contractorMode ? "Hauling" : "Hauling",
      start: toDateTimeLocal(new Date(now.getTime() - 7 * 60 * 60 * 1000)),
      end: toDateTimeLocal(new Date(now.getTime() - 4.5 * 60 * 60 * 1000)),
      acres: 0,
      distance: 42,
      distanceUnit: "mi",
      fuel: 9.4,
      fuelUnit: "gal",
      conditions: contractorMode ? "Quarry to site, county roads" : "County roads",
      weather: "Clear",
      costPerHour: contractorMode ? 95 : 74,
      costPerDistance: contractorMode ? 3.25 : 0,
      costDistanceUnit: "mi",
      loads: contractorMode ? 6 : 0,
      materialType: contractorMode ? "Crushed limestone" : "",
      notes: contractorMode ? "Six loads delivered and spread ticket numbers in notebook." : "Hauling seed tender and parts run."
    }
  ];
  state.activeJob = null;
  state.editingEquipmentId = null;
  state.editingFieldId = null;
  state.editingCustomerId = null;
  state.editingOperatorId = null;
  state.editingImplementId = null;
  state.editingJobId = null;
  state.editingMaintenanceId = null;
  state.maintenance = [
    { id: id(), equipmentId, name: "Oil change", dueHours: 6430, dueDate: "", cost: 185, notes: "15W-40 and filter." },
    { id: id(), equipmentId, name: "Grease and belt inspection", dueHours: 6425, dueDate: "", cost: 0, notes: "Before baling season." }
  ];
  state.maintenanceHistory = [];
  state.settings = {
    appMode: getAppMode(),
    setupComplete: true,
    businessName: state.settings.businessName || (contractorMode ? "Carter Contracting" : "Home Farm"),
    subscriptionPlan: getActivePlanKey(),
    measurementSystem: "us",
    currency: "USD"
  };

  Object.keys(STORAGE_KEYS).forEach((key) => persist(key));
  renderAll();
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showCloudMessage("");

  if (!hasPlanFeature("cloudSync")) {
    showPlanUpgrade("Accounts and cloud sync");
    return;
  }

  try {
    const payload = await cloudRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({
        farmName: document.querySelector("#register-farm").value.trim(),
        email: document.querySelector("#register-email").value.trim(),
        password: document.querySelector("#register-password").value
      })
    });
    saveCloudSession(sessionFromPayload(payload));
    elements.registerForm.reset();
    await uploadFarmToCloud();
    showCloudMessage("Account created and this device is synced.", "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showCloudMessage("");

  if (!hasPlanFeature("cloudSync")) {
    showPlanUpgrade("Accounts and cloud sync");
    return;
  }

  try {
    const payload = await cloudRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#login-email").value.trim(),
        password: document.querySelector("#login-password").value
      })
    });
    saveCloudSession(sessionFromPayload(payload));
    elements.loginForm.reset();
    showCloudMessage("Logged in. Use Download Cloud Copy or Upload This Device to sync.", "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.logoutAccount.addEventListener("click", async () => {
  try {
    await cloudRequest("/api/logout", { method: "POST", body: "{}" });
  } catch (error) {
    console.warn("Cloud logout failed:", error);
  }

  saveCloudSession(null);
  showCloudMessage("Logged out.", "success");
});

elements.uploadCloud.addEventListener("click", async () => {
  showCloudMessage("");

  try {
    await uploadFarmToCloud();
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.downloadCloud.addEventListener("click", async () => {
  showCloudMessage("");

  if (!window.confirm("Download the cloud copy to this device? This will replace local records.")) {
    return;
  }

  try {
    await downloadFarmFromCloud();
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.exportCsv.addEventListener("click", () => {
  if (!hasPlanFeature("exportTools")) {
    showPlanUpgrade("CSV export");
    return;
  }

  const headers = [
    "Job type",
    isContractingMode() ? "Job site" : "Field",
    "Customer",
    "Company",
    "Equipment",
    "Operator",
    isContractingMode() ? "Attachment" : "Implement",
    "Start",
    "End",
    "Hours",
    "Acres",
    "Distance",
    "Distance unit",
    "Fuel",
    "Fuel unit",
    "Loads hauled",
    "Material type",
    "Cost/hour",
    "Cost/distance",
    "Cost distance unit",
    "Billing total",
    "Acres/hour",
    "Fuel/acre",
    "Miles/gallon",
    "Kilometers/liter",
    "Liters/100km",
    "Cost/acre",
    "Cost/mile",
    "Cost/kilometer",
    "Conditions",
    "Weather",
    "Notes"
  ];

  const rows = state.jobs.map((job) => {
    const details = getJobDetails(job);
    return [
      job.type,
      details.fieldName,
      details.customerName,
      details.customerCompany,
      details.equipmentName,
      details.operatorName,
      details.implementName,
      job.start,
      job.end,
      number(details.duration),
      number(job.acres),
      number(job.distance),
      job.distanceUnit || "mi",
      number(job.fuel),
      job.fuelUnit || "gal",
      number(job.loads, 0),
      job.materialType,
      number(job.costPerHour, 2),
      number(job.costPerDistance, 2),
      job.costDistanceUnit || job.distanceUnit || "mi",
      number(details.cost, 2),
      number(details.acresPerHour),
      number(details.fuelPerAcre, 2),
      number(details.milesPerGallon, 2),
      number(details.kilometersPerLiter, 2),
      number(details.litersPer100Km, 2),
      number(details.costPerAcre, 2),
      number(details.costPerMile, 2),
      number(details.costPerKm, 2),
      job.conditions,
      job.weather,
      job.notes
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadFile("tractor-tracker-report.csv", csv, "text/csv");
});

elements.exportMaintenanceCsv.addEventListener("click", () => {
  showBackupMessage("");

  if (!hasPlanFeature("exportTools")) {
    showPlanUpgrade("Maintenance CSV export");
    return;
  }

  if (!state.maintenanceHistory.length) {
    showBackupMessage("No completed maintenance records yet.", "error");
    return;
  }

  const headers = [
    "Service item",
    "Equipment",
    "Completed date",
    "Completed engine hours",
    "Previous due hours",
    "Next due hours",
    "Reminder due date",
    "Cost",
    "Notes"
  ];

  const rows = state.maintenanceHistory.map((record) => [
    record.name,
    record.equipmentName,
    record.completedAt ? dateTime(record.completedAt) : "",
    number(record.completedHours),
    number(record.previousDueHours),
    number(record.nextDueHours),
    record.dueDate || "",
    number(record.cost, 2),
    record.notes
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadFile("tractor-tracker-maintenance-report.csv", csv, "text/csv");
  showBackupMessage("Maintenance CSV downloaded.", "success");
});

elements.downloadBackup.addEventListener("click", () => {
  showBackupMessage("");
  if (!hasPlanFeature("exportTools")) {
    showPlanUpgrade("Backup download");
    return;
  }

  const backup = JSON.stringify(createFarmBackup(), null, 2);
  const backupDate = new Date().toISOString().slice(0, 10);
  downloadFile(`tractor-tracker-backup-${backupDate}.json`, backup, "application/json");
  showBackupMessage("Farm backup downloaded.", "success");
});

elements.restoreBackup.addEventListener("click", () => {
  showBackupMessage("");
  if (!hasPlanFeature("exportTools")) {
    showPlanUpgrade("Backup restore");
    return;
  }

  elements.restoreBackupFile.click();
});

elements.restoreBackupFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const restoredData = normalizeRestoredBackup(JSON.parse(reader.result));

      if (!window.confirm("Restore this farm backup? This will replace all current records saved on this device.")) {
        event.target.value = "";
        return;
      }

      restoreFarmBackup(restoredData);
      showBackupMessage("Farm backup restored successfully.", "success");
    } catch (error) {
      showBackupMessage(error.message || "Could not restore that backup file.", "error");
    } finally {
      event.target.value = "";
    }
  });

  reader.addEventListener("error", () => {
    showBackupMessage("Could not read that backup file.", "error");
    event.target.value = "";
  });

  reader.readAsText(file);
});

normalizeEquipmentReferences();
setDefaultJobTimes();
renderAll();
switchTab(document.querySelector(".tab.active")?.dataset.tab || "dashboard");
setInterval(updateJobTimer, 1000);

if (window.navigator && "serviceWorker" in window.navigator) {
  window.addEventListener("load", () => {
    window.navigator.serviceWorker.register("sw.js?v=19").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

window.addEventListener("online", () => {
  if (state.syncMeta.pending) {
    scheduleAutoSync();
  }
});

window.addEventListener("offline", () => {
  if (state.syncMeta.pending && isCloudSyncReady()) {
    setSyncMeta({
      status: "offline",
      pending: true,
      message: "Offline -- will sync later"
    });
  }
});

if (state.syncMeta.pending) {
  scheduleAutoSync();
}
