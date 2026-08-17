const STORAGE_KEY = "rideplan.v1";
const BACKUP_META_KEY = "rideplan.backup-meta.v1";
const config = window.RIDEPLAN_CONFIG || {};
const tripSlug = config.tripSlug || "summer-2026";

let supabaseClient = null;
let remoteReady = false;
let saveTimer = null;
let lastRemoteJson = "";
let hasUnsyncedChanges = false;
const expandedLocations = new Set();

const categories = ["fuel", "lodging", "food", "attractions", "repairs", "tolls", "parking", "misc"];
const stopCategories = ["hotel", "restaurant", "fuel", "attraction", "repair", "emergency", "other"];
const locationTypes = ["overnight", "fuel area", "meal town", "scenic area", "meet-up", "backup", "other"];
const priorities = ["must-see", "good option", "backup", "skip if tired"];
const statuses = ["considering", "planned", "booked", "paid", "done", "skipped"];
const checklistGroups = ["Packing", "Bike", "Documents"];
const removedLocationLabels = new Set(["mountain pass", "highway junction", "friends town", "friends' town", "lake stopover"]);
const removedLocationReplacements = new Map([
  ["friends town", "Meet-up area"],
  ["friends' town", "Meet-up area"],
  ["lake stopover", "Scenic overnight"],
]);

const islandFuelStations = [
  { corridor: "Hwy 1", community: "Langford", name: "Peninsula Co-op", address: "894 Goldstream Avenue", lat: 48.4506467, lon: -123.5051438, hours: "Verify before departure", note: "Convenient south-Island departure fuel." },
  { corridor: "Hwy 1", community: "Malahat", name: "Malahat Gas", address: "231 Trans-Canada Highway", lat: 48.5429689, lon: -123.564839, hours: "Verify before departure", note: "Directly on the Malahat corridor." },
  { corridor: "Hwy 1", community: "Mill Bay", name: "Peninsula Co-op", address: "805 Deloume Road", lat: 48.6527607, lon: -123.559366, hours: "Verify before departure", note: "Useful regrouping stop north of the Malahat." },
  { corridor: "Hwy 1", community: "Duncan", name: "Peninsula Co-op", address: "281 Trans-Canada Highway", lat: 48.7765358, lon: -123.699236, hours: "Verify before departure", note: "On the main highway through Duncan." },
  { corridor: "Hwy 1", community: "Chemainus", name: "Mid Island Co-op", address: "9355 Smiley Road", lat: 48.9075256, lon: -123.7294054, hours: "Verify before departure", note: "Near the Mt. Sicker/Chemainus junction." },
  { corridor: "Hwy 1", community: "Ladysmith", name: "Ivy Green Husky", address: "12615 Trans-Canada Highway", lat: 49.0152945, lon: -123.8525941, hours: "Verify before departure", note: "Highway-side fuel south of Nanaimo." },
  { corridor: "Hwy 1", community: "Nanaimo", name: "Petro-Canada", address: "1271 Trans-Canada Highway", lat: 49.130538, lon: -123.922648, hours: "Mapped as 24/7", note: "South Nanaimo anchor before choosing an Island route." },
  { corridor: "Hwy 19/19A", community: "Nanoose Bay", name: "Petro-Canada", address: "2345 East Island Highway", lat: 49.264038, lon: -124.1998467, hours: "Mapped as 24/7", note: "Easy access along the old Island Highway." },
  { corridor: "Hwy 19/19A", community: "Parksville", name: "Mid Island Co-op", address: "222 East Island Highway", lat: 49.3200992, lon: -124.307464, hours: "Verify before departure", note: "Central Parksville fuel near the waterfront route." },
  { corridor: "Hwy 19/19A", community: "Qualicum Beach", name: "Petro-Canada", address: "655 Memorial Avenue", lat: 49.3477818, lon: -124.4418463, hours: "Verify before departure", note: "Useful before continuing on 19A or returning to 19." },
  { corridor: "Hwy 19", community: "Horne Lake", name: "Petro-Canada", address: "700 Horne Lake Road", lat: 49.37071, lon: -124.6187, hours: "Verify before departure", note: "Highway 19 interchange fuel." },
  { corridor: "Hwy 19/19A", community: "Buckley Bay", name: "Petro-Canada", address: "6856 South Island Highway", lat: 49.5252455, lon: -124.8490642, hours: "Verify before departure", note: "Fuel near the Denman Island ferry junction." },
  { corridor: "Hwy 19/19A", community: "Courtenay", name: "Shell", address: "2591 Cliffe Avenue", lat: 49.6763347, lon: -124.98344, hours: "Verify before departure", note: "Central Comox Valley option on Highway 19A." },
  { corridor: "Hwy 19/19A", community: "Campbell River", name: "Shell", address: "150 Brant Drive", lat: 50.0146725, lon: -125.2845482, hours: "Verify before departure", note: "Recommended full-tank point before remote north-Island legs." },
  { corridor: "Hwy 19", community: "Sayward", name: "Mid Island Co-op", address: "1590 Sayward Road", lat: 50.3123366, lon: -125.9185445, hours: "Mapped 6:00 am–9:00 pm", note: "In Sayward village, off Highway 19; confirm hours." },
  { corridor: "Hwy 19", community: "Woss", name: "Woss Service", address: "Woss, BC", lat: 50.2129554, lon: -126.594803, hours: "Mapped 7:00 am–10:00 pm; Sunday 8:00 am", note: "Critical north-Island fuel; confirm availability before relying on it." },
  { corridor: "Hwy 19", community: "Port McNeill", name: "Petro-Canada", address: "1001 Hyde Creek Road", lat: 50.5718482, lon: -127.0108585, hours: "Verify before departure", note: "Major north-Island service town." },
  { corridor: "Hwy 19", community: "Port Hardy", name: "Esso", address: "8945 Granville Street", lat: 50.7204, lon: -127.499342, hours: "Mapped as 24/7", note: "Northern terminus fuel anchor." },
  { corridor: "Hwy 4", community: "Coombs", name: "Petro-Canada", address: "2484 Alberni Highway", lat: 49.3026957, lon: -124.435312, hours: "Verify before departure", note: "Fuel before crossing toward Port Alberni." },
  { corridor: "Hwy 4", community: "Port Alberni", name: "Tseshaht Market", address: "7581 Pacific Rim Highway", lat: 49.2778476, lon: -124.8849104, hours: "Mapped 7:00 am–10:00 pm", note: "Last full-service fuel before the west-coast communities; fill here." },
  { corridor: "Hwy 4", community: "Ucluelet", name: "Co-op Gas Bar", address: "2076 Peninsula Road", lat: 48.945801, lon: -125.563409, hours: "Mapped 6:00 am–10:00 pm", note: "West-coast anchor; last fuel on the Ucluelet branch." },
  { corridor: "Hwy 4", community: "Tofino", name: "Co-op Gas Bar", address: "797 Campbell Street", lat: 49.1450191, lon: -125.891621, hours: "Mapped 6:00 am–11:00 pm", note: "Fuel in Tofino at the north end of Highway 4." },
  { corridor: "Hwy 14", community: "Sooke", name: "Petro-Canada", address: "6692 Sooke Road", lat: 48.3777333, lon: -123.723672, hours: "Verify before departure", note: "Fill here before the remote coastal run to Port Renfrew." },
  { corridor: "Hwy 14", community: "Port Renfrew", name: "Pacheedaht Pit Stop", address: "16947 Parkinson Road", lat: 48.5579248, lon: -124.3987915, hours: "Limited and variable; call 250-647-0127", note: "Only local option; regular, diesel and propane. Do not arrive near closing on fumes." },
  { corridor: "Hwy 18 / Pacific Marine", community: "Lake Cowichan", name: "Tipton's Gas Bar", address: "14 North Shore Road", lat: 48.8280002, lon: -124.0538974, hours: "Verify before departure", note: "Primary fuel anchor for the Pacific Marine Circle Route." },
  { corridor: "Hwy 18 / Pacific Marine", community: "Youbou", name: "Daly's Auto Centre", address: "10514 Youbou Road", lat: 48.87372, lon: -124.205761, hours: "Verify before departure", note: "Secondary option west of Lake Cowichan; do not rely on it without calling." },
  { corridor: "Hwy 28", community: "Campbell River", name: "Petro-Canada", address: "465 Merecroft Road", lat: 49.9997088, lon: -125.246924, hours: "Verify before departure", note: "Fill before heading west; no dependable fuel along Highway 28." },
  { corridor: "Hwy 28", community: "Gold River", name: "Shell", address: "500 Muchalat Drive", lat: 49.7815215, lon: -126.0478658, hours: "Mapped 7:00 am–10:00 pm", note: "Western Highway 28 fuel anchor; confirm hours on remote travel days." },
];

