const STORAGE_KEY = "rideplan.v1";
const config = window.RIDEPLAN_CONFIG || {};
const tripSlug = config.tripSlug || "summer-2026";

let supabaseClient = null;
let remoteReady = false;
let saveTimer = null;
let lastRemoteJson = "";

const categories = ["fuel", "lodging", "food", "attractions", "repairs", "tolls", "parking", "misc"];
const stopCategories = ["hotel", "restaurant", "fuel", "attraction", "repair", "emergency", "other"];
const priorities = ["must-see", "good option", "backup", "skip if tired"];
const statuses = ["considering", "planned", "booked", "paid", "done", "skipped"];
const checklistGroups = ["Packing", "Bike", "Documents"];

const sampleData = {
  trip: {
    name: "Summer Motorcycle Trip",
    dates: "July 2026",
    riders: "Brenden, wife, friend 1, friend 2",
    start: "Home",
    destination: "Friend's place and beyond",
    planningStatus: "Drafting route and stops",
  },
  routeDays: [
    {
      id: crypto.randomUUID(),
      title: "Meet-up ride",
      date: "2026-07-10",
      start: "Home",
      end: "Friends' town",
      miles: 210,
      hours: 4.5,
      notes: "Keep this day relaxed so we arrive with energy to plan the next legs.",
    },
    {
      id: crypto.randomUUID(),
      title: "Scenic mountain loop",
      date: "2026-07-11",
      start: "Friends' town",
      end: "Lake stopover",
      miles: 265,
      hours: 6,
      notes: "Prefer scenic roads. Avoid long gravel sections unless confirmed manageable.",
    },
  ],
  stops: [
    {
      id: crypto.randomUUID(),
      name: "Secure Parking Hotel",
      category: "hotel",
      area: "Lake stopover",
      day: 2,
      priority: "good option",
      status: "considering",
      estimatedCost: 220,
      link: "",
      notes: "Call to confirm motorcycle parking and cancellation deadline.",
    },
    {
      id: crypto.randomUUID(),
      name: "Breakfast Diner",
      category: "restaurant",
      area: "Friends' town",
      day: 2,
      priority: "backup",
      status: "planned",
      estimatedCost: 25,
      link: "",
      notes: "Good early breakfast option before leaving town.",
    },
    {
      id: crypto.randomUUID(),
      name: "Last fuel before pass",
      category: "fuel",
      area: "Highway junction",
      day: 2,
      priority: "must-see",
      status: "planned",
      estimatedCost: 0,
      link: "",
      notes: "Treat as mandatory fuel stop if the mountain route is selected.",
    },
    {
      id: crypto.randomUUID(),
      name: "Ridge viewpoint",
      category: "attraction",
      area: "Mountain pass",
      day: 2,
      priority: "must-see",
      status: "planned",
      estimatedCost: 0,
      link: "",
      notes: "Short photo stop. Budget 20 minutes.",
    },
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
  if (!saved) return structuredClone(sampleData);
  try {
    return { ...structuredClone(sampleData), ...JSON.parse(saved) };
  } catch {
    return structuredClone(sampleData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!remoteReady) {
    saveStatus.textContent = "Saved locally";
    return;
  }
  saveStatus.textContent = "Saving to Supabase...";
  scheduleRemoteSave();
}

function cleanState(data) {
  return {
    ...structuredClone(sampleData),
    ...(data || {}),
    trip: { ...structuredClone(sampleData.trip), ...(data?.trip || {}) },
    routeDays: Array.isArray(data?.routeDays) ? data.routeDays : structuredClone(sampleData.routeDays),
    stops: Array.isArray(data?.stops) ? data.stops : structuredClone(sampleData.stops),
    bikes: Array.isArray(data?.bikes) ? data.bikes : structuredClone(sampleData.bikes),
    fuelLogs: Array.isArray(data?.fuelLogs) ? data.fuelLogs : structuredClone(sampleData.fuelLogs),
    expenses: Array.isArray(data?.expenses) ? data.expenses : structuredClone(sampleData.expenses),
    checklist: Array.isArray(data?.checklist) ? data.checklist : structuredClone(sampleData.checklist),
    notes: typeof data?.notes === "string" ? data.notes : sampleData.notes,
  };
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
  saveStatus.textContent = "Synced with Supabase";
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
    state = cleanState(data.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastRemoteJson = JSON.stringify(cleanState(state));
    render();
    saveStatus.textContent = "Loaded from Supabase";
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

function bindInput(container, object, field, onChange = render) {
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
    ["name", "Trip name"],
    ["dates", "Dates"],
    ["riders", "Riders"],
    ["start", "Start"],
    ["destination", "Destination"],
    ["planningStatus", "Planning status"],
  ];
  const form = document.querySelector("#tripForm");
  form.innerHTML = fields
    .map(([field, label]) => `<label>${label}<input data-field="${field}" type="text" /></label>`)
    .join("");
  fields.forEach(([field]) => bindInput(form, state.trip, field, render));
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

function renderRoute() {
  const list = document.querySelector("#routeList");
  const template = document.querySelector("#routeTemplate");
  list.innerHTML = "";
  state.routeDays.forEach((day, index) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".route-card");
    card.querySelector(".route-day-label").textContent = `Day ${index + 1}`;
    ["title", "date", "start", "end", "miles", "hours", "notes"].forEach((field) => bindInput(card, day, field, render));
    card.querySelector(".delete-route").addEventListener("click", () => {
      state.routeDays = state.routeDays.filter((item) => item.id !== day.id);
      saveState();
      render();
    });
    list.append(node);
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
      card.querySelector('[data-field="category"]').innerHTML = optionList(stopCategories, stop.category);
      card.querySelector('[data-field="priority"]').innerHTML = optionList(priorities, stop.priority);
      card.querySelector('[data-field="status"]').innerHTML = optionList(statuses, stop.status);
      ["name", "category", "area", "day", "priority", "status", "estimatedCost", "link", "notes"].forEach((field) =>
        bindInput(card, stop, field, render),
      );
      card.querySelector(".delete-stop").addEventListener("click", () => {
        state.stops = state.stops.filter((item) => item.id !== stop.id);
        saveState();
        render();
      });
      list.append(node);
    });
}

function renderFuel() {
  renderBikes();
  renderFuelLogs();
}

function renderBikes() {
  const list = document.querySelector("#bikeList");
  const template = document.querySelector("#bikeTemplate");
  list.innerHTML = "";
  state.bikes.forEach((bike) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".mini-card");
    ["rider", "bike", "tankGallons", "mpg"].forEach((field) => bindInput(card, bike, field, render));
    const range = document.createElement("div");
    range.className = "summary-row";
    range.innerHTML = `<span>Range</span><strong>${number(Number(bike.tankGallons || 0) * Number(bike.mpg || 0))} miles</strong><span>planned</span>`;
    card.append(range);
    card.querySelector(".delete-bike").addEventListener("click", () => {
      state.bikes = state.bikes.filter((item) => item.id !== bike.id);
      saveState();
      render();
    });
    list.append(node);
  });
}

