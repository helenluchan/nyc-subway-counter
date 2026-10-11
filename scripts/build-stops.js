// Builds data/stops.json from an MTA GTFS stops.txt file.
//
// Usage:
//   node scripts/build-stops.js path/to/stops.txt
//
// Get stops.txt from the MTA's subway GTFS feed (unzip google_transit.zip).
// Only parent stations (location_type = 1) are kept, so each station shows once.
// Existing "ideas" and "lines" in data/stops.json are kept when the id matches,
// so your hand-written notes survive a rebuild.

const fs = require("fs");
const path = require("path");

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-stops.js path/to/stops.txt");
  process.exit(1);
}

const outPath = path.join(__dirname, "..", "data", "stops.json");

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = (cells[i] || "").trim()));
    return row;
  });
}

const rows = parseCsv(fs.readFileSync(input, "utf8"));

let existing = { stops: [] };
if (fs.existsSync(outPath)) {
  existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
}
const previous = new Map(existing.stops.map((s) => [s.id, s]));

const stops = rows
  .filter((r) => r.location_type === "1")
  .map((r) => {
    const prev = previous.get(r.stop_id) || {};
    return {
      id: r.stop_id,
      name: r.stop_name,
      lines: prev.lines || [],
      lat: Number(r.stop_lat),
      lng: Number(r.stop_lon),
      ideas: prev.ideas || [],
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(outPath, JSON.stringify({ stops }, null, 2) + "\n");
console.log(`Wrote ${stops.length} stations to ${outPath}`);
