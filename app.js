const STORAGE_KEY = "subwayStopTracker.visits.v2";

let stops = [];
let visits = loadVisits(); // { [stopId]: ["2024-01-01", "2024-01-15", ...] }
let activeStopId = null;

const el = {
  list: document.getElementById("stopList"),
  search: document.getElementById("search"),
  unvisitedOnly: document.getElementById("unvisitedOnly"),
  summary: document.getElementById("summary"),
  dialog: document.getElementById("detail"),
  detailName: document.getElementById("detailName"),
  detailLines: document.getElementById("detailLines"),
  detailIdeas: document.getElementById("detailIdeas"),
  detailVisitCount: document.getElementById("detailVisitCount"),
  imHere: document.getElementById("imHere"),
  closeDialog: document.getElementById("closeDialog"),
  historySection: document.getElementById("historySection"),
  visitHistory: document.getElementById("visitHistory"),
  removeLastVisit: document.getElementById("removeLastVisit"),
};

// ---- storage ----

function loadVisits() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveVisits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
}

// ---- rendering ----

function matches(stop, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    stop.name.toLowerCase().includes(q) ||
    stop.lines.some((line) => line.toLowerCase() === q)
  );
}

function visitCount(id) {
  return (visits[id] || []).length;
}

function render() {
  const query = el.search.value.trim();
  const unvisitedOnly = el.unvisitedOnly.checked;

  const visible = stops.filter((stop) => {
    if (unvisitedOnly && visitCount(stop.id) > 0) return false;
    return matches(stop, query);
  });

  el.list.innerHTML = "";
  for (const stop of visible) {
    const count = visitCount(stop.id);
    const li = document.createElement("li");
    li.className = count > 0 ? "stop visited" : "stop";
    li.innerHTML = `
      <button type="button" class="stop-button">
        <span class="stop-name"></span>
        <span class="stop-lines"></span>
        <span class="stop-status"></span>
      </button>`;
    li.querySelector(".stop-name").textContent = stop.name;
    li.querySelector(".stop-lines").textContent = stop.lines.join(" · ");
    li.querySelector(".stop-status").textContent =
      count === 0 ? "Not visited" :
      count === 1 ? "Visited 1 time" :
      `Visited ${count} times`;
    li.querySelector("button").addEventListener("click", () => openStop(stop.id));
    el.list.appendChild(li);
  }

  const visitedCount = stops.filter((s) => visitCount(s.id) > 0).length;
  el.summary.textContent = `${visitedCount} of ${stops.length} stops visited`;
}

// ---- detail dialog ----

function openStop(id) {
  const stop = stops.find((s) => s.id === id);
  if (!stop) return;
  activeStopId = id;
  refreshDetail(stop);
  el.dialog.showModal();
}

function refreshDetail(stop) {
  const stopDates = visits[stop.id] || [];
  const count = stopDates.length;

  el.detailName.textContent = stop.name;
  el.detailLines.textContent = `Lines: ${stop.lines.join(", ")}`;

  el.detailVisitCount.textContent =
    count === 0 ? "You haven't been here yet." :
    count === 1 ? "You've been here 1 time." :
    `You've been here ${count} times.`;

  el.detailIdeas.innerHTML = "";
  for (const idea of (stop.ideas || []).slice(0, 5)) {
    const li = document.createElement("li");
    li.textContent = idea;
    el.detailIdeas.appendChild(li);
  }

  if (count > 0) {
    el.historySection.hidden = false;
    el.visitHistory.innerHTML = "";
    for (const date of [...stopDates].reverse()) {
      const li = document.createElement("li");
      li.textContent = date;
      el.visitHistory.appendChild(li);
    }
  } else {
    el.historySection.hidden = true;
  }
}

el.imHere.addEventListener("click", () => {
  if (!activeStopId) return;
  if (!visits[activeStopId]) visits[activeStopId] = [];
  visits[activeStopId].push(today());
  saveVisits();
  const stop = stops.find((s) => s.id === activeStopId);
  refreshDetail(stop);
  render();
});

el.removeLastVisit.addEventListener("click", () => {
  if (!activeStopId || !visits[activeStopId]) return;
  visits[activeStopId].pop();
  if (visits[activeStopId].length === 0) delete visits[activeStopId];
  saveVisits();
  const stop = stops.find((s) => s.id === activeStopId);
  refreshDetail(stop);
  render();
});

el.closeDialog.addEventListener("click", () => el.dialog.close());

el.search.addEventListener("input", render);
el.unvisitedOnly.addEventListener("change", render);

function today() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ---- boot ----

fetch("data/stops.json")
  .then((res) => res.json())
  .then((data) => {
    stops = data.stops;
    render();
  })
  .catch(() => {
    el.summary.textContent = "Could not load stops. Serve this folder over HTTP.";
  });
