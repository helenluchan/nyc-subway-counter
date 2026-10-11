const STORAGE_KEY = "subwayStopTracker.visits.v2";

const LINE_META = {
  '1': { bg: '#EE352E', t: '#fff' }, '2': { bg: '#EE352E', t: '#fff' }, '3': { bg: '#EE352E', t: '#fff' },
  '4': { bg: '#00933C', t: '#fff' }, '5': { bg: '#00933C', t: '#fff' }, '6': { bg: '#00933C', t: '#fff' },
  '7': { bg: '#B933AD', t: '#fff' },
  'A': { bg: '#0039A6', t: '#fff' }, 'C': { bg: '#0039A6', t: '#fff' }, 'E': { bg: '#0039A6', t: '#fff' },
  'B': { bg: '#FF6319', t: '#fff' }, 'D': { bg: '#FF6319', t: '#fff' },
  'F': { bg: '#FF6319', t: '#fff' }, 'M': { bg: '#FF6319', t: '#fff' },
  'G': { bg: '#6CBE45', t: '#fff' },
  'J': { bg: '#996633', t: '#fff' }, 'Z': { bg: '#996633', t: '#fff' },
  'L': { bg: '#A7A9AC', t: '#fff' },
  'N': { bg: '#FCCC0A', t: '#000' }, 'Q': { bg: '#FCCC0A', t: '#000' },
  'R': { bg: '#FCCC0A', t: '#000' }, 'W': { bg: '#FCCC0A', t: '#000' },
  'S': { bg: '#808183', t: '#fff' },
};

const LINE_ORDER = ['1','2','3','4','5','6','7','A','B','C','D','E','F','G','J','L','M','N','Q','R','S','W','Z'];

let stops = [], visits = loadVisits(), activeStopId = null, activeFilter = null;
let map = null, markers = {};

const el = {
  summary:       document.getElementById('summary'),
  lineFilters:   document.getElementById('lineFilters'),
  mapView:       document.getElementById('mapView'),
  listView:      document.getElementById('listView'),
  mapViewBtn:    document.getElementById('mapViewBtn'),
  listViewBtn:   document.getElementById('listViewBtn'),
  stopList:      document.getElementById('stopList'),
  search:        document.getElementById('search'),
  unvisitedOnly: document.getElementById('unvisitedOnly'),
  dialog:        document.getElementById('detail'),
  detailBullets: document.getElementById('detailBullets'),
  detailName:    document.getElementById('detailName'),
  detailIdeas:   document.getElementById('detailIdeas'),
  visitCount:    document.getElementById('detailVisitCount'),
  imHere:        document.getElementById('imHere'),
  closeDialog:   document.getElementById('closeDialog'),
  historySection:document.getElementById('historySection'),
  visitHistory:  document.getElementById('visitHistory'),
  removeLastVisit:document.getElementById('removeLastVisit'),
};

function loadVisits() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveVisits() { localStorage.setItem(STORAGE_KEY, JSON.stringify(visits)); }

function count(id) { return (visits[id] || []).length; }
function today() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function meta(line) { return LINE_META[line] || { bg: '#808183', t: '#fff' }; }

function bullet(line, cls = 'b-sm') {
  const m = meta(line);
  return `<span class="bullet ${cls}" style="background:${m.bg};color:${m.t}">${line}</span>`;
}

// ── Line filters ──

function buildFilters() {
  const present = new Set(stops.flatMap(s => s.lines));
  const lines = LINE_ORDER.filter(l => present.has(l));
  el.lineFilters.innerHTML = '';

  const all = document.createElement('button');
  all.className = 'filter-all' + (activeFilter === null ? ' active' : '');
  all.textContent = 'All';
  all.onclick = () => setFilter(null);
  el.lineFilters.appendChild(all);

  for (const line of lines) {
    const m = meta(line);
    const btn = document.createElement('button');
    btn.className = 'bullet-filter' + (activeFilter === line ? ' active' : '');
    btn.style.setProperty('--c', m.bg);
    btn.style.setProperty('--t', m.t);
    btn.textContent = line;
    btn.onclick = () => setFilter(line);
    el.lineFilters.appendChild(btn);
  }
}

function setFilter(line) {
  activeFilter = line;
  buildFilters();
  renderList();
  refreshMarkers();
}

// ── Map ──

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([40.72, -73.99], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}

function pinIcon(stop) {
  const m = meta(stop.lines[0]);
  const n = count(stop.id);
  const html = `
    <div class="map-pin ${n > 0 ? 'map-pin-visited' : ''}" style="background:${m.bg};color:${m.t}">
      ${stop.lines[0]}
      ${n > 0 ? `<span class="pin-badge">${n}</span>` : ''}
    </div>`;
  return L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14] });
}

