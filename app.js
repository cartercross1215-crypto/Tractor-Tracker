const STORAGE_KEYS = {
  equipment: "fieldwork-equipment-v2",
  fields: "fieldwork-fields-v2",
  customers: "tractor-tracker-customers-v1",
  operators: "fieldwork-operators-v2",
  implements: "fieldwork-implements-v2",
  jobs: "fieldwork-jobs-v2",
  invoices: "tractor-tracker-invoices-v1",
  activeJob: "fieldwork-active-job-v2",
  maintenance: "fieldwork-maintenance-v2",
  maintenanceHistory: "tractor-tracker-maintenance-history-v1",
  cloudSession: "tractor-tracker-cloud-session-v1",
  syncMeta: "tractor-tracker-sync-meta-v1",
  settings: "tractor-tracker-settings-v1"
};

const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free Unlimited Beta",
    price: "Beta",
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
const GPS_MAX_ACCURACY_METERS = 120;
const GPS_MIN_STEP_METERS = 8;
const METERS_PER_MILE = 1609.344;

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
  invoices: loadData(STORAGE_KEYS.invoices, []),
  activeJob: loadData(STORAGE_KEYS.activeJob, null),
  maintenance: loadData(STORAGE_KEYS.maintenance, []),
  maintenanceHistory: loadData(STORAGE_KEYS.maintenanceHistory, []),
  cloudSession: loadData(STORAGE_KEYS.cloudSession, null),
  syncMeta: loadData(STORAGE_KEYS.syncMeta, {
    status: "local",
    pending: false,
    lastLocalSaveAt: null,
    lastSyncedAt: null,
    conflictFarm: null,
    conflictUpdatedAt: null,
    message: "Saved locally"
  }),
  settings: loadData(STORAGE_KEYS.settings, {
    appMode: null,
    accountPromptComplete: false,
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
let passwordResetToken = new URLSearchParams(window.location.search).get("reset");
let gpsWatchId = null;
let pendingFinishedGpsSummary = null;

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
  feedbackForm: document.querySelector("#feedback-form"),
  maintenanceForm: document.querySelector("#maintenance-form"),
  settingsForm: document.querySelector("#settings-form"),
  registerForm: document.querySelector("#register-form"),
  loginForm: document.querySelector("#login-form"),
  startupLoginForm: document.querySelector("#startup-login-form"),
  startupRegisterForm: document.querySelector("#startup-register-form"),
  resetPasswordForm: document.querySelector("#reset-password-form"),
  changePasswordForm: document.querySelector("#change-password-form"),
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
  cloudLocalSave: document.querySelector("#cloud-local-save"),
  syncDetail: document.querySelector("#sync-detail"),
  syncWarning: document.querySelector("#sync-warning"),
  retrySync: document.querySelector("#retry-sync"),
  syncConflictActions: document.querySelector("#sync-conflict-actions"),
  useCloudCopy: document.querySelector("#use-cloud-copy"),
  keepDeviceCopy: document.querySelector("#keep-device-copy"),
  planName: document.querySelector("#plan-name"),
  subscriptionStatus: document.querySelector("#subscription-status"),
  subscriptionPrice: document.querySelector("#subscription-price"),
  freePlanCard: document.querySelector("#free-plan-card"),
  farmPlanCard: document.querySelector("#farm-plan-card"),
  useFreePlan: document.querySelector("#use-free-plan"),
  activateFarmPlan: document.querySelector("#activate-farm-plan"),
  logoutAccount: document.querySelector("#logout-account"),
  logoutAllDevices: document.querySelector("#logout-all-devices"),
  uploadCloud: document.querySelector("#upload-cloud"),
  downloadCloud: document.querySelector("#download-cloud"),
  downloadAccountData: document.querySelector("#download-account-data"),
  deleteCloudData: document.querySelector("#delete-cloud-data"),
  deleteAccount: document.querySelector("#delete-account"),
  clearJobs: document.querySelector("#clear-jobs"),
  sampleData: document.querySelector("#sample-data"),
  exportCsv: document.querySelector("#export-csv"),
  exportMaintenanceCsv: document.querySelector("#export-maintenance-csv"),
  invoiceSection: document.querySelector("#invoice-section"),
  invoiceForm: document.querySelector("#invoice-form"),
  invoiceCustomer: document.querySelector("#invoice-customer"),
  invoiceNumber: document.querySelector("#invoice-number"),
  invoiceHourlyRate: document.querySelector("#invoice-hourly-rate"),
  invoiceDistanceRateLabel: document.querySelector("#invoice-distance-rate-label"),
  invoiceDistanceRate: document.querySelector("#invoice-distance-rate"),
  invoiceLoadRate: document.querySelector("#invoice-load-rate"),
  invoiceMaterialCharge: document.querySelector("#invoice-material-charge"),
  invoiceEquipmentCharge: document.querySelector("#invoice-equipment-charge"),
  invoiceTaxRate: document.querySelector("#invoice-tax-rate"),
  invoicePaidStatus: document.querySelector("#invoice-paid-status"),
  invoiceMessage: document.querySelector("#invoice-message"),
  invoiceList: document.querySelector("#invoice-list"),
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
  gpsPanel: document.querySelector("#gps-panel"),
  gpsDistance: document.querySelector("#gps-distance"),
  gpsStatus: document.querySelector("#gps-status"),
  gpsPoints: document.querySelector("#gps-points"),
  startGps: document.querySelector("#start-gps"),
  stopGps: document.querySelector("#stop-gps"),
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
  jobWeather: document.querySelector("#job-weather"),
  useCurrentWeather: document.querySelector("#use-current-weather"),
  feedbackType: document.querySelector("#feedback-type"),
  feedbackDevice: document.querySelector("#feedback-device"),
  feedbackNotes: document.querySelector("#feedback-notes"),
  measurementSystem: document.querySelector("#measurement-system"),
  currencyCode: document.querySelector("#currency-code"),
  maintenanceEquipment: document.querySelector("#maintenance-equipment")
};

Object.assign(elements, {
  modeChooser: document.querySelector("#mode-chooser"),
  accountChooser: document.querySelector("#account-chooser"),
  startupCloudMessage: document.querySelector("#startup-cloud-message"),
  resetPasswordScreen: document.querySelector("#password-reset-screen"),
  resetMessage: document.querySelector("#reset-message"),
  startupLoginEmail: document.querySelector("#startup-login-email"),
  startupLoginPassword: document.querySelector("#startup-login-password"),
  startupForgotPassword: document.querySelector("#startup-forgot-password"),
  startupRegisterFarm: document.querySelector("#startup-register-farm"),
  startupRegisterEmail: document.querySelector("#startup-register-email"),
  startupRegisterPassword: document.querySelector("#startup-register-password"),
  resetNewPassword: document.querySelector("#reset-new-password"),
  resetConfirmPassword: document.querySelector("#reset-confirm-password"),
  forgotPassword: document.querySelector("#forgot-password"),
  currentPassword: document.querySelector("#current-password"),
  newPassword: document.querySelector("#new-password"),
  continueLocal: document.querySelector("#continue-local"),
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
    conflictFarm: syncMeta.conflictFarm || null,
    conflictUpdatedAt: syncMeta.conflictUpdatedAt || null,
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
    accountPromptComplete: Boolean(settings.accountPromptComplete),
    setupComplete: Boolean(settings.setupComplete),
    businessName: settings.businessName || "",
    subscriptionPlan: "free",
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

function shouldShowAccountChooser() {
  return Boolean(!state.cloudSession?.token && !state.settings.accountPromptComplete);
}

function shouldShowPasswordResetScreen() {
  return Boolean(passwordResetToken);
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
  return `${featureName} is available during the Free Unlimited Beta.`;
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

function showStartupCloudMessage(text, type = "") {
  elements.startupCloudMessage.textContent = text;
  elements.startupCloudMessage.className = `message ${type}`;
}

function showResetMessage(text, type = "") {
  elements.resetMessage.textContent = text;
  elements.resetMessage.className = `message ${type}`;
}

function showInvoiceMessage(text, type = "") {
  elements.invoiceMessage.textContent = text;
  elements.invoiceMessage.className = `message ${type}`;
}

function hidePreloader() {
  const preloader = document.querySelector("#app-preloader");
  if (!preloader) {
    return;
  }

  preloader.classList.add("is-hidden");
  window.setTimeout(() => {
    preloader.hidden = true;
  }, 220);
}

function weatherCodeLabel(code) {
  const labels = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail"
  };
  return labels[Number(code)] || "Weather";
}

function windDirectionLabel(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(Number(degrees || 0) / 45) % directions.length];
}

function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.navigator?.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }

    window.navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function fetchCurrentWeather() {
  if (window.isSecureContext === false) {
    throw new Error("Weather needs HTTPS or localhost so the phone can share location.");
  }

  const position = await getCurrentPosition({
    enableHighAccuracy: true,
    maximumAge: 10 * 60 * 1000,
    timeout: 15000
  });
  const latitude = position.coords.latitude.toFixed(5);
  const longitude = position.coords.longitude.toFixed(5);
  const usesMetric = state.settings.measurementSystem === "metric";
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    temperature_unit: usesMetric ? "celsius" : "fahrenheit",
    wind_speed_unit: usesMetric ? "kmh" : "mph",
    precipitation_unit: usesMetric ? "mm" : "inch",
    timezone: "auto",
    forecast_days: "1"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Weather could not be loaded right now.");
  }

  const payload = await response.json();
  const current = payload.current || {};
  const units = payload.current_units || {};
  const condition = weatherCodeLabel(current.weather_code);
  const temp = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  const gust = Number(current.wind_gusts_10m);
  const precipitation = Number(current.precipitation || 0);
  const humidity = Number(current.relative_humidity_2m || 0);
  const direction = windDirectionLabel(current.wind_direction_10m);
  const parts = [
    `${condition}, ${number(temp, 0)}${units.temperature_2m || (usesMetric ? "°C" : "°F")}`,
    `${direction} wind ${number(wind, 0)} ${units.wind_speed_10m || (usesMetric ? "km/h" : "mph")}`,
    gust ? `gusts ${number(gust, 0)} ${units.wind_gusts_10m || (usesMetric ? "km/h" : "mph")}` : "",
    humidity ? `${number(humidity, 0)}% humidity` : "",
    precipitation ? `${number(precipitation, 2)} ${units.precipitation || (usesMetric ? "mm" : "in")} precip` : ""
  ].filter(Boolean);

  return parts.join(", ");
}