const sampleData = {
  trip: {
    name: "Summer Motorcycle Trip",
    dates: "August 20-27, 2026",
    startDate: "2026-08-20",
    endDate: "2026-08-27",
    riders: "Brenden, wife, friend 1, friend 2",
    start: "Home",
    destination: "Friend's place and beyond",
    planningStatus: "Drafting route and stops",
  },
  routeDays: [
    {
      id: crypto.randomUUID(),
      title: "Meet-up ride",
      date: "2026-08-20",
      start: "Home",
      end: "TBD",
      overnight: "TBD",
      lodging: "",
      miles: 210,
      hours: 4.5,
      notes: "Keep this day relaxed so we arrive with energy to plan the next legs.",
    },
    {
      id: crypto.randomUUID(),
      title: "Scenic mountain loop",
      date: "2026-08-21",
      start: "TBD",
      end: "TBD",
      overnight: "TBD",
      lodging: "",
      miles: 265,
      hours: 6,
      notes: "Prefer scenic roads. Avoid long gravel sections unless confirmed manageable.",
    },
  ],
  locations: [
  ],
  stops: [
  ],
  bikes: [
    { id: crypto.randomUUID(), rider: "Brenden", bike: "Touring bike", tankGallons: 5.5, mpg: 42 },
    { id: crypto.randomUUID(), rider: "Friend 1", bike: "Cruiser", tankGallons: 4.8, mpg: 39 },
  ],
  fuelLogs: [
    {
      id: crypto.randomUUID(),
      date: "2026-07-10",
      rider: "Brenden",
      location: "Example fuel stop",
      gallons: 4.2,
      pricePerGallon: 4.79,
      odometer: 12450,
    },
  ],
  expenses: [
    {
      id: crypto.randomUUID(),
      description: "Hotel night 1",
      category: "lodging",
      estimated: 220,
      actual: 0,
      paidBy: "",
      split: "group",
      notes: "Waiting to choose hotel.",
    },
    {
      id: crypto.randomUUID(),
      description: "Meals day 1",
      category: "food",
      estimated: 160,
      actual: 0,
      paidBy: "",
      split: "individual",
      notes: "",
    },
  ],
  checklist: [
    { id: crypto.randomUUID(), group: "Packing", text: "Rain gear", done: false },
    { id: crypto.randomUUID(), group: "Packing", text: "Layered cold-weather gear", done: false },
    { id: crypto.randomUUID(), group: "Bike", text: "Check tire pressure and tread", done: false },
    { id: crypto.randomUUID(), group: "Bike", text: "Pack tire repair kit and pump", done: false },
    { id: crypto.randomUUID(), group: "Documents", text: "Insurance and registration", done: false },
    { id: crypto.randomUUID(), group: "Documents", text: "Emergency contacts", done: false },
  ],
  notes:
    "Planning questions:\n- Which route option gives us the best scenery without exhausting everyone?\n- Which towns have reliable fuel before longer stretches?\n- Which hotels have safe motorcycle parking?\n- What is the maximum daily mileage everyone is comfortable with?",
};

