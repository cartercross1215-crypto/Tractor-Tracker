/* Tractor Tracker fuel type + location-assisted pricing add-on */
(() => {
  if (window.__tractorFuelLocationPricesInstalled) {
    return;
  }
  window.__tractorFuelLocationPricesInstalled = true;

  const LOCATION_MATCH_LIMIT_MILES = 100;
  let pendingFuelPriceLocation = null;
  let lastJobFuelLocation = null;
  let getJobFormDataWasPatched = false;
  let renderAllWasPatched = false;

  const FUEL_TYPE_OPTIONS = [
    { value: "Diesel", label: "Diesel" },
    { value: "Gasoline", label: "Gas" },
    { value: "Red diesel", label: "Red diesel" },
    { value: "DEF", label: "DEF" },
    { value: "Other", label: "Other" }
  ];

  function normalizeFuelType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["gas", "gasoline", "regular", "regular gas", "unleaded"].includes(normalized)) {
      return "Gasoline";
    }
    // "Off-road diesel" was the original label. Keep the old spellings as aliases so
    // records saved before the rename still match and keep their price.
    if ([
      "red diesel",
      "red",
      "dyed diesel",
      "dyed",
      "farm diesel",
      "offroad",
      "off-road",
      "off road",
      "off-road diesel",
      "off road diesel"
    ].includes(normalized)) {
      return "Red diesel";
    }
    if (normalized === "def") {
      return "DEF";
    }
    if (normalized.includes("diesel")) {
      return "Diesel";
    }
    if (normalized === "other") {
      return "Other";
    }
    return value || "Diesel";
  }

  function fuelTypeLabel(value) {
    const type = normalizeFuelType(value);
    return FUEL_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
  }

  function renderFuelTypeOptions(select, selectedValue = "Diesel") {
    if (!select) {
      return;
    }
    const selected = normalizeFuelType(selectedValue || select.value || "Diesel");
    select.innerHTML = FUEL_TYPE_OPTIONS
      .map((option) => `<option value="${option.value}">${option.label}</option>`)
      .join("");
    select.value = selected;
  }

  function ensureFuelLocationUi() {
    const fuelTypeSelect = document.querySelector("#fuel-price-type");
    if (fuelTypeSelect && !fuelTypeSelect.dataset.normalizedFuelTypes) {
      renderFuelTypeOptions(fuelTypeSelect, fuelTypeSelect.value || "Diesel");
      fuelTypeSelect.dataset.normalizedFuelTypes = "true";
    }

    const fuelPriceNotesLabel = document.querySelector("#fuel-price-notes")?.closest("label");
    if (fuelPriceNotesLabel && !document.querySelector("#use-location-fuel-price")) {
      fuelPriceNotesLabel.insertAdjacentHTML("afterend", `
        <div class="form-actions full-width fuel-location-actions">
          <button id="use-location-fuel-price" type="button" class="secondary-button">Use My Location</button>
          <small id="fuel-location-status" class="muted-text">Uses your location to label this price area and match nearby saved prices.</small>
        </div>
      `);
    }

    const jobFuelPriceAreaLabel = document.querySelector("#job-fuel-price-area")?.closest("label");
    if (jobFuelPriceAreaLabel && !document.querySelector("#job-fuel-type")) {
      jobFuelPriceAreaLabel.insertAdjacentHTML("beforebegin", `
        <label>Fuel type<select id="job-fuel-type"></select></label>
      `);
      renderFuelTypeOptions(document.querySelector("#job-fuel-type"), "Diesel");
    }

    const jobFuelPriceHint = document.querySelector("#job-fuel-price-hint");
    if (jobFuelPriceHint && !document.querySelector("#use-location-job-fuel-price")) {
      jobFuelPriceHint.insertAdjacentHTML("beforebegin", `
        <div class="form-actions full-width fuel-location-actions">
          <button id="use-location-job-fuel-price" type="button" class="secondary-button">Use Location for Fuel Price</button>
        </div>
      `);
    }

    Object.assign(elements, {
      fuelPriceType: document.querySelector("#fuel-price-type"),
      useLocationFuelPrice: document.querySelector("#use-location-fuel-price"),
      fuelLocationStatus: document.querySelector("#fuel-location-status"),
      jobFuelType: document.querySelector("#job-fuel-type"),
      useLocationJobFuelPrice: document.querySelector("#use-location-job-fuel-price")
    });
  }

  function showFuelLocationStatus(message, type = "") {
    if (!elements.fuelLocationStatus) {
      showMessage(message, type);
      return;
    }
    elements.fuelLocationStatus.textContent = message;
    elements.fuelLocationStatus.className = `muted-text ${type}`;
  }

  function getCurrentPositionForFuel() {
    return new Promise((resolve, reject) => {
      if (!window.navigator?.geolocation || window.isSecureContext === false) {
        reject(new Error("Location needs HTTPS and browser location permission."));
        return;
      }
      window.navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 10 * 60 * 1000,
        timeout: 15000
      });
    });
  }

  async function reverseFuelLocation(latitude, longitude) {
    const fallback = {
      areaName: `Near ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`,
      city: "",
      state: "",
      latitude,
      longitude
    };

    try {
      const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      url.searchParams.set("latitude", latitude);
      url.searchParams.set("longitude", longitude);
      url.searchParams.set("localityLanguage", "en");
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        return fallback;
      }
      const payload = await response.json();
      const city = payload.city || payload.locality || payload.localityInfo?.administrative?.[3]?.name || "";
      const stateName = payload.principalSubdivision || payload.localityInfo?.administrative?.[1]?.name || "";
      const areaName = [city, stateName].filter(Boolean).join(", ") || fallback.areaName;
      return {
        areaName,
        city,
        state: stateName,
        latitude,
        longitude
      };
    } catch (error) {
      return fallback;
    }
  }

  // Nearby fuel stations come from OpenStreetMap via Overpass: free, no API key, no
  // billing account. OSM carries station name/brand/address but NOT pump prices, so the
  // farmer still confirms the price -- this just tells them which stop they are standing at
  // instead of guessing a town name. Two mirrors because the main one throttles.
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  const STATION_SEARCH_RADIUS_METERS = 8000;
  const STATION_RESULT_LIMIT = 8;

  function stationDisplayName(tags = {}) {
    return tags.name || tags.brand || tags.operator || "Unnamed fuel stop";
  }

  function stationAddress(tags = {}) {
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const town = [tags["addr:city"], tags["addr:state"]].filter(Boolean).join(", ");
    return [street, town].filter(Boolean).join(", ");
  }

  async function fetchNearbyFuelStations(latitude, longitude) {
    const query = `[out:json][timeout:20];nwr["amenity"="fuel"](around:${STATION_SEARCH_RADIUS_METERS},${latitude},${longitude});out center tags ${STATION_RESULT_LIMIT * 4};`;
    const origin = { latitude, longitude };

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: query }).toString(),
          cache: "no-store"
        });
        if (!response.ok) {
          continue;
        }
        const payload = await response.json();
        const stations = (payload.elements || [])
          .map((element) => {
            const stationLat = element.lat ?? element.center?.lat;
            const stationLon = element.lon ?? element.center?.lon;
            if (!Number.isFinite(stationLat) || !Number.isFinite(stationLon)) {
              return null;
            }
            const tags = element.tags || {};
            return {
              name: stationDisplayName(tags),
              brand: tags.brand || "",
              address: stationAddress(tags),
              hasDiesel: tags["fuel:diesel"] === "yes",
              latitude: stationLat,
              longitude: stationLon,
              distanceMiles: distanceMilesBetween(origin, { latitude: stationLat, longitude: stationLon })
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.distanceMiles - b.distanceMiles)
          .slice(0, STATION_RESULT_LIMIT);
        if (stations.length) {
          return stations;
        }
      } catch (error) {
        // Offline, throttled, or blocked -- fall through to the next mirror, then to
        // city/state naming. Station lookup is a convenience, never a hard requirement.
      }
    }
    return [];
  }

  function locationHeadline(location) {
    if (location?.station) {
      const address = location.station.address ? ` (${location.station.address})` : "";
      return `At ${location.station.name}${address}, ${number(location.station.distanceMiles, 1)} mi away.`;
    }
    return `Location found: ${location?.areaName || "unknown area"}. No mapped fuel stop within ${Math.round(STATION_SEARCH_RADIUS_METERS / 1609)} mi.`;
  }

  function describeStation(station) {
    if (!station) {
      return "";
    }
    return [
      station.name,
      `${number(station.distanceMiles, 1)} mi away`,
      station.address
    ].filter(Boolean).join(" · ");
  }

  async function getDeviceFuelLocation() {
    const position = await getCurrentPositionForFuel();
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const location = await reverseFuelLocation(latitude, longitude);
    const stations = await fetchNearbyFuelStations(latitude, longitude);
    const nearestStation = stations[0] || null;
    return {
      ...location,
      // The fuel stop itself is the supplier, so use it as the area name when we found one.
      // City/state stays available as placeName for the fallback wording.
      areaName: nearestStation ? nearestStation.name : location.areaName,
      placeName: location.areaName,
      stations,
      station: nearestStation,
      stationAddress: nearestStation?.address || "",
      stationDistanceMiles: nearestStation?.distanceMiles ?? null,
      accuracy: Number(position.coords.accuracy || 0),
      capturedAt: new Date().toISOString()
    };
  }

  function distanceMilesBetween(pointA, pointB) {
    if (!pointA || !pointB) {
      return Infinity;
    }
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const radiusMiles = 3958.7613;
    const deltaLat = toRadians(Number(pointB.latitude) - Number(pointA.latitude));
    const deltaLon = toRadians(Number(pointB.longitude) - Number(pointA.longitude));
    const lat1 = toRadians(Number(pointA.latitude));
    const lat2 = toRadians(Number(pointB.latitude));
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 2 * radiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function matchingFuelTypes(savedType, wantedType) {
    const saved = normalizeFuelType(savedType);
    const wanted = normalizeFuelType(wantedType);
    if (wanted === "Red diesel") {
      return saved === "Red diesel" || saved === "Diesel";
    }
    return saved === wanted;
  }

  function findNearestSavedFuelPrice(location, fuelType) {
    if (!location) {
      return null;
    }
    return (state.fuelPrices || [])
      .filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
      .filter((item) => matchingFuelTypes(item.fuelType, fuelType))
      .map((item) => ({
        ...item,
        distanceMiles: distanceMilesBetween(location, item)
      }))
      .filter((item) => item.distanceMiles <= LOCATION_MATCH_LIMIT_MILES)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)[0] || null;
  }

  function estimateStartingPrice(fuelType) {
    const type = normalizeFuelType(fuelType);
    if (type === "Gasoline") return 3.50;
    if (type === "Red diesel") return 3.70;
    if (type === "DEF") return 4.00;
    if (type === "Diesel") return 3.90;
    return 0;
  }

  function updateJobFuelHint(message) {
    const hint = document.querySelector("#job-fuel-price-hint");
    if (hint) {
      hint.textContent = message;
    } else {
      showMessage(message, "success");
    }
  }

  function setJobFuelFromSavedPrice(savedPrice, location = null) {
    if (!savedPrice || !elements.jobFuelPriceArea || !elements.jobFuelPrice || !elements.jobFuelPriceUnit) {
      return false;
    }
    elements.jobFuelPriceArea.value = savedPrice.id;
    elements.jobFuelPrice.value = savedPrice.price || "";
    elements.jobFuelPriceUnit.value = savedPrice.priceUnit || getPreferredFuelUnit();
    if (elements.jobFuelType) {
      elements.jobFuelType.value = normalizeFuelType(savedPrice.fuelType || elements.jobFuelType.value || "Diesel");
    }
    const distanceText = Number.isFinite(savedPrice.distanceMiles)
      ? ` about ${number(savedPrice.distanceMiles, 1)} mi away`
      : "";
    const locationText = location?.areaName ? ` near ${location.areaName}` : "";
    updateJobFuelHint(`Using ${fuelTypeLabel(savedPrice.fuelType)} price from ${savedPrice.areaName}${distanceText}${locationText}: ${currency(savedPrice.price)}/${unitLabel(savedPrice.priceUnit || getPreferredFuelUnit())}.`);
    return true;
  }

  async function fillFuelPriceFromLocation() {
    ensureFuelLocationUi();
    const type = elements.fuelPriceType?.value || "Diesel";
    showFuelLocationStatus("Asking for location...", "success");
    try {
      const location = await getDeviceFuelLocation();
      pendingFuelPriceLocation = location;
      const nearest = findNearestSavedFuelPrice(location, type);
      document.querySelector("#fuel-price-area").value = location.areaName;
      document.querySelector("#fuel-price-type").value = normalizeFuelType(type);
      document.querySelector("#fuel-price-unit").value = getPreferredFuelUnit();

      const notes = document.querySelector("#fuel-price-notes");
      notes.value = [
        `Location captured ${new Date(location.capturedAt).toLocaleString()}`,
        location.station ? `Fuel stop: ${describeStation(location.station)}` : "",
        location.placeName ? `Area: ${location.placeName}` : "",
        location.accuracy ? `GPS accuracy about ${number(location.accuracy, 0)} meters` : "",
        nearest ? `Nearest saved ${fuelTypeLabel(type)} price was ${nearest.areaName} (${number(nearest.distanceMiles, 1)} mi away).` : ""
      ].filter(Boolean).join(" / ");

      if (nearest) {
        document.querySelector("#fuel-price-value").value = nearest.price || "";
        document.querySelector("#fuel-price-unit").value = nearest.priceUnit || getPreferredFuelUnit();
        showFuelLocationStatus(`${locationHeadline(location)} Pulled nearest saved ${fuelTypeLabel(type)} price from ${nearest.areaName}. Verify before saving.`, "success");
      } else {
        const estimate = estimateStartingPrice(type);
        document.querySelector("#fuel-price-value").value = estimate || "";
        showFuelLocationStatus(`${locationHeadline(location)} No saved ${fuelTypeLabel(type)} price nearby yet; estimate filled as a starter. Verify the pump price before saving.`, "success");
      }
    } catch (error) {
      showFuelLocationStatus(error.message || "Location could not be read.", "error");
    }
  }

  async function applyFuelPriceFromJobLocation() {
    ensureFuelLocationUi();
    const type = elements.jobFuelType?.value || "Diesel";
    updateJobFuelHint("Asking for location to find the nearest saved fuel price...");
    try {
      const location = await getDeviceFuelLocation();
      lastJobFuelLocation = location;
      const nearest = findNearestSavedFuelPrice(location, type);
      if (nearest && setJobFuelFromSavedPrice(nearest, location)) {
        return;
      }
      const estimate = estimateStartingPrice(type);
      if (elements.jobFuelPriceArea) {
        elements.jobFuelPriceArea.value = "";
      }
      if (elements.jobFuelPrice) {
        elements.jobFuelPrice.value = estimate || "";
      }
      if (elements.jobFuelPriceUnit) {
        elements.jobFuelPriceUnit.value = getPreferredFuelUnit();
      }
      updateJobFuelHint(`${locationHeadline(location)} No saved ${fuelTypeLabel(type)} price within ${LOCATION_MATCH_LIMIT_MILES} mi, so a starter estimate was filled. Verify the actual pump price before saving this job.`);
    } catch (error) {
      updateJobFuelHint(error.message || "Location could not be read for fuel pricing.");
    }
  }

  function attachFuelPriceLocationToSavedRecord(fuelPrice) {
    if (!pendingFuelPriceLocation) {
      return fuelPrice;
    }
    return {
      ...fuelPrice,
      areaName: fuelPrice.areaName || pendingFuelPriceLocation.areaName,
      latitude: pendingFuelPriceLocation.latitude,
      longitude: pendingFuelPriceLocation.longitude,
      city: pendingFuelPriceLocation.city || "",
      state: pendingFuelPriceLocation.state || "",
      stationName: pendingFuelPriceLocation.station?.name || "",
      stationBrand: pendingFuelPriceLocation.station?.brand || "",
      stationAddress: pendingFuelPriceLocation.stationAddress || "",
      locationAccuracy: pendingFuelPriceLocation.accuracy || null,
      locationCapturedAt: pendingFuelPriceLocation.capturedAt || new Date().toISOString(),
      source: "device-location"
    };
  }

  function saveFuelPriceWithLocation(event) {
    if (!event.target?.matches?.("#fuel-price-form")) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    const previous = (state.fuelPrices || []).find((item) => item.id === state.editingFuelPriceId);
    let fuelPrice = {
      id: state.editingFuelPriceId || id(),
      areaName: document.querySelector("#fuel-price-area").value.trim(),
      fuelType: normalizeFuelType(document.querySelector("#fuel-price-type").value),
      price: Number(document.querySelector("#fuel-price-value").value || 0),
      priceUnit: document.querySelector("#fuel-price-unit").value || getPreferredFuelUnit(),
      notes: document.querySelector("#fuel-price-notes").value.trim(),
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latitude: previous?.latitude || null,
      longitude: previous?.longitude || null,
      city: previous?.city || "",
      state: previous?.state || "",
      locationAccuracy: previous?.locationAccuracy || null,
      locationCapturedAt: previous?.locationCapturedAt || null,
      source: previous?.source || "manual"
    };
    fuelPrice = attachFuelPriceLocationToSavedRecord(fuelPrice);

    if (state.editingFuelPriceId) {
      state.fuelPrices = state.fuelPrices.map((item) => item.id === state.editingFuelPriceId ? fuelPrice : item);
      state.editingFuelPriceId = null;
    } else {
      state.fuelPrices.push(fuelPrice);
    }

    pendingFuelPriceLocation = null;
    persist("fuelPrices");
    elements.fuelPriceForm.reset();
    renderAll();
    showMessage(`${fuelTypeLabel(fuelPrice.fuelType)} price saved for ${fuelPrice.areaName}.`, "success");
  }

  function patchJobFormDataForFuelType() {
    if (getJobFormDataWasPatched) {
      return;
    }
    getJobFormDataWasPatched = true;
    const previousGetJobFormData = getJobFormData;
    getJobFormData = function fuelLocationJobFormData(jobId = id()) {
      const job = previousGetJobFormData(jobId);
      const selectedSavedPrice = (state.fuelPrices || []).find((item) => item.id === elements.jobFuelPriceArea?.value);
      const selectedFuelType = normalizeFuelType(elements.jobFuelType?.value || selectedSavedPrice?.fuelType || job.fuelType || "Diesel");
      return {
        ...job,
        fuelType: selectedFuelType,
        fuelPriceAreaName: selectedSavedPrice?.areaName || job.fuelPriceAreaName || lastJobFuelLocation?.areaName || "",
        fuelPriceLocation: lastJobFuelLocation ? {
          areaName: lastJobFuelLocation.areaName,
          latitude: lastJobFuelLocation.latitude,
          longitude: lastJobFuelLocation.longitude,
          city: lastJobFuelLocation.city || "",
          state: lastJobFuelLocation.state || "",
          capturedAt: lastJobFuelLocation.capturedAt
        } : job.fuelPriceLocation || null
      };
    };
  }

  function patchRenderAllForFuelLocation() {
    if (renderAllWasPatched) {
      return;
    }
    renderAllWasPatched = true;
    const previousRenderAll = renderAll;
    renderAll = function fuelLocationRenderAll() {
      previousRenderAll();
      ensureFuelLocationUi();
      bindFuelLocationEvents();
    };
  }

  function bindFuelLocationEvents() {
    ensureFuelLocationUi();

    if (elements.fuelPriceForm && !elements.fuelPriceForm.dataset.locationSubmitBound) {
      elements.fuelPriceForm.addEventListener("submit", saveFuelPriceWithLocation, true);
      elements.fuelPriceForm.dataset.locationSubmitBound = "true";
    }

    if (elements.useLocationFuelPrice && !elements.useLocationFuelPrice.dataset.bound) {
      elements.useLocationFuelPrice.addEventListener("click", fillFuelPriceFromLocation);
      elements.useLocationFuelPrice.dataset.bound = "true";
    }

    if (elements.useLocationJobFuelPrice && !elements.useLocationJobFuelPrice.dataset.bound) {
      elements.useLocationJobFuelPrice.addEventListener("click", applyFuelPriceFromJobLocation);
      elements.useLocationJobFuelPrice.dataset.bound = "true";
    }

    if (elements.jobFuelType && !elements.jobFuelType.dataset.bound) {
      elements.jobFuelType.addEventListener("change", () => {
        const selectedSavedPrice = (state.fuelPrices || []).find((item) => item.id === elements.jobFuelPriceArea?.value);
        if (selectedSavedPrice && !matchingFuelTypes(selectedSavedPrice.fuelType, elements.jobFuelType.value)) {
          elements.jobFuelPriceArea.value = "";
          elements.jobFuelPrice.value = "";
        }
        updateJobFuelHint(`Fuel type set to ${fuelTypeLabel(elements.jobFuelType.value)}. Choose a saved area or use location for a nearby saved price.`);
      });
      elements.jobFuelType.dataset.bound = "true";
    }

    if (elements.jobFuelPriceArea && !elements.jobFuelPriceArea.dataset.locationBound) {
      elements.jobFuelPriceArea.addEventListener("change", () => {
        const savedPrice = (state.fuelPrices || []).find((item) => item.id === elements.jobFuelPriceArea.value);
        if (savedPrice && elements.jobFuelType) {
          elements.jobFuelType.value = normalizeFuelType(savedPrice.fuelType || elements.jobFuelType.value || "Diesel");
        }
      });
      elements.jobFuelPriceArea.dataset.locationBound = "true";
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.dataset.editFuelPrice) {
      const fuelPrice = (state.fuelPrices || []).find((item) => item.id === button.dataset.editFuelPrice);
      if (fuelPrice) {
        pendingFuelPriceLocation = fuelPrice.latitude && fuelPrice.longitude ? {
          areaName: fuelPrice.areaName,
          latitude: fuelPrice.latitude,
          longitude: fuelPrice.longitude,
          city: fuelPrice.city || "",
          state: fuelPrice.state || "",
          accuracy: fuelPrice.locationAccuracy || null,
          capturedAt: fuelPrice.locationCapturedAt || new Date().toISOString()
        } : null;
        window.setTimeout(() => {
          ensureFuelLocationUi();
          renderFuelTypeOptions(document.querySelector("#fuel-price-type"), fuelPrice.fuelType || "Diesel");
        }, 0);
      }
    }

    if (button.dataset.editJob) {
      const job = state.jobs.find((item) => item.id === button.dataset.editJob);
      if (job) {
        window.setTimeout(() => {
          ensureFuelLocationUi();
          if (elements.jobFuelType) {
            elements.jobFuelType.value = normalizeFuelType(job.fuelType || "Diesel");
          }
          lastJobFuelLocation = job.fuelPriceLocation || null;
        }, 0);
      }
    }
  });

  ensureFuelLocationUi();
  patchJobFormDataForFuelType();
  patchRenderAllForFuelLocation();
  bindFuelLocationEvents();
  renderAll();
})();