function buildFeedbackMailto() {
  const mode = getAppMode() === "contracting" ? "Contracting" : "Farm";
  const type = elements.feedbackType.value;
  const device = elements.feedbackDevice.value.trim() || window.navigator.userAgent;
  const notes = elements.feedbackNotes.value.trim();
  const subject = `Tractor Tracker feedback - ${type}`;
  const body = [
    `Type: ${type}`,
    `Mode: ${mode}`,
    `Device: ${device}`,
    `Account: ${state.cloudSession?.email || "Not logged in"}`,
    `Sync status: ${state.syncMeta.status || "local"}`,
    "",
    "What I was trying to do:",
    notes,
    "",
    "What went wrong or what I want added:",
    "",
    "Screenshot:",
    "Attach one here if helpful."
  ].join("\n");

  return `mailto:tractortracker.support@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  return Boolean(state.cloudSession?.token);
}

function isBrowserOffline() {
  return window.navigator && window.navigator.onLine === false;
}

function getSyncStatusText() {
  if (!state.cloudSession?.token) {
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

function getSyncDetailText() {
  if (!state.cloudSession?.token) {
    return "Saved locally on this device. Log in to sync across devices.";
  }

  if (state.syncMeta.status === "syncing") {
    return "Syncing this device with the cloud now.";
  }

  if (state.syncMeta.status === "conflict") {
    const cloudTime = state.syncMeta.conflictUpdatedAt ? formatSyncTime(state.syncMeta.conflictUpdatedAt) : "recently";
    return `Another device saved newer cloud data ${cloudTime}. Choose which copy to keep.`;
  }

  if (state.syncMeta.status === "offline") {
    return "This device is offline or the server cannot be reached. Changes are saved locally and will sync later.";
  }

  if (state.syncMeta.pending) {
    return "Unsynced changes are saved locally and waiting to sync.";
  }

  if (state.syncMeta.lastSyncedAt) {
    return `Last synced ${formatSyncTime(state.syncMeta.lastSyncedAt)}.`;
  }

  return "Ready to sync.";
}

function getSyncWarningText() {
  if (state.syncMeta.status === "conflict") {
    return "Conflict: cloud data is newer than this device.";
  }

  if (state.syncMeta.status === "offline") {
    return "Offline -- will sync later.";
  }

  if (state.syncMeta.pending) {
    return "Unsynced changes.";
  }

  return "";
}

function renderSyncStatus() {
  const text = getSyncStatusText();
  elements.syncStatus.textContent = text;
  elements.cloudSyncStatus.textContent = text;
  elements.cloudLocalSave.textContent = formatSyncTime(state.syncMeta.lastLocalSaveAt);
  elements.syncDetail.textContent = getSyncDetailText();
  elements.syncWarning.textContent = getSyncWarningText();
  elements.syncWarning.className = `message ${state.syncMeta.status === "synced" ? "success" : state.syncMeta.pending || state.syncMeta.status === "offline" || state.syncMeta.status === "conflict" ? "error" : ""}`;
  elements.syncStatus.dataset.status = state.syncMeta.status || "local";
  elements.cloudSyncStatus.dataset.status = state.syncMeta.status || "local";
  elements.retrySync.disabled = !state.cloudSession?.token || state.syncMeta.status === "syncing";
  elements.syncConflictActions.hidden = state.syncMeta.status !== "conflict";
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
    conflictFarm: null,
    conflictUpdatedAt: null,
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
    weather: elements.jobWeather.value.trim(),
    costPerHour: Number(document.querySelector("#job-cost-hour").value || 0),
    costPerDistance: Number(elements.jobCostDistance.value || 0),
    costDistanceUnit: elements.jobDistanceUnit.value || getPreferredDistanceUnit(),
    loads: Number(elements.jobLoads.value || 0),
    materialType: elements.jobMaterial.value.trim(),
    notes: document.querySelector("#job-notes").value.trim(),
    gpsSummary: pendingFinishedGpsSummary || state.jobs.find((job) => job.id === jobId)?.gpsSummary || null
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

function completeAccountPrompt() {
  state.settings = normalizeSettings({
    ...state.settings,
    accountPromptComplete: true
  });
  persist("settings");
  renderAll();
}

async function logInToCloud(email, password) {
  const payload = await cloudRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  const restoredData = normalizeRestoredBackup(payload.farm.data);
  restoredData.settings = normalizeSettings({
    ...restoredData.settings,
    accountPromptComplete: true
  });
  restoreFarmBackup(restoredData, { source: "cloud", cloudUpdatedAt: payload.farm.updatedAt });
  saveCloudSession(sessionFromPayload(payload));
  return payload;
}

async function createCloudAccount({ farmName, email, password }) {
  const payload = await cloudRequest("/api/register", {
    method: "POST",
    body: JSON.stringify({ farmName, email, password })
  });
  saveCloudSession(sessionFromPayload(payload));
  state.settings = normalizeSettings({
    ...state.settings,
    accountPromptComplete: true,
    businessName: state.settings.businessName || farmName
  });
  persist("settings");
  await uploadFarmToCloud();
  return payload;
}

async function requestPasswordReset(email, showMessage) {
  const accountEmail = (email || "").trim();

  if (!accountEmail) {
    showMessage("Enter your account email first.", "error");
    return;
  }

  showMessage("Sending password reset link...", "success");
  const payload = await cloudRequest("/api/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email: accountEmail })
  });

  showMessage(payload.message, payload.emailConfigured === false ? "error" : "success");
}

function promptForAccountPassword(actionName) {
  const password = window.prompt(`Enter your Tractor Tracker password to ${actionName}.`);
  return password === null ? null : password;
}

function clearLocalFarmDataAfterDeletion() {
  stopGpsTracking({ markStopped: false, silent: true });
  pendingFinishedGpsSummary = null;
  state.equipment = [];
  state.fields = [];
  state.customers = [];
  state.operators = [];
  state.implements = [];
  state.jobs = [];
  state.invoices = [];
  stopGpsTracking({ markStopped: false, silent: true });
  state.activeJob = null;
  pendingFinishedGpsSummary = null;
  state.maintenance = [];
  state.maintenanceHistory = [];
  state.settings = normalizeSettings({
    appMode: null,
    accountPromptComplete: true,
    setupComplete: false,
    businessName: "",
    subscriptionPlan: "free",
    measurementSystem: state.settings.measurementSystem || "us",
    currency: state.settings.currency || "USD"
  });
  clearEditState();
  persistWithoutSyncTracking(() => {
    ["equipment", "fields", "customers", "operators", "implements", "jobs", "invoices", "activeJob", "maintenance", "maintenanceHistory", "settings"].forEach((key) => persist(key));
  });
  setSyncMeta({
    status: "local",
    pending: false,
    message: "Saved locally"
  });
  setDefaultJobTimes();
  renderAll();
}

async function downloadAllAccountData() {
  let backupData = getBackupData();
  let accountEmail = state.cloudSession?.email || "local-only";
  let cloudUpdatedAt = state.cloudSession?.lastSync || null;

  if (state.cloudSession?.token) {
    const payload = await cloudRequest("/api/farm");
    backupData = payload.farm.data;
    accountEmail = payload.email;
    cloudUpdatedAt = payload.farm.updatedAt;
  }

  const backup = {
    app: "Tractor Tracker",
    exportType: "account-data",
    version: 11,
    exportedAt: new Date().toISOString(),
    accountEmail,
    cloudUpdatedAt,
    data: backupData
  };
  const backupDate = new Date().toISOString().slice(0, 10);
  downloadFile(`tractor-tracker-account-data-${backupDate}.json`, JSON.stringify(backup, null, 2), "application/json");
}

function renderCloudAccount() {
  const session = state.cloudSession;
  const isConnected = Boolean(session?.token);
  const canSync = true;
  const registerFarm = document.querySelector("#register-farm");
  elements.cloudStatus.textContent = canSync
    ? (isConnected ? "Connected to Tractor Tracker cloud sync." : "Log in or create an account to sync this device.")
    : planUpgradeMessage("Cloud backup and device syncing");
  elements.cloudFarmName.textContent = session?.farmName || "Not connected";
  elements.cloudAccountEmail.textContent = session?.email || "Not connected";
  elements.cloudLastSync.textContent = formatSyncTime(session?.lastSync);
  elements.logoutAccount.hidden = !isConnected;
  elements.uploadCloud.disabled = !isConnected || !canSync;
  elements.downloadCloud.disabled = !isConnected || !canSync;
  elements.logoutAllDevices.disabled = !isConnected;
  elements.deleteCloudData.disabled = !isConnected;
  elements.deleteAccount.disabled = !isConnected;
  elements.registerForm.hidden = isConnected;
  elements.loginForm.hidden = isConnected;
  elements.changePasswordForm.hidden = !isConnected;

  if (!registerFarm.value) {
    registerFarm.value = state.settings.businessName || "Home Farm";
  }
}

function renderSubscriptionPlan() {
  elements.subscriptionPrice.textContent = "Beta";
  elements.subscriptionStatus.textContent = "Free Unlimited Beta is active. Unlimited records, reports, exports, backups, and cloud sync are open during beta.";
  elements.freePlanCard.classList.add("active-plan");
  elements.farmPlanCard.hidden = true;
  elements.activateFarmPlan.hidden = true;
  elements.useFreePlan.disabled = true;
  elements.activateFarmPlan.disabled = true;
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
  const passwordResetNeeded = shouldShowPasswordResetScreen();
  const accountChoiceNeeded = shouldShowAccountChooser();
  const modeWasChosen = Boolean(state.settings.appMode);

  document.body.dataset.appMode = getAppMode();
  document.body.dataset.subscriptionPlan = getActivePlanKey();
  elements.resetPasswordScreen.hidden = !passwordResetNeeded;
  elements.accountChooser.hidden = passwordResetNeeded || !accountChoiceNeeded;
  elements.modeChooser.hidden = passwordResetNeeded || accountChoiceNeeded || modeWasChosen;
  elements.setupWizard.hidden = passwordResetNeeded || accountChoiceNeeded || !shouldShowSetupWizard();
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
      conflictFarm: null,
      conflictUpdatedAt: null,
      message: "Synced"
    });
    showCloudMessage(manual ? "This device is synced." : "Synced.", "success");
  } catch (error) {
    if (error.status === 409) {
      const cloudUpdatedAt = error.payload?.farm?.updatedAt;
      setSyncMeta({
        status: "conflict",
        pending: true,
        conflictFarm: error.payload?.farm || null,
        conflictUpdatedAt: cloudUpdatedAt || null,
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

async function forceUploadLocalCopy() {
  if (!isCloudSyncReady()) {
    renderSyncStatus();
    return;
  }

  const farmName = state.cloudSession?.farmName || state.settings.businessName || "Home Farm";
  const payload = await cloudRequest("/api/farm", {
    method: "POST",
    body: JSON.stringify({
      farmName,
      data: getBackupData()
    })
  });
  saveCloudSession(sessionFromPayload(payload));
  setSyncMeta({
    status: "synced",
    pending: false,
    lastSyncedAt: payload.farm?.updatedAt || new Date().toISOString(),
    conflictFarm: null,
    conflictUpdatedAt: null,
    message: "Synced"
  });
  showCloudMessage("This device copy was saved to the cloud.", "success");
}

async function downloadFarmFromCloud() {
  const payload = await cloudRequest("/api/farm");
  const restoredData = normalizeRestoredBackup(payload.farm.data);
  restoredData.settings = normalizeSettings({
    ...restoredData.settings,
    accountPromptComplete: true
  });
  restoreFarmBackup(restoredData, { source: "cloud", cloudUpdatedAt: payload.farm.updatedAt });
  saveCloudSession(sessionFromPayload(payload));
  setSyncMeta({
    status: "synced",
    pending: false,
    lastSyncedAt: payload.farm.updatedAt,
    conflictFarm: null,
    conflictUpdatedAt: null,
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

function getBackupActiveJob() {
  if (!state.activeJob) {
    return null;
  }

  if (!state.activeJob.gps) {
    return state.activeJob;
  }

  return {
    ...state.activeJob,
    gps: {
      ...normalizeGps(state.activeJob.gps),
      enabled: false,
      lastPoint: null,
      lastError: ""
    }
  };
}

function getBackupData() {
  return {
    equipment: state.equipment,
    fields: state.fields,
    customers: state.customers,
    operators: state.operators,
    implements: state.implements,
    jobs: state.jobs,
    invoices: state.invoices,
    activeJob: getBackupActiveJob(),
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
    invoices: Array.isArray(restoredData.invoices) ? restoredData.invoices : [],
    activeJob: restoredData.activeJob ? {
      ...restoredData.activeJob,
      gps: normalizeGps({ ...restoredData.activeJob.gps, enabled: false })
    } : null,
    maintenance: restoredData.maintenance,
    maintenanceHistory: Array.isArray(restoredData.maintenanceHistory) ? restoredData.maintenanceHistory : [],
    settings: normalizeSettings(restoredData.settings || {})
  };
}

function restoreFarmBackup(restoredData, options = {}) {
  stopGpsTracking({ markStopped: false, silent: true });
  pendingFinishedGpsSummary = null;
  state.equipment = restoredData.equipment;
  state.fields = restoredData.fields;
  state.customers = restoredData.customers;
  state.operators = restoredData.operators;
  state.implements = restoredData.implements;
  state.jobs = restoredData.jobs;
  state.invoices = restoredData.invoices;
  state.activeJob = restoredData.activeJob;
  state.maintenance = restoredData.maintenance;
  state.maintenanceHistory = restoredData.maintenanceHistory;
  state.settings = restoredData.settings;
  clearEditState();
  persistWithoutSyncTracking(() => {
    ["equipment", "fields", "customers", "operators", "implements", "jobs", "invoices", "activeJob", "maintenance", "maintenanceHistory", "settings"].forEach((key) => persist(key));
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
      conflictFarm: null,
      conflictUpdatedAt: null,
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

function getInvoicedJobIds() {
  return new Set(state.invoices.flatMap((invoice) => invoice.jobIds || []));
}

function getCustomerInvoiceJobs(customerId) {
  const customerFieldIds = new Set(state.fields.filter((field) => field.customerId === customerId).map((field) => field.id));
  const invoicedJobIds = getInvoicedJobIds();
  return state.jobs.filter((job) => customerFieldIds.has(job.fieldId) && !invoicedJobIds.has(job.id));
}

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  return `TT-${year}-${String(state.invoices.length + 1).padStart(3, "0")}`;
}

function buildInvoice(customerId, values) {
  const customer = getCustomerById(customerId);
  const jobs = getCustomerInvoiceJobs(customerId);
  const distanceUnit = getPreferredDistanceUnit();
  const hourlyRate = Number(values.hourlyRate || 0);
  const distanceRate = Number(values.distanceRate || 0);
  const loadRate = Number(values.loadRate || 0);
  const materialCharge = Number(values.materialCharge || 0);
  const equipmentCharge = Number(values.equipmentCharge || 0);
  const taxRate = Number(values.taxRate || 0);

  const lineItems = jobs.map((job) => {
    const details = getJobDetails(job);
    const distance = getDistanceForUnit(job, distanceUnit);
    const loads = Number(job.loads || 0);
    const amount = (details.duration * hourlyRate) + (distance * distanceRate) + (loads * loadRate);
    return {
      jobId: job.id,
      date: job.end || job.start,
      jobType: job.type,
      jobSite: details.fieldName,
      equipment: details.equipmentName,
      hours: details.duration,
      distance,
      distanceUnit,
      loads,
      materialType: job.materialType || "",
      amount
    };
  });

  if (materialCharge > 0) {
    lineItems.push({ description: "Material charge", amount: materialCharge });
  }

  if (equipmentCharge > 0) {
    lineItems.push({ description: "Equipment charge", amount: equipmentCharge });
  }

  const subtotal = lineItems.reduce((total, item) => total + Number(item.amount || 0), 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  return {
    id: id(),
    number: values.number || nextInvoiceNumber(),
    createdAt: new Date().toISOString(),
    customerId,
    customerName: customer?.name || "",
    company: customer?.company || "",
    address: customer?.address || "",
    email: customer?.email || "",
    jobIds: jobs.map((job) => job.id),
    hourlyRate,
    distanceRate,
    distanceUnit,
    loadRate,
    materialCharge,
    equipmentCharge,
    taxRate,
    subtotal,
    tax,
    total,
    paid: values.paid,
    lineItems
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

function normalizeGps(gps = {}) {
  return {
    enabled: Boolean(gps.enabled),
    distanceMiles: Number(gps.distanceMiles || 0),
    pointCount: Number(gps.pointCount || 0),
    startedAt: gps.startedAt || null,
    stoppedAt: gps.stoppedAt || null,
    lastPoint: gps.lastPoint || null,
    lastUpdatedAt: gps.lastUpdatedAt || null,
    lastAccuracy: Number(gps.lastAccuracy || 0),
    lastError: gps.lastError || ""
  };
}

function gpsIsAvailable() {
  return Boolean(window.navigator?.geolocation) && window.isSecureContext !== false;
}

function gpsDistanceBetweenPoints(pointA, pointB) {
  const radiusMeters = 6371000;
  const lat1 = pointA.latitude * Math.PI / 180;
  const lat2 = pointB.latitude * Math.PI / 180;
  const deltaLat = (pointB.latitude - pointA.latitude) * Math.PI / 180;
  const deltaLng = (pointB.longitude - pointA.longitude) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGpsSummary(job) {
  const gps = normalizeGps(job?.gps);
  if (!gps.pointCount && !gps.distanceMiles) {
    return null;
  }

  return {
    distanceMiles: gps.distanceMiles,
    pointCount: gps.pointCount,
    startedAt: gps.startedAt,
    stoppedAt: gps.stoppedAt || new Date().toISOString(),
    lastAccuracy: gps.lastAccuracy || null
  };
}

function renderGpsPanel() {
  const isActive = Boolean(state.activeJob);
  elements.gpsPanel.hidden = !isActive;

  if (!isActive) {
    elements.gpsDistance.textContent = `0.0 ${unitLabel(getPreferredDistanceUnit())}`;
    elements.gpsStatus.textContent = "GPS is ready for the active job.";
    elements.gpsPoints.textContent = "";
    elements.startGps.disabled = true;
    elements.stopGps.disabled = true;
    return;
  }

  const gps = normalizeGps(state.activeJob.gps);
  const unit = elements.jobDistanceUnit.value || getPreferredDistanceUnit();
  const distance = milesToDistance(gps.distanceMiles, unit);
  elements.gpsDistance.textContent = `${number(distance, 2)} ${unitLabel(unit)}`;
  elements.startGps.disabled = !gpsIsAvailable() || gpsWatchId !== null;
  elements.stopGps.disabled = gpsWatchId === null;

  if (!gpsIsAvailable()) {
    elements.gpsStatus.textContent = "GPS needs location permission and HTTPS.";
  } else if (gpsWatchId !== null) {
    elements.gpsStatus.textContent = gps.lastAccuracy
      ? `Tracking. Last accuracy about ${number(gps.lastAccuracy, 0)} meters.`
      : "Tracking. Waiting for the first GPS point.";
  } else if (gps.enabled) {
    elements.gpsStatus.textContent = "GPS paused. Start GPS to resume this job.";
  } else if (gps.distanceMiles > 0) {
    elements.gpsStatus.textContent = "GPS stopped. Distance will be added when this job is finished.";
  } else {
    elements.gpsStatus.textContent = "GPS is ready for the active job.";
  }

  if (gps.lastError) {
    elements.gpsStatus.textContent = gps.lastError;
  }

  elements.gpsPoints.textContent = gps.pointCount
    ? `${number(gps.pointCount, 0)} GPS points${gps.lastUpdatedAt ? ` / Last update ${dateTime(gps.lastUpdatedAt)}` : ""}`
    : "";
}

function updateActiveJobGps(gps) {
  if (!state.activeJob) {
    return;
  }

  state.activeJob = {
    ...state.activeJob,
    gps
  };
  persist("activeJob");
  renderGpsPanel();
}

function handleGpsPosition(position) {
  if (!state.activeJob) {
    stopGpsTracking({ markStopped: false, silent: true });
    return;
  }

  const accuracy = Number(position.coords.accuracy || 0);
  const gps = normalizeGps(state.activeJob.gps);

  if (accuracy && accuracy > GPS_MAX_ACCURACY_METERS) {
    updateActiveJobGps({
      ...gps,
      lastAccuracy: accuracy,
      lastError: `GPS accuracy is low (${number(accuracy, 0)} meters). Waiting for a better signal.`
    });
    return;
  }

  const point = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy,
    timestamp: new Date(position.timestamp || Date.now()).toISOString()
  };

  let distanceMiles = gps.distanceMiles;
  let pointCount = gps.pointCount;
  let acceptedPoint = !gps.lastPoint;

  if (gps.lastPoint) {
    const stepMeters = gpsDistanceBetweenPoints(gps.lastPoint, point);
    if (stepMeters >= GPS_MIN_STEP_METERS) {
      distanceMiles += stepMeters / METERS_PER_MILE;
      acceptedPoint = true;
    }
  }

  if (!acceptedPoint) {
    renderGpsPanel();
    return;
  }

  pointCount += 1;
  updateActiveJobGps({
    ...gps,
    enabled: true,
    distanceMiles,
    pointCount,
    startedAt: gps.startedAt || point.timestamp,
    stoppedAt: null,
    lastPoint: point,
    lastUpdatedAt: point.timestamp,
    lastAccuracy: accuracy,
    lastError: ""
  });
}

function handleGpsError(error) {
  const gps = normalizeGps(state.activeJob?.gps);
  const message = error.code === error.PERMISSION_DENIED
    ? "Location permission was denied. Turn on location access to use GPS distance."
    : "GPS signal is unavailable right now.";

  if (state.activeJob) {
    updateActiveJobGps({
      ...gps,
      enabled: false,
      lastError: message
    });
  }
  stopGpsTracking({ markStopped: false, silent: true });
  showMessage(message, "error");
}

function startGpsTracking({ silent = false } = {}) {
  if (!state.activeJob) {
    showMessage("Start a job timer before starting GPS.", "error");
    return;
  }

  if (!gpsIsAvailable()) {
    showMessage("GPS needs location permission and HTTPS.", "error");
    renderGpsPanel();
    return;
  }

  if (gpsWatchId !== null) {
    renderGpsPanel();
    return;
  }

  const gps = normalizeGps(state.activeJob.gps);
  updateActiveJobGps({
    ...gps,
    enabled: true,
    startedAt: gps.startedAt || new Date().toISOString(),
    stoppedAt: null,
    lastError: ""
  });

  gpsWatchId = window.navigator.geolocation.watchPosition(handleGpsPosition, handleGpsError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000
  });
  renderGpsPanel();

  if (!silent) {
    showMessage("GPS tracking started.", "success");
  }
}

function stopGpsTracking({ markStopped = true, silent = false } = {}) {
  if (gpsWatchId !== null && window.navigator?.geolocation) {
    window.navigator.geolocation.clearWatch(gpsWatchId);
  }
  gpsWatchId = null;

  if (state.activeJob?.gps && markStopped) {
    updateActiveJobGps({
      ...normalizeGps(state.activeJob.gps),
      enabled: false,
      stoppedAt: new Date().toISOString()
    });
  } else {
    renderGpsPanel();
  }

  if (!silent) {
    showMessage("GPS tracking stopped.", "success");
  }
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
  renderGpsPanel();
}

function renderActiveJobTimer() {
  syncActiveJobForm();
  updateJobTimer();
  renderGpsPanel();
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
    const gpsLine = job.gpsSummary
      ? `<p><strong>GPS:</strong> ${number(milesToDistance(job.gpsSummary.distanceMiles, job.distanceUnit || getPreferredDistanceUnit()), 2)} ${unitLabel(job.distanceUnit || getPreferredDistanceUnit())} from ${number(job.gpsSummary.pointCount || 0, 0)} points</p>`
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
            ${gpsLine}
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
      const doneDisabled = isCompleted ? `disabled title="Already marked done. Due again at ${number(item.dueHours)} engine hours."` : "";
      const doneButtonText = isCompleted ? "Completed" : isDue ? "Done" : "Done Early";
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

function renderInvoices() {
  elements.invoiceSection.hidden = !isContractingMode();

  if (!isContractingMode()) {
    return;
  }

  renderSelect(elements.invoiceCustomer, state.customers, "Choose customer");
  elements.invoiceDistanceRateLabel.textContent = `Per-${unitLabel(getPreferredDistanceUnit())} charge`;

  if (!elements.invoiceNumber.value) {
    elements.invoiceNumber.placeholder = nextInvoiceNumber();
  }

  elements.invoiceList.innerHTML = "";

  if (!state.invoices.length) {
    elements.invoiceList.innerHTML = '<div class="empty-state">No invoices created yet.</div>';
    return;
  }

  [...state.invoices].reverse().forEach((invoice) => {
    elements.invoiceList.insertAdjacentHTML("beforeend", `
      <article class="list-item">
        <div class="list-item-row">
          <div>
            <h3>${escapeHtml(invoice.number)}</h3>
            <p>${escapeHtml(invoice.customerName || "Customer")} ${invoice.company ? `/ ${escapeHtml(invoice.company)}` : ""}</p>
            <p><strong>Total:</strong> ${currency(invoice.total)} / <strong>Status:</strong> ${invoice.paid ? "Paid" : "Unpaid"} / <strong>Jobs:</strong> ${(invoice.jobIds || []).length}</p>
            <span class="status-pill ${invoice.paid ? "done" : "warn"}">${invoice.paid ? "Paid" : "Unpaid"}</span>
          </div>
          <div class="item-actions">
            <button class="small-button secondary-button" data-print-invoice="${invoice.id}" type="button">Print</button>
            <button class="small-button secondary-button" data-toggle-invoice-paid="${invoice.id}" type="button">${invoice.paid ? "Mark Unpaid" : "Mark Paid"}</button>
            <button class="small-button ghost-button" data-delete-invoice="${invoice.id}" type="button">Delete</button>
          </div>
        </div>
      </article>
    `);
  });
}

function printInvoice(invoice) {
  const rows = (invoice.lineItems || []).map((item) => {
    const description = item.description || `${item.jobType} - ${item.jobSite}`;
    const details = item.description
      ? ""
      : `${dateTime(item.date)} / ${item.equipment} / ${number(item.hours)} hrs / ${number(item.distance)} ${unitLabel(item.distanceUnit)} / ${number(item.loads || 0, 0)} loads${item.materialType ? ` / ${item.materialType}` : ""}`;
    return `
      <tr>
        <td>${escapeHtml(description)}<br><small>${escapeHtml(details)}</small></td>
        <td>${currency(item.amount)}</td>
      </tr>
    `;
  }).join("");

  const invoiceHtml = `
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(invoice.number)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #20241e; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #315f36; padding-bottom: 16px; }
          h1 { margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { border-bottom: 1px solid #dce3d5; padding: 10px; text-align: left; vertical-align: top; }
          th:last-child, td:last-child { text-align: right; }
          .totals { margin-left: auto; width: 320px; }
          .status { display: inline-block; padding: 6px 10px; background: ${invoice.paid ? "#d9efe1" : "#fff1c7"}; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Print</button>
        <header>
          <div>
            <h1>Invoice ${escapeHtml(invoice.number)}</h1>
            <p>Tractor Tracker</p>
          </div>
          <div>
            <p><strong>Date:</strong> ${dateTime(invoice.createdAt)}</p>
            <p><strong>Status:</strong> <span class="status">${invoice.paid ? "Paid" : "Unpaid"}</span></p>
          </div>
        </header>
        <section>
          <h2>Bill To</h2>
          <p>${escapeHtml(invoice.customerName || "")}${invoice.company ? `<br>${escapeHtml(invoice.company)}` : ""}${invoice.address ? `<br>${escapeHtml(invoice.address)}` : ""}${invoice.email ? `<br>${escapeHtml(invoice.email)}` : ""}</p>
        </section>
        <table>
          <thead><tr><th>Work</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <table class="totals">
          <tbody>
            <tr><td>Subtotal</td><td>${currency(invoice.subtotal)}</td></tr>
            <tr><td>Tax (${number(invoice.taxRate, 2)}%)</td><td>${currency(invoice.tax)}</td></tr>
            <tr><th>Total</th><th>${currency(invoice.total)}</th></tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showInvoiceMessage("Allow pop-ups to print the invoice.", "error");
    return;
  }
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();
  printWindow.focus();
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
  renderInvoices();
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

elements.jobDistanceUnit.addEventListener("change", () => {
  renderAppModeContent();
  renderGpsPanel();
});

elements.startGps.addEventListener("click", () => startGpsTracking());

elements.stopGps.addEventListener("click", () => stopGpsTracking());

elements.useCurrentWeather.addEventListener("click", async () => {
  showMessage("Getting current weather...", "success");
  elements.useCurrentWeather.disabled = true;

  try {
    elements.jobWeather.value = await fetchCurrentWeather();
    showMessage("Current weather added to this job.", "success");
  } catch (error) {
    showMessage(error.message || "Weather could not be loaded right now.", "error");
  } finally {
    elements.useCurrentWeather.disabled = false;
  }
});

elements.startJob.addEventListener("click", () => {
  showMessage("");
  const mode = getModeCopy();
  pendingFinishedGpsSummary = null;

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
    start: toDateTimeLocal(new Date()),
    gps: normalizeGps()
  };
  persist("activeJob");
  renderAll();
  showMessage("Job timer started.", "success");
});

elements.finishJob.addEventListener("click", () => {
  if (!state.activeJob) {
    return;
  }

  stopGpsTracking({ markStopped: true, silent: true });
  const finishedJob = state.activeJob;
  const gpsSummary = buildGpsSummary(finishedJob);
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
  pendingFinishedGpsSummary = gpsSummary;

  if (gpsSummary?.distanceMiles > 0) {
    const unit = getPreferredDistanceUnit();
    elements.jobDistanceUnit.value = unit;
    elements.jobDistance.value = number(milesToDistance(gpsSummary.distanceMiles, unit), 2);
  }

  (isContractingMode() ? elements.jobLoads : elements.jobAcres).focus();
  const gpsText = gpsSummary?.distanceMiles > 0
    ? ` GPS added ${number(milesToDistance(gpsSummary.distanceMiles, getPreferredDistanceUnit()), 2)} ${unitLabel(getPreferredDistanceUnit())}.`
    : "";
  showMessage(isContractingMode() ? `Job timer finished.${gpsText} Add loads, fuel, material, and notes, then save the job.` : `Job timer finished.${gpsText} Add acres, fuel, and notes, then save the job.`, "success");
});

elements.cancelJob.addEventListener("click", () => {
  if (!state.activeJob || !window.confirm("Cancel this active job timer?")) {
    return;
  }

  stopGpsTracking({ markStopped: false, silent: true });
  state.activeJob = null;
  pendingFinishedGpsSummary = null;
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
  pendingFinishedGpsSummary = null;
  elements.jobForm.reset();
  setDefaultJobTimes();
  renderAll();
  showMessage(oldJob ? "Job updated successfully." : "Job saved successfully.", "success");
});

elements.cancelJobEdit.addEventListener("click", () => {
  state.editingJobId = null;
  pendingFinishedGpsSummary = null;
  elements.jobForm.reset();
  setDefaultJobTimes();
  renderAll();
  showMessage("Job edit canceled.", "success");
});

elements.feedbackForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!elements.feedbackNotes.value.trim()) {
    elements.feedbackNotes.focus();
    return;
  }

  window.location.href = buildFeedbackMailto();
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
    accountPromptComplete: state.settings.accountPromptComplete,
    setupComplete: state.settings.setupComplete,
    businessName: elements.settingsBusinessName.value.trim(),
    subscriptionPlan: getActivePlanKey(),
    measurementSystem: elements.measurementSystem.value,
    currency: elements.currencyCode.value
  };
  persist("settings");
  renderAll();
});

