# Subway Stop Tracker

A prototype for logging the NYC subway stops you've gotten off at, with notes and ideas for each one.

## Run it

The page loads its data with `fetch`, so serve the folder over HTTP rather than opening the file directly:

```
cd subway-stop-tracker
python3 -m http.server 8000
```

Then open http://localhost:8000.

Visits are saved in your browser's localStorage. They stay on that browser and aren't synced anywhere yet.

## Current state

- `data/stops.json` is a **sample** of 10 stations with approximate coordinates and a few ideas each.
- Visit logging works: date, note, and remove.
- Search by name or line, and an "unvisited only" filter.

## Load the full station list

1. Download the MTA subway GTFS feed and unzip it, so you have `stops.txt`.
2. Run:
   ```
   node scripts/build-stops.js path/to/stops.txt
   ```

The script keeps only parent stations and preserves any `ideas` and `lines` you've already written for matching ids. Lines aren't in `stops.txt`; they come from `routes.txt` and `trips.txt`, which the script doesn't read yet.

## Next steps

- Fill in lines per station from the GTFS route data.
- Decide where "things to do" come from: hand-written, a places API, or both.
- Decide on sync: keep it local, or add a small backend so visits survive across devices.
