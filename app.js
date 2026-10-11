const STORAGE_KEY = "subwayStopTracker.visits.v1";

let stops = [];
let visits = loadVisits();
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
  visitDate: document.getElementById("visitDate"),
  visitNote: document.getElementById("visitNote"),
  saveVisit: document.getElementById("saveVisit"),
  clearVisit: document.getElementById("clearVisit"),
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

function render() {
  const query = el.search.value.trim();
  const unvisitedOnly = el.unvisitedOnly.checked;

  const visible = stops.filter((stop) => {
    if (unvisitedOnly && visits[stop.id]) return false;
    return matches(stop, query);
  });

  el.list.innerHTML = "";
  for (const stop of visible) {
    const visit = visits[stop.id];
    const li = document.createElement("li");
    li.className = visit ? "stop visited" : "stop";
    li.innerHTML = `
      <button type="button" class="stop-button">
        <span class="stop-name"></span>
        <span class="stop-lines"></span>
        <span class="stop-status"></span>
      </button>`;
    li.querySelector(".stop-name").textContent = stop.name;
    li.querySelector(".stop-lines").textContent = stop.lines.join(" ");
    li.querySelector(".stop-status").textContent = visit
      ? `Visited ${visit.date}${visit.note ? " — " + visit.note : ""}`
      : "Not visited";
    li.querySelector("button").addEventListener("click", () => openStop(stop.id));
    el.list.appendChild(li);
  }

  const visitedCount = stops.filter((s) => visits[s.id]).length;
  el.summary.textContent = `${visitedCount} of ${stops.length} stops visited`;
}

// ---- detail dialog ----

function openStop(id) {
  const stop = stops.find((s) => s.id === id);
  if (!stop) return;
  activeStopId = id;

  const visit = visits[id];
  el.detailName.textContent = stop.name;
  el.detailLines.textContent = `Lines: ${stop.lines.join(", ")}`;

  el.detailIdeas.innerHTML = "";
  for (const idea of stop.ideas || []) {
    const li = document.createElement("li");
    li.textContent = idea;
    el.detailIdeas.appendChild(li);
  }

  el.visitDate.value = visit ? visit.date : today();
  el.visitNote.value = visit ? visit.note || "" : "";
  el.clearVisit.disabled = !visit;

  el.dialog.showModal();
}

el.saveVisit.addEventListener("click", () => {
  if (!activeStopId) return;
  visits[activeStopId] = {
    date: el.visitDate.value || today(),
    note: el.visitNote.value.trim(),
  };
  saveVisits();
  el.dialog.close();
  render();
});

el.clearVisit.addEventListener("click", () => {
  if (!activeStopId) return;
  delete visits[activeStopId];
  saveVisits();
  el.dialog.close();
  render();
});

el.search.addEventListener("input", render);
el.unvisitedOnly.addEventListener("change", render);

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---- boot ----

fetch("data/stops.json")
  .then((res) => res.json())
  .then((data) => {
    stops = data.stops;
    render();
  })
  .catch((err) => {
    el.summary.textContent = "Could not load stops. Serve this folder over HTTP.";
    console.error(err);
  });
