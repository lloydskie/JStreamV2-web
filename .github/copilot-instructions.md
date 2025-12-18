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

Notable patterns & conventions
- Global objects: many modules attach helpers to `window` for cross-file use (e.g., `window.tmdb`, `window.jstreamPlayer`, `window.openPlayerModal`). Prefer using existing globals when adding small features.
- Dual code paths: there are two versions of some logic — modern `assets/js/*` (TMDB-driven) and older `js/*` (local `data/movies.json`). Be explicit which you modify. Prefer updating `assets/js/` for TMDB-backed behavior.
- No bundler: files are loaded directly via <script> tags. Keep changes modular and avoid introducing Node-only code unless you add a build step and explain it.
- Exports: some files include `module.exports` guards for testability. You can run small Node-based unit tests by importing those modules, but most runtime behavior expects browser globals.

State & persistence
- Continue-watching and progress use localStorage keys `jstream:progress:<contentId>` and `jstream:continueWatching`. Resume prompt shows when saved progress is >1% and <95% (see [assets/js/player.js](assets/js/player.js#L40-L80)).

Player integrations
- Primary embed provider: Vidking iframe (see `embedMovie` / `embedTv` in [assets/js/player.js](assets/js/player.js#L1-L20)).
- YouTube IFrame API docs are present under `documentation/` and used for any YouTube-based embeds.

Developer workflows
- No build: open `index.html` in a browser for quick testing. For routing or CORS use cases, run a simple static server, for example:

  - `python3 -m http.server 8000`
  - or `npx serve .` if Node is available

- Tests: repository contains no automated test harness. For isolated JS functions (those guarded by `module.exports`), you can add small Node tests and run `node`.

Guidance for AI edits
- Prefer small, focused changes. Keep public APIs (global names, HTML ids/classes) stable unless the change requires coordinated edits across files and HTML.
- When adding new behavior reference the existing global helpers instead of re-implementing (e.g., call `window.tmdb.getMovieDetails(id)` rather than re-writing fetch logic).
- If you add dependencies or a build step, document it clearly in `README.md` and include scripts (e.g., `package.json`). Avoid doing this without explicit user approval.

Examples (copyable)
- Fetch movie details (use existing wrapper):

```js
const details = await window.tmdb.getMovieDetails(12345);
```

- Read saved progress for content id `movie-12345`:

```js
const key = 'jstream:progress:movie-12345';
const saved = JSON.parse(localStorage.getItem(key));
```

Quick checks before PR
- Ensure changes work without a build step (open affected HTML files).
- If modifying UI, verify keyboard navigation and ARIA labels (project emphasizes accessibility).
- Avoid breaking the global `window.tmdb` / `window.jstreamPlayer` contracts.

If something is unclear or you want me to expand any section (examples, testing steps, or add CI scripts), tell me which parts to iterate on.