let state = loadState();

const pageTitle = document.querySelector("#pageTitle");
const saveStatus = document.querySelector("#saveStatus");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return cleanState();
  try {
    return cleanState(JSON.parse(saved));
  } catch {
    return cleanState();
  }
}

function loadBackupMeta() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_META_KEY)) || {};
  } catch {
    return {};
  }
}

function updateBackupMeta(changes) {
  const nextMeta = { ...loadBackupMeta(), ...changes };
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(nextMeta));
  renderBackupStatus();
  return nextMeta;
}

function formatBackupTime(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function renderBackupStatus() {
  const meta = loadBackupMeta();
  const localTime = document.querySelector("#lastLocalSave");
  const remoteTime = document.querySelector("#lastSupabaseSync");
  const snapshotTime = document.querySelector("#lastCloudSnapshot");
  const health = document.querySelector("#backupHealth");
  if (localTime) localTime.textContent = formatBackupTime(meta.lastLocalSave);
  if (remoteTime) remoteTime.textContent = formatBackupTime(meta.lastSupabaseSync);
  if (snapshotTime) snapshotTime.textContent = formatBackupTime(meta.lastCloudSnapshot);
  if (health) {
    health.textContent = hasUnsyncedChanges ? "Waiting to sync" : meta.lastSupabaseSync ? "Protected" : "Local only";
    health.classList.toggle("warning", hasUnsyncedChanges || !meta.lastSupabaseSync);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  hasUnsyncedChanges = true;
  updateBackupMeta({ lastLocalSave: new Date().toISOString() });
  if (!remoteReady) {
    saveStatus.textContent = "Saved locally";
    return;
  }
  saveStatus.textContent = "Saving to Supabase...";
  scheduleRemoteSave();
}

function cleanState(data) {
  const nextState = {
    ...structuredClone(sampleData),
    ...(data || {}),
    trip: { ...structuredClone(sampleData.trip), ...(data?.trip || {}) },
    routeDays: Array.isArray(data?.routeDays) ? data.routeDays : structuredClone(sampleData.routeDays),
    locations: Array.isArray(data?.locations) ? data.locations : structuredClone(sampleData.locations),
    stops: Array.isArray(data?.stops) ? data.stops : structuredClone(sampleData.stops),
    bikes: Array.isArray(data?.bikes) ? data.bikes : structuredClone(sampleData.bikes),
    fuelLogs: Array.isArray(data?.fuelLogs) ? data.fuelLogs : structuredClone(sampleData.fuelLogs),
    expenses: Array.isArray(data?.expenses) ? data.expenses : structuredClone(sampleData.expenses),
    checklist: Array.isArray(data?.checklist) ? data.checklist : structuredClone(sampleData.checklist),
    notes: typeof data?.notes === "string" ? data.notes : sampleData.notes,
  };
  removeDeletedLocationLabels(nextState);
  replaceDeletedRouteLabels(nextState);
  ensureCalendarDays(nextState);
  addMissingLocationsFromStops(nextState);
  return nextState;
}

function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getCalendarDateRange() {
  const start = parseDateInput(state.trip.startDate) || parseDateInput("2026-08-20");
  const end = parseDateInput(state.trip.endDate) || parseDateInput("2026-08-27");
  if (end < start) return [];

  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDateInput(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function ensureCalendarDays(nextState) {
  const start = parseDateInput(nextState.trip.startDate) || parseDateInput("2026-08-20");
  const end = parseDateInput(nextState.trip.endDate) || parseDateInput("2026-08-27");
  if (end < start) return;

  const knownDates = new Set(nextState.routeDays.map((day) => day.date).filter(Boolean));
  const current = new Date(start);
  while (current <= end) {
    const date = formatDateInput(current);
    if (!knownDates.has(date)) {
      nextState.routeDays.push({
        id: crypto.randomUUID(),
        title: "Open planning day",
        date,
        start: "",
        end: "",
        overnight: "",
        lodging: "",
        miles: 0,
        hours: 0,
        notes: "",
      });
      knownDates.add(date);
    }
    current.setDate(current.getDate() + 1);
  }
}

function formatCalendarDate(value) {
  const date = parseDateInput(value);
  if (!date) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function normalizeLocationLabel(value) {
  return String(value || "").trim().replaceAll("’", "'").toLowerCase();
}

function isRemovedLocationLabel(value) {
  return removedLocationLabels.has(normalizeLocationLabel(value));
}

function removeDeletedLocationLabels(nextState) {
  nextState.locations = nextState.locations.filter((location) => !isRemovedLocationLabel(location.name));
  nextState.stops = nextState.stops.filter((stop) => !isRemovedLocationLabel(stop.area));
}

function replaceDeletedRouteLabels(nextState) {
  nextState.routeDays = nextState.routeDays.map((day) => {
    const startKey = normalizeLocationLabel(day.start);
    const endKey = normalizeLocationLabel(day.end);
    return {
      ...day,
      start: removedLocationReplacements.get(startKey) || day.start,
      end: removedLocationReplacements.get(endKey) || day.end,
    };
  });
}

function addMissingLocationsFromStops(nextState) {
  const knownNames = new Set(nextState.locations.map((location) => location.name.trim().toLowerCase()).filter(Boolean));
  nextState.stops
    .map((stop) => stop.area?.trim())
    .filter((area) => area && !isRemovedLocationLabel(area))
    .forEach((area) => {
      if (knownNames.has(area.toLowerCase())) return;
      nextState.locations.push({
        id: crypto.randomUUID(),
        name: area,
        type: "other",
        region: "",
        day: 1,
        arrive: "",
        depart: "",
        reason: "Added from stops in this area.",
        notes: "",
      });
      knownNames.add(area.toLowerCase());
    });
}

function getLocationAttractions(location) {
  const locationName = location.name.trim().toLowerCase();
  return state.stops.filter((stop) => stop.category === "attraction" && stop.area?.trim().toLowerCase() === locationName);
}

function scheduleRemoteSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveRemoteState();
  }, 500);
}

async function saveRemoteState() {
  if (!supabaseClient) return;
  const data = cleanState(state);
  const nextJson = JSON.stringify(data);
  if (nextJson === lastRemoteJson) {
    saveStatus.textContent = "Synced with Supabase";
    return;
  }

  const { error } = await supabaseClient.from("trip_documents").upsert(
    {
      slug: tripSlug,
      data,
    },
    { onConflict: "slug" },
  );

  if (error) {
    console.error(error);
    saveStatus.textContent = "Saved locally; Supabase needs setup";
    return;
  }

  lastRemoteJson = nextJson;
  hasUnsyncedChanges = false;
  updateBackupMeta({ lastSupabaseSync: new Date().toISOString() });
  saveStatus.textContent = "Synced with Supabase";
  await createDailyCloudSnapshot(data);
}

async function createDailyCloudSnapshot(data) {
  if (!supabaseClient) return;
  const today = new Date().toISOString().slice(0, 10);
  const meta = loadBackupMeta();
  if (meta.lastSnapshotDate === today) return;

  const { error } = await supabaseClient.from("trip_document_snapshots").upsert(
    {
      trip_slug: tripSlug,
      snapshot_date: today,
      data,
    },
    { onConflict: "trip_slug,snapshot_date" },
  );

  if (error) {
    console.warn("Cloud snapshots need the latest Supabase schema.", error);
    return;
  }
  updateBackupMeta({ lastSnapshotDate: today, lastCloudSnapshot: new Date().toISOString() });
}

async function initSupabase() {
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
    saveStatus.textContent = "Saved locally";
    return;
  }

  saveStatus.textContent = "Connecting to Supabase...";
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { data, error } = await supabaseClient.from("trip_documents").select("data").eq("slug", tripSlug).maybeSingle();

  if (error) {
    console.error(error);
    saveStatus.textContent = "Saved locally; run Supabase schema";
    return;
  }

  remoteReady = true;

  if (data?.data) {
    const remoteJson = JSON.stringify(data.data);
    state = cleanState(data.data);
    const cleanJson = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastRemoteJson = remoteJson;
    hasUnsyncedChanges = false;
    render();
    if (cleanJson !== remoteJson) {
      await saveRemoteState();
    } else {
      saveStatus.textContent = "Loaded from Supabase";
      updateBackupMeta({ lastSupabaseSync: new Date().toISOString() });
    }
  } else {
    await saveRemoteState();
  }

  supabaseClient
    .channel("rideplan-trip-document")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trip_documents", filter: `slug=eq.${tripSlug}` },
      (payload) => {
        if (!payload.new?.data) return;
        const incoming = cleanState(payload.new.data);
        const incomingJson = JSON.stringify(incoming);
        if (incomingJson === lastRemoteJson) return;
        state = incoming;
        lastRemoteJson = incomingJson;
        localStorage.setItem(STORAGE_KEY, incomingJson);
        render();
        saveStatus.textContent = "Updated from Supabase";
      },
    )
    .subscribe();
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

function number(value, digits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number(value || 0));
}