function addMarkers() {
  for (const stop of stops) {
    markers[stop.id] = L.marker([stop.lat, stop.lng], { icon: pinIcon(stop) })
      .on('click', () => openStop(stop.id))
      .addTo(map);
  }
}

function refreshMarkers() {
  for (const stop of stops) {
    const m = markers[stop.id];
    if (!m) continue;
    const visible = !activeFilter || stop.lines.includes(activeFilter);
    m.setIcon(pinIcon(stop));
    m.setOpacity(visible ? 1 : 0.18);
  }
}

// ── List ──

function filtered() {
  const q = (el.search.value || '').trim().toLowerCase();
  return stops.filter(s => {
    if (activeFilter && !s.lines.includes(activeFilter)) return false;
    if (el.unvisitedOnly.checked && count(s.id) > 0) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.lines.some(l => l.toLowerCase() === q)) return false;
    return true;
  });
}

function renderList() {
  el.stopList.innerHTML = '';
  for (const stop of filtered()) {
    const n = count(stop.id);
    const li = document.createElement('li');
    li.className = n > 0 ? 'stop visited' : 'stop';
    li.innerHTML = `
      <button class="stop-btn">
        <div class="stop-bullets">${stop.lines.map(l => bullet(l)).join('')}</div>
        <div class="stop-info">
          <span class="stop-name"></span>
          <span class="stop-meta"></span>
        </div>
      </button>`;
    li.querySelector('.stop-name').textContent = stop.name;
    li.querySelector('.stop-meta').textContent =
      n === 0 ? 'Not visited' : n === 1 ? '1 visit' : `${n} visits`;
    li.querySelector('button').onclick = () => openStop(stop.id);
    el.stopList.appendChild(li);
  }

  const total = stops.filter(s => count(s.id) > 0).length;
  el.summary.textContent = `${total} / ${stops.length}`;
}

// ── Detail ──

function openStop(id) {
  const stop = stops.find(s => s.id === id);
  if (!stop) return;
  activeStopId = id;
  renderDetail(stop);
  el.dialog.showModal();
}

function renderDetail(stop) {
  const dates = visits[stop.id] || [];
  const n = dates.length;

  el.detailBullets.innerHTML = stop.lines.map(l => bullet(l, 'b-md')).join('');
  el.detailName.textContent = stop.name;
  el.visitCount.textContent =
    n === 0 ? 'Never visited' : n === 1 ? '1 visit' : `${n} visits`;

  el.detailIdeas.innerHTML = '';
  for (const idea of (stop.ideas || []).slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = idea;
    el.detailIdeas.appendChild(li);
  }

  if (n > 0) {
    el.historySection.hidden = false;
    el.visitHistory.innerHTML = '';
    for (const d of [...dates].reverse()) {
      const li = document.createElement('li');
      li.textContent = d;
      el.visitHistory.appendChild(li);
    }
  } else {
    el.historySection.hidden = true;
  }
}

el.imHere.onclick = () => {
  if (!activeStopId) return;
  if (!visits[activeStopId]) visits[activeStopId] = [];
  visits[activeStopId].push(today());
  saveVisits();
  renderDetail(stops.find(s => s.id === activeStopId));
  renderList();
  refreshMarkers();
};

el.removeLastVisit.onclick = () => {
  if (!activeStopId || !visits[activeStopId]) return;
  visits[activeStopId].pop();
  if (!visits[activeStopId].length) delete visits[activeStopId];
  saveVisits();
  renderDetail(stops.find(s => s.id === activeStopId));
  renderList();
  refreshMarkers();
};

el.closeDialog.onclick = () => el.dialog.close();

// ── View toggle ──

el.mapViewBtn.onclick = () => {
  el.mapView.hidden = false;
  el.listView.hidden = true;
  el.mapViewBtn.classList.add('active');
  el.listViewBtn.classList.remove('active');
  map.invalidateSize();
};

el.listViewBtn.onclick = () => {
  el.mapView.hidden = true;
  el.listView.hidden = false;
  el.listViewBtn.classList.add('active');
  el.mapViewBtn.classList.remove('active');
};

el.search.oninput = renderList;
el.unvisitedOnly.onchange = renderList;

// ── Boot ──

fetch('data/stops.json')
  .then(r => r.json())
  .then(data => {
    stops = data.stops;
    initMap();
    addMarkers();
    buildFilters();
    renderList();
  })
  .catch(() => {
    el.summary.textContent = 'Run via HTTP to load stops';
  });
