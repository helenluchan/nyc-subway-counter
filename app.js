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

let stops = [], visits = loadVisits(), activeFilter = null, activeStopId = null;

const el = {
  summary:        document.getElementById('summary'),
  lineFilters:    document.getElementById('lineFilters'),
  svg:            document.getElementById('subwayMap'),
  dialog:         document.getElementById('detail'),
  detailBullets:  document.getElementById('detailBullets'),
  detailName:     document.getElementById('detailName'),
  detailIdeas:    document.getElementById('detailIdeas'),
  visitCount:     document.getElementById('detailVisitCount'),
  imHere:         document.getElementById('imHere'),
  closeDialog:    document.getElementById('closeDialog'),
  historySection: document.getElementById('historySection'),
  visitHistory:   document.getElementById('visitHistory'),
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

// ── SVG map ──

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function project(stops, W, H, pad = 40) {
  const lats = stops.map(s => s.lat), lngs = stops.map(s => s.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = (maxLat - minLat) || 0.01, lngSpan = (maxLng - minLng) || 0.01;
  const xScale = (W - pad * 2) / lngSpan, yScale = (H - pad * 2) / latSpan;
  return stops.map(s => ({
    ...s,
    x: Math.round((s.lng - minLng) * xScale + pad),
    y: Math.round((maxLat - s.lat) * yScale + pad),
  }));
}

function renderMap() {
  el.svg.innerHTML = '';
  const W = el.svg.clientWidth || 400;
  const H = el.svg.clientHeight || 600;
  el.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const pts = project(stops, W, H);
  const byId = Object.fromEntries(pts.map(s => [s.id, s]));

  // Draw lines
  for (const line of LINE_ORDER) {
    const lineStops = pts.filter(s => s.lines.includes(line)).sort((a, b) => a.y - b.y);
    if (lineStops.length < 2) continue;
    const m = meta(line);
    const dimmed = activeFilter && activeFilter !== line;
    const polyline = svgEl('polyline', {
      points: lineStops.map(s => `${s.x},${s.y}`).join(' '),
      stroke: m.bg,
      'stroke-width': '2.5',
      fill: 'none',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
      opacity: dimmed ? '0.07' : '0.85',
    });
    el.svg.appendChild(polyline);
  }

  // Draw stop circles
  for (const stop of pts) {
    const n = count(stop.id);
    const m = meta(stop.lines[0]);
    const dimmed = activeFilter && !stop.lines.includes(activeFilter);

    const g = svgEl('g', { opacity: dimmed ? '0.15' : '1', style: 'cursor:pointer' });
    g.addEventListener('click', () => openStop(stop.id));

    // Outer circle
    g.appendChild(svgEl('circle', {
      cx: stop.x, cy: stop.y, r: '7',
      fill: n > 0 ? m.bg : '#fff',
      stroke: m.bg,
      'stroke-width': '2',
    }));

    // Inner dot if visited
    if (n > 0) {
      g.appendChild(svgEl('circle', { cx: stop.x, cy: stop.y, r: '2.5', fill: '#fff' }));
    }

    // Stop name label
    const label = svgEl('text', {
      x: stop.x + 10,
      y: stop.y + 4,
      'font-size': '9',
      'font-family': '-apple-system, sans-serif',
      fill: '#888',
    });
    label.textContent = stop.name.split('-')[0].trim();
    g.appendChild(label);

    el.svg.appendChild(g);
  }
}

// ── Line filters ──

function buildFilters() {
  const present = new Set(stops.flatMap(s => s.lines));
  el.lineFilters.innerHTML = '';

  const all = document.createElement('button');
  all.className = 'filter-all' + (activeFilter === null ? ' active' : '');
  all.textContent = 'All';
  all.onclick = () => { activeFilter = null; buildFilters(); renderMap(); };
  el.lineFilters.appendChild(all);

  for (const line of LINE_ORDER.filter(l => present.has(l))) {
    const m = meta(line);
    const btn = document.createElement('button');
    btn.className = 'bullet-filter' + (activeFilter === line ? ' active' : '');
    btn.style.setProperty('--c', m.bg);
    btn.style.setProperty('--t', m.t);
    btn.textContent = line;
    btn.onclick = () => { activeFilter = line; buildFilters(); renderMap(); };
    el.lineFilters.appendChild(btn);
  }
}

// ── Detail dialog ──

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
  renderMap();
  el.summary.textContent = `${stops.filter(s => count(s.id) > 0).length} / ${stops.length}`;
};

el.removeLastVisit.onclick = () => {
  if (!activeStopId || !visits[activeStopId]) return;
  visits[activeStopId].pop();
  if (!visits[activeStopId].length) delete visits[activeStopId];
  saveVisits();
  renderDetail(stops.find(s => s.id === activeStopId));
  renderMap();
  el.summary.textContent = `${stops.filter(s => count(s.id) > 0).length} / ${stops.length}`;
};

el.closeDialog.onclick = () => el.dialog.close();

window.addEventListener('resize', renderMap);

// ── Boot ──

fetch('data/stops.json')
  .then(r => r.json())
  .then(data => {
    stops = data.stops;
    buildFilters();
    renderMap();
    el.summary.textContent = `${stops.filter(s => count(s.id) > 0).length} / ${stops.length}`;
  })
  .catch(() => { el.summary.textContent = 'Run via HTTP to load stops'; });