function renderFuelLogs() {
  const list = document.querySelector("#fuelLogs");
  const template = document.querySelector("#fuelTemplate");
  list.innerHTML = "";
  state.fuelLogs.forEach((log) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".mini-card");
    card.querySelector(".fuel-rider").textContent = log.rider || "Fuel";
    ["date", "rider", "location", "gallons", "pricePerGallon", "odometer"].forEach((field) => bindInput(card, log, field, render));
    const total = document.createElement("div");
    total.className = "summary-row";
    total.innerHTML = `<span>Total</span><strong>${money(Number(log.gallons || 0) * Number(log.pricePerGallon || 0))}</strong><span>${log.location || ""}</span>`;
    card.append(total);
    card.querySelector(".delete-fuel").addEventListener("click", () => {
      state.fuelLogs = state.fuelLogs.filter((item) => item.id !== log.id);
      saveState();
      render();
    });
    list.append(node);
  });
}

function renderBudget() {
  const summary = document.querySelector("#budgetSummary");
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

  const list = document.querySelector("#expenseList");
  const template = document.querySelector("#expenseTemplate");
  list.innerHTML = "";
  state.expenses.forEach((expense) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".expense-card");
    card.querySelector(".expense-category").textContent = expense.category;
    card.querySelector('[data-field="category"]').innerHTML = optionList(categories, expense.category);
    card.querySelector('[data-field="split"]').innerHTML = optionList(["group", "individual", "couples", "custom"], expense.split);
    ["description", "category", "estimated", "actual", "paidBy", "split", "notes"].forEach((field) => bindInput(card, expense, field, render));
    card.querySelector(".delete-expense").addEventListener("click", () => {
      state.expenses = state.expenses.filter((item) => item.id !== expense.id);
      saveState();
      render();
    });
    list.append(node);
  });
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
  renderRoute();
  renderStops();
  renderFuel();
  renderBudget();
  renderChecklists();
  renderNotes();
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#addRouteDay").addEventListener("click", () => {
  state.routeDays.push({ id: crypto.randomUUID(), title: "New route day", date: "", start: "", end: "", miles: 0, hours: 0, notes: "" });
  saveState();
  render();
});

document.querySelector("#addStop").addEventListener("click", () => {
  state.stops.push({
    id: crypto.randomUUID(),
    name: "New stop",
    category: "other",
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

document.querySelector("#notesField").addEventListener("input", (event) => {
  state.notes = event.target.value;
  saveState();
});

document.querySelector("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `rideplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
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

render();
initSupabase();