function optionList(values, selected) {
  return values.map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`).join("");
}

function bindInput(container, object, field, onChange = () => {}) {
  const input = container.querySelector(`[data-field="${field}"]`);
  if (!input) return;
  input.value = object[field] ?? "";
  input.addEventListener("input", () => {
    object[field] = input.type === "number" ? Number(input.value) : input.value;
    saveStatus.textContent = "Saving...";
    saveState();
    onChange();
  });
}

function setView(viewId) {
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active-view", view.id === viewId));
  pageTitle.textContent = document.querySelector(`[data-view="${viewId}"]`).textContent;
}

function renderTripForm() {
  const fields = [
    ["name", "Trip name", "text"],
    ["dates", "Dates", "text"],
    ["startDate", "First day away", "date"],
    ["endDate", "Last day away", "date"],
    ["riders", "Riders", "text"],
    ["start", "Start", "text"],
    ["destination", "Destination", "text"],
    ["planningStatus", "Planning status", "text"],
  ];
  const form = document.querySelector("#tripForm");
  form.innerHTML = fields
    .map(([field, label, type]) => `<label>${label}<input data-field="${field}" type="${type}" /></label>`)
    .join("");
  fields.forEach(([field]) =>
    bindInput(form, state.trip, field, () => {
      if (field === "startDate" || field === "endDate") {
        ensureCalendarDays(state);
        saveState();
        renderCalendar();
        renderRoute();
      }
      renderBudgetSummary();
    }),
  );
}

function renderMetrics() {
  const totalMiles = state.routeDays.reduce((sum, day) => sum + Number(day.miles || 0), 0);
  const totalHours = state.routeDays.reduce((sum, day) => sum + Number(day.hours || 0), 0);
  const estimated = state.expenses.reduce((sum, expense) => sum + Number(expense.estimated || 0), 0);
  const actualExpenses = state.expenses.reduce((sum, expense) => sum + Number(expense.actual || 0), 0);
  const actualFuel = state.fuelLogs.reduce((sum, log) => sum + Number(log.gallons || 0) * Number(log.pricePerGallon || 0), 0);
  const gallons = state.fuelLogs.reduce((sum, log) => sum + Number(log.gallons || 0), 0);

  document.querySelector("#metricMiles").textContent = number(totalMiles);
  document.querySelector("#metricHours").textContent = number(totalHours, 1);
  document.querySelector("#metricEstimated").textContent = money(estimated);
  document.querySelector("#metricActual").textContent = money(actualExpenses + actualFuel);
  document.querySelector("#metricGallons").textContent = number(gallons, 2);
  document.querySelector("#metricFuelTotal").textContent = money(actualFuel);
}

function renderDashboardRoute() {
  const container = document.querySelector("#dashboardRoute");
  container.innerHTML = state.routeDays
    .map(
      (day, index) => `
      <div class="summary-row">
        <span>Day ${index + 1}</span>
        <div>
          <strong>${day.title || "Untitled route day"}</strong>
          <span>${day.start || "Start TBD"} to ${day.end || "End TBD"}</span>
        </div>
        <strong>${number(day.miles)} mi</strong>
      </div>`,
    )
    .join("");
}

function getRouteDayByDate(date) {
  return state.routeDays.find((day) => day.date === date);
}

function renderCalendar() {
  const grid = document.querySelector("#calendarGrid");
  if (!grid) return;

  ensureCalendarDays(state);
  grid.innerHTML = "";

  getCalendarDateRange().forEach((date, index) => {
    const day = getRouteDayByDate(date);
    if (!day) return;

    const card = document.createElement("article");
    card.className = "calendar-day-card";
    card.innerHTML = `
      <div class="calendar-day-head">
        <span class="pill">Day ${index + 1}</span>
        <strong>${formatCalendarDate(date)}</strong>
      </div>
      <div class="calendar-fields">
        <label>Plan title<input data-field="title" type="text" /></label>
        <label>Staying in<input data-field="overnight" type="text" /></label>
        <label>Lodging<input data-field="lodging" type="text" /></label>
        <label>Miles<input data-field="miles" type="number" min="0" /></label>
        <label class="full-span">Notes<textarea data-field="notes"></textarea></label>
      </div>
    `;

    ["title", "overnight", "lodging", "miles", "notes"].forEach((field) =>
      bindInput(card, day, field, () => {
        renderMetrics();
        renderDashboardRoute();
        renderRoute();
      }),
    );
    grid.append(card);
  });
}

function renderRoute() {
  const list = document.querySelector("#routeList");
  const template = document.querySelector("#routeTemplate");
  list.innerHTML = "";
  state.routeDays.forEach((day, index) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".route-card");
    card.querySelector(".route-day-label").textContent = `Day ${index + 1}`;
    ["title", "date", "start", "end", "overnight", "lodging", "miles", "hours", "notes"].forEach((field) =>
      bindInput(card, day, field, () => {
        renderMetrics();
        renderDashboardRoute();
        renderCalendar();
      }),
    );
    card.querySelector(".delete-route").addEventListener("click", () => {
      state.routeDays = state.routeDays.filter((item) => item.id !== day.id);
      saveState();
      render();
    });
    list.append(node);
  });
}

function renderLocations() {
  const list = document.querySelector("#locationsList");
  const template = document.querySelector("#locationTemplate");
  list.innerHTML = "";
  addMissingLocationsFromStops(state);
  state.locations.forEach((location) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".location-card");
    const attractions = getLocationAttractions(location);
    const isExpanded = expandedLocations.has(location.id);
    const toggle = card.querySelector(".location-toggle");
    const body = card.querySelector(".location-body");

    updateLocationSummary(card, location, attractions);
    card.querySelector('[data-field="type"]').innerHTML = optionList(locationTypes, location.type);
    body.hidden = !isExpanded;
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.addEventListener("click", () => {
      if (expandedLocations.has(location.id)) {
        expandedLocations.delete(location.id);
      } else {
        expandedLocations.add(location.id);
      }
      renderLocations();
    });
    ["name", "type", "reason"].forEach((field) =>
      bindInput(card, location, field, () => updateLocationSummary(card, location, attractions)),
    );
    card.querySelector(".delete-location").addEventListener("click", () => {
      const locationName = location.name.trim().toLowerCase();
      state.locations = state.locations.filter((item) => item.id !== location.id);
      state.stops = state.stops.filter((stop) => stop.area?.trim().toLowerCase() !== locationName);
      expandedLocations.delete(location.id);
      saveState();
      render();
    });
    renderLocationAttractions(card.querySelector(".location-attractions"), attractions);
    card.querySelector(".location-attraction-count").textContent = `${attractions.length} saved`;
    list.append(node);
  });
}

function updateLocationSummary(card, location, attractions) {
  card.querySelector(".location-name").textContent = location.name || "Unnamed location";
  card.querySelector(".location-meta").textContent = `${attractions.length} attraction${attractions.length === 1 ? "" : "s"}`;
  card.querySelector(".location-type").textContent = location.type || "location";
}

function renderLocationAttractions(container, attractions) {
  if (!attractions.length) {
    container.innerHTML = `<p class="empty-message">No attractions saved for this location yet.</p>`;
    return;
  }

  container.innerHTML = "";
  attractions.forEach((stop) => {
    const card = document.createElement("article");
    card.className = "attraction-bento-card";
    card.innerHTML = `
      <label>Name<input data-field="name" type="text" /></label>
      <label>Link<input data-field="link" type="url" /></label>
      <label>Description<textarea data-field="notes"></textarea></label>
    `;
    ["name", "link", "notes"].forEach((field) => bindInput(card, stop, field));
    container.append(card);
  });
}

function renderStops() {
  const list = document.querySelector("#stopsList");
  const template = document.querySelector("#stopTemplate");
  const category = document.querySelector("#stopCategoryFilter").value;
  const search = document.querySelector("#stopSearch").value.trim().toLowerCase();
  list.innerHTML = "";

  state.stops
    .filter((stop) => category === "all" || stop.category === category)
    .filter((stop) => !search || JSON.stringify(stop).toLowerCase().includes(search))
    .forEach((stop) => {
      const node = template.content.cloneNode(true);
      const card = node.querySelector(".stop-card");
      card.querySelector(".stop-category").textContent = stop.category;
      ["name", "link", "notes"].forEach((field) => bindInput(card, stop, field));
      card.querySelector(".delete-stop").addEventListener("click", () => {
        state.stops = state.stops.filter((item) => item.id !== stop.id);
        saveState();
        render();
      });
      list.append(node);
    });
}

function renderFuel() {
  renderFuelStations();
  renderBikes();
  renderFuelLogs();
}

function renderFuelStations() {
  const list = document.querySelector("#fuelStationList");
  const corridorFilter = document.querySelector("#fuelCorridorFilter");
  const searchInput = document.querySelector("#fuelStationSearch");
  if (!list || !corridorFilter || !searchInput) return;

  const corridor = corridorFilter.value;
  const query = searchInput.value.trim().toLowerCase();
  const matches = islandFuelStations.filter((station) => {
    const matchesCorridor = corridor === "all" || station.corridor === corridor;
    const haystack = `${station.name} ${station.community} ${station.address} ${station.note}`.toLowerCase();
    return matchesCorridor && haystack.includes(query);
  });

  list.innerHTML = matches
    .map(
      (station) => `
        <article class="fuel-station-card">
          <div class="fuel-station-head">
            <div>
              <span class="pill">${station.corridor}</span>
              <h4>${station.community} · ${station.name}</h4>
            </div>
            <a class="secondary-btn map-link" href="https://www.google.com/maps/search/?api=1&amp;query=${station.lat},${station.lon}" target="_blank" rel="noreferrer">Map</a>
          </div>
          <p class="station-address">${station.address}</p>
          <p>${station.note}</p>
          <p class="station-hours">${station.hours}</p>
        </article>
      `,
    )
    .join("");

  document.querySelector("#fuelStationCount").textContent = `${matches.length} station${matches.length === 1 ? "" : "s"}`;
}

function renderBikes() {
  const list = document.querySelector("#bikeList");
  const template = document.querySelector("#bikeTemplate");
  list.innerHTML = "";
  state.bikes.forEach((bike) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".mini-card");
    const range = document.createElement("div");
    range.className = "summary-row";
    updateBikeRange(range, bike);
    ["rider", "bike", "tankGallons", "mpg"].forEach((field) => bindInput(card, bike, field, () => updateBikeRange(range, bike)));
    card.append(range);
    card.querySelector(".delete-bike").addEventListener("click", () => {
      state.bikes = state.bikes.filter((item) => item.id !== bike.id);
      saveState();
      render();
    });
    list.append(node);
  });
}

function updateBikeRange(range, bike) {
  range.innerHTML = `<span>Range</span><strong>${number(Number(bike.tankGallons || 0) * Number(bike.mpg || 0))} miles</strong><span>planned</span>`;
}

function renderFuelLogs() {
  const list = document.querySelector("#fuelLogs");
  const template = document.querySelector("#fuelTemplate");
  list.innerHTML = "";
  state.fuelLogs.forEach((log) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".mini-card");
    card.querySelector(".fuel-rider").textContent = log.rider || "Fuel";
    const total = document.createElement("div");
    total.className = "summary-row";
    updateFuelLogSummary(card, total, log);
    ["date", "rider", "location", "gallons", "pricePerGallon", "odometer"].forEach((field) =>
      bindInput(card, log, field, () => {
        updateFuelLogSummary(card, total, log);
        renderMetrics();
        renderBudgetSummary();
      }),
    );
    card.append(total);
    card.querySelector(".delete-fuel").addEventListener("click", () => {
      state.fuelLogs = state.fuelLogs.filter((item) => item.id !== log.id);
      saveState();
      render();
    });
    list.append(node);
  });
}

function updateFuelLogSummary(card, total, log) {
  card.querySelector(".fuel-rider").textContent = log.rider || "Fuel";
  total.innerHTML = `<span>Total</span><strong>${money(Number(log.gallons || 0) * Number(log.pricePerGallon || 0))}</strong><span>${log.location || ""}</span>`;
}

function renderBudgetSummary() {
  const summary = document.querySelector("#budgetSummary");
  if (!summary) return;
  const estimated = state.expenses.reduce((sum, expense) => sum + Number(expense.estimated || 0), 0);
  const actual = state.expenses.reduce((sum, expense) => sum + Number(expense.actual || 0), 0);
  const fuel = state.fuelLogs.reduce((sum, log) => sum + Number(log.gallons || 0) * Number(log.pricePerGallon || 0), 0);
  const riders = Math.max(1, state.trip.riders.split(",").filter(Boolean).length);
  summary.innerHTML = `
    <div class="budget-row"><span>Estimated expenses</span><strong>${money(estimated)}</strong></div>
    <div class="budget-row"><span>Actual expenses</span><strong>${money(actual)}</strong></div>
    <div class="budget-row"><span>Fuel logged</span><strong>${money(fuel)}</strong></div>
    <div class="budget-row"><span>Per person actual</span><strong>${money((actual + fuel) / riders)}</strong></div>
  `;
}

function renderBudget() {
  renderBudgetSummary();
  const list = document.querySelector("#expenseList");
  const template = document.querySelector("#expenseTemplate");
  list.innerHTML = "";
  state.expenses.forEach((expense) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".expense-card");
    updateExpenseSummary(card, expense);
    card.querySelector('[data-field="category"]').innerHTML = optionList(categories, expense.category);
    card.querySelector('[data-field="split"]').innerHTML = optionList(["group", "individual", "couples", "custom"], expense.split);
    ["description", "category", "estimated", "actual", "paidBy", "split", "notes"].forEach((field) =>
      bindInput(card, expense, field, () => {
        updateExpenseSummary(card, expense);
        renderMetrics();
        renderBudgetSummary();
      }),
    );
    card.querySelector(".delete-expense").addEventListener("click", () => {
      state.expenses = state.expenses.filter((item) => item.id !== expense.id);
      saveState();
      render();
    });
    list.append(node);
  });
}

function updateExpenseSummary(card, expense) {
  card.querySelector(".expense-category").textContent = expense.category;
}

function renderChecklists() {
  const board = document.querySelector("#checklistBoard");
  board.innerHTML = checklistGroups
    .map(
      (group) => `
      <section class="check-group" data-group="${group}">
        <h4>${group}</h4>
        <div class="check-items"></div>
      </section>`,
    )
    .join("");

  state.checklist.forEach((item) => {
    const group = board.querySelector(`[data-group="${item.group}"] .check-items`) || board.querySelector(".check-items");
    const row = document.createElement("label");
    row.className = "check-item";
    row.innerHTML = `
      <input type="checkbox" ${item.done ? "checked" : ""} />
      <input type="text" value="${item.text.replaceAll('"', "&quot;")}" aria-label="Checklist item" />
      <select aria-label="Checklist group">${optionList(checklistGroups, item.group)}</select>
      <button class="icon-btn" type="button">Delete</button>
    `;
    row.querySelector('[type="checkbox"]').addEventListener("change", (event) => {
      item.done = event.target.checked;
      saveState();
    });
    row.querySelector('[type="text"]').addEventListener("input", (event) => {
      item.text = event.target.value;
      saveState();
    });
    row.querySelector("select").addEventListener("change", (event) => {
      item.group = event.target.value;
      saveState();
      renderChecklists();
    });
    row.querySelector("button").addEventListener("click", () => {
      state.checklist = state.checklist.filter((entry) => entry.id !== item.id);
      saveState();
      renderChecklists();
    });
    group.append(row);
  });
}

function renderNotes() {
  const notes = document.querySelector("#notesField");
  if (document.activeElement !== notes) notes.value = state.notes;
}

function render() {
  renderTripForm();
  renderMetrics();
  renderDashboardRoute();
  renderCalendar();
  renderRoute();
  renderLocations();
  renderStops();
  renderFuel();
  renderBudget();
  renderChecklists();
  renderNotes();
  renderBackupStatus();
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#addRouteDay").addEventListener("click", () => {
  state.routeDays.push({
    id: crypto.randomUUID(),
    title: "New route day",
    date: "",
    start: "",
    end: "",
    overnight: "",
    lodging: "",
    miles: 0,
    hours: 0,
    notes: "",
  });
  saveState();
  render();
});

document.querySelector("#addStop").addEventListener("click", () => {
  const activeCategory = document.querySelector("#stopCategoryFilter").value;
  state.stops.push({
    id: crypto.randomUUID(),
    name: "New stop",
    category: activeCategory === "all" ? "other" : activeCategory,
    area: "",
    day: 1,
    priority: "good option",
    status: "considering",
    estimatedCost: 0,
    link: "",
    notes: "",
  });
  saveState();
  render();
});

document.querySelector("#addLocation").addEventListener("click", () => {
  state.locations.push({
    id: crypto.randomUUID(),
    name: "New location",
    type: "other",
    region: "",
    day: 1,
    arrive: "",
    depart: "",
    reason: "",
    notes: "",
  });
  saveState();
  render();
});

document.querySelector("#addBike").addEventListener("click", () => {
  state.bikes.push({ id: crypto.randomUUID(), rider: "", bike: "", tankGallons: 0, mpg: 0 });
  saveState();
  render();
});

document.querySelector("#addFuelLog").addEventListener("click", () => {
  state.fuelLogs.push({ id: crypto.randomUUID(), date: "", rider: "", location: "", gallons: 0, pricePerGallon: 0, odometer: 0 });
  saveState();
  render();
});

document.querySelector("#addExpense").addEventListener("click", () => {
  state.expenses.push({ id: crypto.randomUUID(), description: "New expense", category: "misc", estimated: 0, actual: 0, paidBy: "", split: "group", notes: "" });
  saveState();
  render();
});

document.querySelector("#addChecklistItem").addEventListener("click", () => {
  state.checklist.push({ id: crypto.randomUUID(), group: "Packing", text: "New checklist item", done: false });
  saveState();
  renderChecklists();
});

document.querySelector("#stopCategoryFilter").addEventListener("change", renderStops);
document.querySelector("#stopSearch").addEventListener("input", renderStops);
document.querySelector("#fuelCorridorFilter").addEventListener("change", renderFuelStations);
document.querySelector("#fuelStationSearch").addEventListener("input", renderFuelStations);

document.querySelector("#notesField").addEventListener("input", (event) => {
  state.notes = event.target.value;
  saveState();
});

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `rideplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  updateBackupMeta({ lastDownloadedBackup: new Date().toISOString() });
}

document.querySelector("#exportData").addEventListener("click", exportBackup);
document.querySelector("#backupNow").addEventListener("click", async () => {
  const button = document.querySelector("#backupNow");
  button.disabled = true;
  button.textContent = "Backing up...";
  if (remoteReady) await saveRemoteState();
  exportBackup();
  button.textContent = "Backup downloaded";
  setTimeout(() => {
    button.disabled = false;
    button.textContent = "Back up now";
  }, 1600);
});

document.querySelector("#importData").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  state = { ...structuredClone(sampleData), ...JSON.parse(await file.text()) };
  saveState();
  render();
});

document.querySelector("#resetSample").addEventListener("click", () => {
  if (!confirm("Reset this browser's planner data to the sample trip?")) return;
  state = structuredClone(sampleData);
  saveState();
  render();
});

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsyncedChanges || !remoteReady) return;
  event.preventDefault();
  event.returnValue = "";
});

render();
initSupabase();