elements.accountChooser.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-account-choice]");

  if (!choice) {
    return;
  }

  const wantsLogin = choice.dataset.accountChoice === "login";
  elements.startupLoginForm.hidden = !wantsLogin;
  elements.startupRegisterForm.hidden = wantsLogin;
  showStartupCloudMessage("");

  if (wantsLogin) {
    elements.startupLoginEmail.focus();
  } else {
    elements.startupRegisterFarm.value = state.settings.businessName || "";
    elements.startupRegisterFarm.focus();
  }
});

elements.continueLocal.addEventListener("click", () => {
  showStartupCloudMessage("");
  completeAccountPrompt();
});

elements.startupLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStartupCloudMessage("Logging in and downloading your cloud records...", "success");

  try {
    await logInToCloud(elements.startupLoginEmail.value.trim(), elements.startupLoginPassword.value);
    elements.startupLoginForm.reset();
    showCloudMessage("Logged in. Cloud records downloaded to this device.", "success");
    showStartupCloudMessage("");
  } catch (error) {
    showStartupCloudMessage(error.message, "error");
  }
});

elements.startupForgotPassword.addEventListener("click", async () => {
  showStartupCloudMessage("");
  if (!elements.startupLoginEmail.value.trim()) {
    elements.startupLoginEmail.focus();
  }
  elements.startupForgotPassword.disabled = true;
  elements.startupForgotPassword.textContent = "Sending...";
  try {
    await requestPasswordReset(elements.startupLoginEmail.value, showStartupCloudMessage);
  } catch (error) {
    showStartupCloudMessage(error.message, "error");
  } finally {
    elements.startupForgotPassword.disabled = false;
    elements.startupForgotPassword.textContent = "Forgot Password";
  }
});

