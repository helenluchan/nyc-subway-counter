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
  summary:         document.getElementById('summary'),
  lineFilters:     document.getElementById('lineFilters'),
  search:          document.getElementById('search'),
  stopList:        document.getElementById('stopList'),
  dialog:          document.getElementById('detail'),
  detailBullets:   document.getElementById('detailBullets'),
  detailName:      document.getElementById('detailName'),
  detailIdeas:     document.getElementById('detailIdeas'),
  visitCount:      document.getElementById('detailVisitCount'),
  imHere:          document.getElementById('imHere'),
  closeDialog:     document.getElementById('closeDialog'),
  historySection:  document.getElementById('historySection'),
  visitHistory:    document.getElementById('visitHistory'),
  removeLastVisit: document.getElementById('removeLastVisit'),
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
  el.lineFilters.innerHTML = '';

  const all = document.createElement('button');
  all.className = 'filter-all' + (activeFilter === null ? ' active' : '');
  all.textContent = 'All';
  all.onclick = () => { activeFilter = null; buildFilters(); renderList(); };
  el.lineFilters.appendChild(all);

  for (const line of LINE_ORDER.filter(l => present.has(l))) {
    const m = meta(line);
    const btn = document.createElement('button');
    btn.className = 'bullet-filter' + (activeFilter === line ? ' active' : '');
    btn.style.setProperty('--c', m.bg);
    btn.style.setProperty('--t', m.t);
    btn.textContent = line;
    btn.onclick = () => { activeFilter = line; buildFilters(); renderList(); };
    el.lineFilters.appendChild(btn);
  }
}

// ── Stop list ──

function renderList() {
  const q = (el.search.value || '').trim().toLowerCase();
  const visible = stops.filter(s => {
    if (activeFilter && !s.lines.includes(activeFilter)) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.lines.some(l => l.toLowerCase() === q)) return false;
    return true;
  });

  el.stopList.innerHTML = '';
  for (const stop of visible) {
    const n = count(stop.id);
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="card ${n > 0 ? 'visited' : ''}">
        <div class="card-bullets">${stop.lines.map(l => bullet(l)).join('')}</div>
        <div class="card-name"></div>
        <div class="card-meta">${n > 0 ? (n === 1 ? '1 visit' : `${n} visits`) : ''}</div>
      </button>`;
    li.querySelector('.card-name').textContent = stop.name;
    li.querySelector('button').onclick = () => openStop(stop.id);
    el.stopList.appendChild(li);
  }

  const total = stops.filter(s => count(s.id) > 0).length;
  el.summary.textContent = `${total} / ${stops.length}`;
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
  el.visitCount.textContent = n === 0 ? 'Never visited' : n === 1 ? '1 visit' : `${n} visits`;

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
};

el.removeLastVisit.onclick = () => {
  if (!activeStopId || !visits[activeStopId]) return;
  visits[activeStopId].pop();
  if (!visits[activeStopId].length) delete visits[activeStopId];
  saveVisits();
  renderDetail(stops.find(s => s.id === activeStopId));
  renderList();
};

el.closeDialog.onclick = () => el.dialog.close();
el.search.oninput = renderList;

// ── Boot ──

fetch('data/stops.json')
  .then(r => r.json())
  .then(data => {
    stops = data.stops;
    buildFilters();
    renderList();
  })
  .catch(() => { el.summary.textContent = 'Run via HTTP to load stops'; });
