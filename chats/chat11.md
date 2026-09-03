# HTML export display issue

_Started 2026-09-03 14:03 UTC_

---

## User

Khi export html thì mục này không còn hiển thị được nữa

## Assistant

## Assistant

## Assistant

## Assistant

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: run_script]_

Now the map falls back to its embedded sample data if the relative JSON fetch fails (which happens when the exported file is opened locally via `file://`, since that fetch is blocked by CORS). Let's verify.

_[tool: ready_for_verification]_

Fixed: the activity map fetched its data via a relative path (`data/activity-map.sample.json`), which fails under `file://` CORS when someone opens an exported HTML file directly — the section fell into its error state. The sample data is now embedded inline in `vietnam-activity-map.js` as a fallback, so the map renders even without that fetch succeeding.

