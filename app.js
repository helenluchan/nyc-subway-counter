const STORAGE_KEY = "subwayStopTracker.visits.v2";

// MTA official line colors
const LINE_META = {
  '1': { bg: '#EE352E', text: '#fff' },
  '2': { bg: '#EE352E', text: '#fff' },
  '3': { bg: '#EE352E', text: '#fff' },
  '4': { bg: '#00933C', text: '#fff' },
  '5': { bg: '#00933C', text: '#fff' },
  '6': { bg: '#00933C', text: '#fff' },
  '7': { bg: '#B933AD', text: '#fff' },
  'A': { bg: '#0039A6', text: '#fff' },
  'C': { bg: '#0039A6', text: '#fff' },
  'E': { bg: '#0039A6', text: '#fff' },
  'B': { bg: '#FF6319', text: '#fff' },
  'D': { bg: '#FF6319', text: '#fff' },
  'F': { bg: '#FF6319', text: '#fff' },
  'M': { bg: '#FF6319', text: '#fff' },
  'G': { bg: '#6CBE45', text: '#fff' },
  'J': { bg: '#996633', text: '#fff' },
  'Z': { bg: '#996633', text: '#fff' },
  'L': { bg: '#A7A9AC', text: '#fff' },
  'N': { bg: '#FCCC0A', text: '#000' },
  'Q': { bg: '#FCCC0A', text: '#000' },
  'R': { bg: '#FCCC0A', text: '#000' },
  'W': { bg: '#FCCC0A', text: '#000' },
  'S': { bg: '#808183', text: '#fff' },
};

const LINE_ORDER = ['1','2','3','4','5','6','7','A','B','C','D','E','F','G','J','L','M','N','Q','R','S','W','Z'];

let stops = [];
let visits = loadVisits();
let activeStopId = null;
let activeLineFilter = null;
let map = null;
let markers = {};

const el = {
  summary: document.getElementById("summary"),
  lineFilters: document.getElementById("lineFilters"),
  mapView: document.getElementById("mapView"),
  listView: document.getElementById("listView"),
  mapViewBtn: document.getElementById("mapViewBtn"),
  listViewBtn: document.getElementById("listViewBtn"),
  stopList: document.getElementById("stopList"),
  search: document.getElementById("search"),
  unvisitedOnly: document.getElementById("unvisitedOnly"),
  dialog: document.getElementById("detail"),
  detailName: document.getElementById("detailName"),
  detailBullets: document.getElementById("detailBullets"),
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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveVisits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
}

// ---- helpers ----

function visitCount(id) {
  return (visits[id] || []).length;
}

function today() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function lineMeta(line) {
  return LINE_META[line] || { bg: '#808183', text: '#fff' };
}

function bulletHTML(line, size = 'sm') {
  const m = lineMeta(line);
  return `<span class="bullet bullet-${size}" style="background:${m.bg};color:${m.text}">${line}</span>`;
}

// ---- line filter bar ----

function buildLineFilters() {
  const present = new Set(stops.flatMap(s => s.lines));
  const sorted = LINE_ORDER.filter(l => present.has(l));

  el.lineFilters.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'line-filter-btn' + (activeLineFilter === null ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => setLineFilter(null));
  el.lineFilters.appendChild(allBtn);

  for (const line of sorted) {
    const m = lineMeta(line);
    const btn = document.createElement('button');
    btn.className = 'line-filter-btn bullet-filter' + (activeLineFilter === line ? ' active' : '');
    btn.style.setProperty('--line-bg', m.bg);
    btn.style.setProperty('--line-text', m.text);
    btn.textContent = line;
    btn.addEventListener('click', () => setLineFilter(line));
    el.lineFilters.appendChild(btn);
  }
}

function setLineFilter(line) {
  activeLineFilter = line;
  buildLineFilters();
  renderList();
  updateMapMarkers();
}

// ---- map ----

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([40.72, -73.99], 12);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);
}