elements.startupRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStartupCloudMessage("Creating your account...", "success");

  try {
    await createCloudAccount({
      farmName: elements.startupRegisterFarm.value.trim(),
      email: elements.startupRegisterEmail.value.trim(),
      password: elements.startupRegisterPassword.value
    });
    elements.startupRegisterForm.reset();
    showCloudMessage("Account created and this device is synced.", "success");
    showStartupCloudMessage("");
  } catch (error) {
    showStartupCloudMessage(error.message, "error");
  }
});

elements.resetPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showResetMessage("");

  if (elements.resetNewPassword.value !== elements.resetConfirmPassword.value) {
    showResetMessage("Passwords do not match.", "error");
    return;
  }

  try {
    const payload = await cloudRequest("/api/password/reset", {
      method: "POST",
      body: JSON.stringify({
        token: passwordResetToken,
        newPassword: elements.resetNewPassword.value
      })
    });
    passwordResetToken = null;
    window.history.replaceState({}, "", window.location.pathname);
    elements.resetPasswordForm.reset();
    showResetMessage(payload.message, "success");
    state.settings = normalizeSettings({
      ...state.settings,
      accountPromptComplete: false
    });
    persist("settings");
    setTimeout(renderAll, 800);
  } catch (error) {
    showResetMessage(error.message, "error");
  }
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
  state.invoices = [];
  state.activeJob = null;
  state.maintenance = [];
  state.maintenanceHistory = [];

  persistWithoutSyncTracking(() => {
    ["settings", "equipment", "customers", "operators", "implements", "fields", "jobs", "invoices", "activeJob", "maintenance", "maintenanceHistory"].forEach((key) => persist(key));
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
  showCloudMessage("Free Unlimited Beta is active.", "success");
});

