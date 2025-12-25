# Copilot / AI Agent Instructions for JStreamV2-web

Purpose: Help an AI coding agent be productive quickly in this repo (static, client-side streaming UI).

Big picture
- **Type:** Static, client-side site (HTML/CSS/vanilla JS). No backend or build step. See [README.md](README.md).
- **Pages:** `index.html`, `movie.html`, `tv.html`, `movie-player.html`, `tv-player.html`, `search.html` — each page wires plain JS modules in `assets/js/` or top-level `js/`.
- **Data sources:** two models exist — remote TMDB API (wrapped in `assets/js/api.js`) and a local demo file `data/movies.json`. Use TMDB wrapper for real data and `data/movies.json` for offline/demo flows.

Key files and responsibilities
- `assets/js/api.js`: TMDB integration, caching, and exported helper functions (e.g. `getMovieDetails`, `searchMovies`). Refer to [assets/js/api.js](assets/js/api.js#L1-L40).
- `assets/js/app.js`: modern homepage app and primary client logic (hero, carousels, rows). See [assets/js/app.js](assets/js/app.js#L1-L40).
- `assets/js/search.js`: search bar, debounce logic, uses `searchMovies`, `searchTV`, and `searchMulti` from the TMDB wrapper. See [assets/js/search.js](assets/js/search.js#L1-L40).
- `assets/js/player.js` and `assets/js/player-utils.js`: player integrations. `player.js` uses Vidking iframe embeds and localStorage continue-watching keys `jstream:progress:<id>` and `jstream:continueWatching`. See [assets/js/player.js](assets/js/player.js#L1-L40).
- `data/movies.json`: demo dataset the top-level `js/app.js` uses for local-only flows. See [data/movies.json](data/movies.json#L1-L20).
- `documentation/`: contains YouTube IFrame API notes used when implementing players.

```markdown
# Copilot / AI Agent Instructions for JStreamV2-web

Purpose: Help an AI coding agent be productive quickly in this repo (static, client-side streaming UI).

Quick summary
- Type: Static client-side site (HTML, CSS, vanilla JS). No bundler or backend by default — open `index.html` or run a static server.
- Two runtime paths: `assets/js/` (modern TMDB-backed code) and top-level `js/` (legacy/local `data/movies.json` demo). Prefer editing `assets/js/` unless you intentionally change the legacy demo.

Key files & examples
- `assets/js/api.js` — TMDB wrapper and caching. Use `window.tmdb` helpers (e.g. `window.tmdb.getMovieDetails(id)`, `window.tmdb.searchMovies(q)`).
- `assets/js/app.js` — modern homepage logic: hero, rows, fetch paging helpers (`fetchPages`), and keyboard/ARIA-friendly row behavior.
- `assets/js/search.js` — search debounce + TMDB search helpers.
- `assets/js/player.js` & `assets/js/player-utils.js` — player modal, Vidking embed helpers, and progress/continue-watching state. Global: `window.jstreamPlayer`, `window.openPlayerModal`.
- `js/app.js` — legacy/local UI using `data/movies.json` (useful for offline/testing). It uses different progress keys and older UI patterns.
- `data/movies.json` — local demo dataset used by legacy `/js` flow.
- `documentation/` — YouTube IFrame API notes used by hero/player code.

Important conventions & patterns (repo-specific)
- Globals: Modules often expose helpers on `window` for cross-file usage. Examples: `window.tmdb`, `window.jstreamPlayer`, `window.embedMovie`, `window.openPlayerModal`.
- Dual implementations: There are parallel implementations for many features (modern in `assets/js/`, legacy in `js/`). Make edits in one path only unless you intentionally sync both.
- Storage keys:
  - Modern player and continue-watching: `jstream:progress:<contentId>` and `jstream:continueWatching` (see `assets/js/player.js`).
  - Legacy code uses `jstream:player:progress:<contentId>` — be cautious when migrating or reading old keys.
- Player provider: Vidking iframe is the primary embed. Helper builders: `embedMovie(tmdbId, options)` and `embedTv(tmdbId, season, episode, options)` (global functions).
- YouTube embed handling: `assets/js/app.js` loads the YouTube IFrame API dynamically and uses the API to manage hero trailers (delays, mute/unmute policy, origin param). See `loadYouTubeApi()` and trailer init timing (`HERO_INIT_DELAY`, `HERO_PLAYCHECK_DELAY`).
- Accessibility: homepage preserves keyboard & focus behaviors (tabindex, aria attributes). If you change DOM ids/classes, update focus traps and ARIA in the same PR.

Developer workflows & quick commands
- No build step required. For local serving (PowerShell examples):
  - Python static server:
    ```pwsh
    python -m http.server 8000
    ```
  - Node `serve` (if Node is installed):
    ```pwsh
    npx serve .
    ```
- Open `http://localhost:8000/index.html` to test full behavior (YouTube origin and iframe policies behave better when served over HTTP/HTTPS than file://).
- Tests: no automated test harness. Some modules export via `module.exports` for small Node-based tests (you can `require()` `assets/js/api.js` in Node for unit checks).

Editing guidance for AI agents (practical & specific)
- Prefer small, focused changes. Keep global names and public HTML ids stable unless changing them project-wide.
- When adding runtime behavior, use existing globals: example — `const details = await window.tmdb.getMovieDetails(12345);`.
- For player/progress changes: read/write the existing localStorage keys. Example read:
  ```js
  const saved = JSON.parse(localStorage.getItem('jstream:progress:movie-12345'));
  ```
- If you add a new dependency or build step, update `README.md` and include a `package.json` + simple run scripts; get approval first (project intentionally has no bundler).
- If modifying UI markup used by JS (ids/classes), update all pages that include that component (pages in root: `index.html`, `movie.html`, `tv.html`, `movie-player.html`, `tv-player.html`, `search.html`) and the corresponding `assets/js/*` or `js/*` file.

Debugging tips & gotchas
- YouTube iframe origin: `assets/js/app.js` sets `origin` query param to avoid YouTube embed errors. When testing locally, serve pages rather than using `file://`.
- Progress key mismatch: modern code uses `jstream:progress:<id>` while legacy code uses `jstream:player:progress:<id>` — include both when migrating data.
- Caching: `assets/js/api.js` uses an in-memory cache (`apiCache`) with a 5-minute expiry — tests expecting fresh TMDB results may need cache bypass or server restart.

Where to look for examples
- Hero + trailer logic: `assets/js/app.js` (search for `loadYouTubeApi`, `buildHeroSlides`).
- TMDB wrapper: `assets/js/api.js` (see `fetchDataWithParams`, `getMovieDetails`).
- Player modal & progress: `assets/js/player.js` (search `jstream:progress`, `continueWatching` and `openPlayer`).
- Legacy demo behavior: `js/app.js` and `data/movies.json`.

If anything above is unclear or you'd like the file expanded with more code snippets (e.g., exact localStorage schemas, example events like `continueWatchingUpdated`), tell me which section to expand and I will iterate.
```