function markerIcon(stop) {
  const primaryLine = stop.lines[0];
  const m = lineMeta(primaryLine);
  const count = visitCount(stop.id);
  const visited = count > 0;

  const html = `
    <div class="map-marker ${visited ? 'map-marker-visited' : ''}"
         style="background:${m.bg};color:${m.text};${visited ? `box-shadow:0 0 0 3px #fff,0 0 0 5px ${m.bg}` : ''}">
      ${primaryLine}
      ${visited ? `<span class="marker-count">${count}</span>` : ''}
    </div>`;

  return L.divIcon({ className: '', html, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18] });
}

function addMarkers() {
  for (const stop of stops) {
    const marker = L.marker([stop.lat, stop.lng], { icon: markerIcon(stop) })
      .on('click', () => openStop(stop.id))
      .addTo(map);
    markers[stop.id] = marker;
  }
}

function updateMapMarkers() {
  for (const stop of stops) {
    const marker = markers[stop.id];
    if (!marker) continue;

    const inFilter = !activeLineFilter || stop.lines.includes(activeLineFilter);
    if (inFilter) {
      marker.setIcon(markerIcon(stop));
      marker.setOpacity(1);
    } else {
      marker.setOpacity(0.15);
    }
  }
}

// ---- list view ----

function visibleStops() {
  const query = (el.search?.value || '').trim().toLowerCase();
  const unvisitedOnly = el.unvisitedOnly?.checked;
  return stops.filter(stop => {
    if (activeLineFilter && !stop.lines.includes(activeLineFilter)) return false;
    if (unvisitedOnly && visitCount(stop.id) > 0) return false;
    if (query && !stop.name.toLowerCase().includes(query) && !stop.lines.some(l => l.toLowerCase() === query)) return false;
    return true;
  });
}

function renderList() {
  el.stopList.innerHTML = '';
  for (const stop of visibleStops()) {
    const count = visitCount(stop.id);
    const li = document.createElement('li');
    li.className = count > 0 ? 'stop visited' : 'stop';
    li.innerHTML = `
      <button type="button" class="stop-button">
        <div class="stop-row">
          <div class="stop-bullets">${stop.lines.map(l => bulletHTML(l)).join('')}</div>
          <div class="stop-info">
            <span class="stop-name"></span>
            <span class="stop-status"></span>
          </div>
        </div>
      </button>`;
    li.querySelector('.stop-name').textContent = stop.name;
    li.querySelector('.stop-status').textContent =
      count === 0 ? 'Not visited' :
      count === 1 ? 'Visited 1 time' :
      `Visited ${count} times`;
    li.querySelector('button').addEventListener('click', () => openStop(stop.id));
    el.stopList.appendChild(li);
  }

  const visitedCount = stops.filter(s => visitCount(s.id) > 0).length;
  el.summary.textContent = `${visitedCount} / ${stops.length} stops visited`;
}

// ---- detail dialog ----

function openStop(id) {
  const stop = stops.find(s => s.id === id);
  if (!stop) return;
  activeStopId = id;
  refreshDetail(stop);
  el.dialog.showModal();
}

function refreshDetail(stop) {
  const dates = visits[stop.id] || [];
  const count = dates.length;

  el.detailBullets.innerHTML = stop.lines.map(l => bulletHTML(l, 'md')).join('');
  el.detailName.textContent = stop.name;

  el.detailVisitCount.textContent =
    count === 0 ? "You haven't been here yet." :
    count === 1 ? "You've been here 1 time." :
    `You've been here ${count} times.`;

  el.detailIdeas.innerHTML = '';
  for (const idea of (stop.ideas || []).slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = idea;
    el.detailIdeas.appendChild(li);
  }

  if (count > 0) {
    el.historySection.hidden = false;
    el.visitHistory.innerHTML = '';
    for (const date of [...dates].reverse()) {
      const li = document.createElement('li');
      li.textContent = date;
      el.visitHistory.appendChild(li);
    }
  } else {
    el.historySection.hidden = true;
  }
}

el.imHere.addEventListener('click', () => {
  if (!activeStopId) return;
  if (!visits[activeStopId]) visits[activeStopId] = [];
  visits[activeStopId].push(today());
  saveVisits();
  const stop = stops.find(s => s.id === activeStopId);
  refreshDetail(stop);
  renderList();
  updateMapMarkers();
});

el.removeLastVisit.addEventListener('click', () => {
  if (!activeStopId || !visits[activeStopId]) return;
  visits[activeStopId].pop();
  if (visits[activeStopId].length === 0) delete visits[activeStopId];
  saveVisits();
  const stop = stops.find(s => s.id === activeStopId);
  refreshDetail(stop);
  renderList();
  updateMapMarkers();
});

el.closeDialog.addEventListener('click', () => el.dialog.close());

// ---- view toggle ----

el.mapViewBtn.addEventListener('click', () => {
  el.mapView.hidden = false;
  el.listView.hidden = true;
  el.mapViewBtn.classList.add('active');
  el.listViewBtn.classList.remove('active');
  map.invalidateSize();
});

el.listViewBtn.addEventListener('click', () => {
  el.mapView.hidden = true;
  el.listView.hidden = false;
  el.listViewBtn.classList.add('active');
  el.mapViewBtn.classList.remove('active');
});

el.search.addEventListener('input', renderList);
el.unvisitedOnly.addEventListener('change', renderList);

// ---- boot ----

fetch('data/stops.json')
  .then(res => res.json())
  .then(data => {
    stops = data.stops;
    initMap();
    addMarkers();
    buildLineFilters();
    renderList();

    const visitedCount = stops.filter(s => visitCount(s.id) > 0).length;
    el.summary.textContent = `${visitedCount} / ${stops.length} stops visited`;
  })
  .catch(() => {
    el.summary.textContent = 'Could not load stops. Serve this folder over HTTP.';
  });