elements.activateFarmPlan.addEventListener("click", () => {
  showCloudMessage("Unlimited memberships are coming later after beta testing.", "error");
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

  if (button.dataset.printInvoice) {
    const invoice = state.invoices.find((item) => item.id === button.dataset.printInvoice);
    if (invoice) {
      printInvoice(invoice);
    }
  }

  if (button.dataset.toggleInvoicePaid) {
    state.invoices = state.invoices.map((invoice) => (
      invoice.id === button.dataset.toggleInvoicePaid
        ? { ...invoice, paid: !invoice.paid }
        : invoice
    ));
    persist("invoices");
    renderAll();
  }

  if (button.dataset.deleteInvoice) {
    if (window.confirm("Delete this invoice? Jobs will become available for a new invoice.")) {
      state.invoices = state.invoices.filter((invoice) => invoice.id !== button.dataset.deleteInvoice);
      persist("invoices");
      renderAll();
    }
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
    if (!item || !equipment) {
      window.alert("This maintenance reminder could not be completed because its equipment record is missing.");
      button.disabled = false;
      return;
    }

    if (item && equipment) {
      const completedHours = Number(equipment.hours || 0);
      const previousDueHours = Number(item.dueHours || 0);

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
      showBackupMessage(`${item.name} marked done.`, "success");
    }
  }
});

elements.clearJobs.addEventListener("click", () => {
  if (!window.confirm("Delete all saved job history from this device? Equipment hours will stay as-is.")) {
    return;
  }

  state.jobs = [];
  state.invoices = [];
  state.editingJobId = null;
  persist("jobs");
  persist("invoices");
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
  stopGpsTracking({ markStopped: false, silent: true });
  state.activeJob = null;
  pendingFinishedGpsSummary = null;
  state.invoices = [];
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
    accountPromptComplete: state.settings.accountPromptComplete,
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

  try {
    await createCloudAccount({
      farmName: document.querySelector("#register-farm").value.trim(),
      email: document.querySelector("#register-email").value.trim(),
      password: document.querySelector("#register-password").value
    });
    elements.registerForm.reset();
    showCloudMessage("Account created and this device is synced.", "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showCloudMessage("");

  try {
    await logInToCloud(
      document.querySelector("#login-email").value.trim(),
      document.querySelector("#login-password").value
    );
    elements.loginForm.reset();
    showCloudMessage("Logged in. Cloud records downloaded to this device.", "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.forgotPassword.addEventListener("click", async () => {
  showCloudMessage("");
  const loginEmail = document.querySelector("#login-email");
  if (!loginEmail.value.trim()) {
    loginEmail.focus();
  }
  elements.forgotPassword.disabled = true;
  elements.forgotPassword.textContent = "Sending...";
  try {
    await requestPasswordReset(loginEmail.value, showCloudMessage);
  } catch (error) {
    showCloudMessage(error.message, "error");
  } finally {
    elements.forgotPassword.disabled = false;
    elements.forgotPassword.textContent = "Forgot Password";
  }
});

elements.changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showCloudMessage("");

  try {
    const payload = await cloudRequest("/api/password/change", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: elements.currentPassword.value,
        newPassword: elements.newPassword.value
      })
    });
    elements.changePasswordForm.reset();
    saveCloudSession(null);
    showCloudMessage(payload.message, "success");
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

elements.logoutAllDevices.addEventListener("click", async () => {
  showCloudMessage("");

  if (!window.confirm("Log out this account from every device?")) {
    return;
  }

  try {
    const payload = await cloudRequest("/api/logout-all", { method: "POST", body: "{}" });
    saveCloudSession(null);
    showCloudMessage(payload.message, "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
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

elements.retrySync.addEventListener("click", async () => {
  showCloudMessage("");

  try {
    await syncLocalChanges({ manual: true });
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.useCloudCopy.addEventListener("click", async () => {
  showCloudMessage("");

  if (!window.confirm("Use the newer cloud copy on this device? This will replace local unsynced changes.")) {
    return;
  }

  try {
    if (state.syncMeta.conflictFarm?.data) {
      const restoredData = normalizeRestoredBackup(state.syncMeta.conflictFarm.data);
      restoredData.settings = normalizeSettings({
        ...restoredData.settings,
        accountPromptComplete: true
      });
      restoreFarmBackup(restoredData, { source: "cloud", cloudUpdatedAt: state.syncMeta.conflictFarm.updatedAt });
      saveCloudSession(sessionFromPayload({ email: state.cloudSession.email, farm: state.syncMeta.conflictFarm }));
      showCloudMessage("Cloud copy restored to this device.", "success");
      return;
    }

    await downloadFarmFromCloud();
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.keepDeviceCopy.addEventListener("click", async () => {
  showCloudMessage("");

  if (!window.confirm("Keep this device copy and overwrite the cloud copy?")) {
    return;
  }

  try {
    await forceUploadLocalCopy();
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.downloadAccountData.addEventListener("click", async () => {
  showCloudMessage("");

  try {
    await downloadAllAccountData();
    showCloudMessage("Account data downloaded.", "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.invoiceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  showInvoiceMessage("");

  const customerId = elements.invoiceCustomer.value;
  if (!customerId) {
    showInvoiceMessage("Choose a customer first.", "error");
    return;
  }

  const jobs = getCustomerInvoiceJobs(customerId);
  if (!jobs.length) {
    showInvoiceMessage("No uninvoiced jobs found for that customer.", "error");
    return;
  }

  const invoice = buildInvoice(customerId, {
    number: elements.invoiceNumber.value.trim(),
    hourlyRate: elements.invoiceHourlyRate.value,
    distanceRate: elements.invoiceDistanceRate.value,
    loadRate: elements.invoiceLoadRate.value,
    materialCharge: elements.invoiceMaterialCharge.value,
    equipmentCharge: elements.invoiceEquipmentCharge.value,
    taxRate: elements.invoiceTaxRate.value,
    paid: elements.invoicePaidStatus.value === "paid"
  });

  state.invoices.push(invoice);
  persist("invoices");
  elements.invoiceForm.reset();
  renderAll();
  showInvoiceMessage(`Invoice ${invoice.number} created.`, "success");
});

elements.deleteCloudData.addEventListener("click", async () => {
  showCloudMessage("");

  if (!window.confirm("Delete all cloud records for this account? This keeps the login but clears synced data.")) {
    return;
  }

  const password = promptForAccountPassword("delete cloud data");
  if (password === null) {
    return;
  }

  try {
    const payload = await cloudRequest("/api/farm/delete-cloud", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    const restoredData = normalizeRestoredBackup(payload.farm.data);
    restoredData.settings = normalizeSettings({
      ...restoredData.settings,
      accountPromptComplete: true
    });
    restoreFarmBackup(restoredData, { source: "cloud", cloudUpdatedAt: payload.farm.updatedAt });
    saveCloudSession(sessionFromPayload(payload));
    showCloudMessage("Cloud data deleted. This device now has a blank synced account.", "success");
  } catch (error) {
    showCloudMessage(error.message, "error");
  }
});

elements.deleteAccount.addEventListener("click", async () => {
  showCloudMessage("");

  if (!window.confirm("Delete this Tractor Tracker account and all cloud data? This cannot be undone.")) {
    return;
  }

  const password = promptForAccountPassword("delete this account");
  if (password === null) {
    return;
  }

  try {
    const payload = await cloudRequest("/api/account/delete", {
      method: "POST",
      body: JSON.stringify({ password })
    });
    saveCloudSession(null);
    clearLocalFarmDataAfterDeletion();
    showCloudMessage(payload.message, "success");
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
hidePreloader();
setInterval(updateJobTimer, 1000);

if (window.navigator && "serviceWorker" in window.navigator) {
  window.addEventListener("load", () => {
    window.navigator.serviceWorker.register("sw.js?v=31").catch((error) => {
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
