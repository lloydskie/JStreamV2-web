# Copilot / AI Agent Instructions for JStreamV2-web

Purpose: Help an AI coding agent be productive quickly in this repo (static, client-side streaming UI).

## Big Picture Architecture
- **Type:** Static, client-side site (HTML/CSS/vanilla JS). No backend or build step. Open `index.html` or run a local server.
- **Pages:** `index.html` (homepage), `movie.html`, `tv.html`, `movie-player.html`, `tv-player.html`, `search.html` — each page wires plain JS modules from `assets/js/` or top-level `js/`.
- **Data Sources:** Two modes exist — remote TMDB API (wrapped in `assets/js/api.js`) for production and local `data/movies.json` for offline/demo flows.
- **Dual Implementations:** Parallel codebases for many features (modern TMDB-backed in `assets/js/`, legacy/demo in `js/`). Prefer editing `assets/js/` unless intentionally updating legacy demo.
- **No Frameworks:** Pure vanilla JS, no bundlers, no package managers beyond optional Node for serving.

## Key Files & Responsibilities
- `assets/js/api.js`: TMDB API wrapper with 5-minute in-memory caching, exported helpers like `getMovieDetails`, `searchMovies`. Global: `window.tmdb`.
- `assets/js/app.js`: Modern homepage app class (`JStreamApp`) handling hero banners, carousels, rows, and `fetchPages` for paginated TMDB fetches.
- `assets/js/search.js`: Search bar with 300ms debounce, uses TMDB `searchMulti`, `searchMovies`, `searchTV`.
- `assets/js/player.js` & `assets/js/player-utils.js`: Player modal, Vidking iframe embeds, progress/continue-watching via localStorage. Globals: `window.jstreamPlayer`, `window.openPlayerModal`, `window.embedMovie`, `window.embedTv`.
- `js/app.js`: Legacy/demo UI using `data/movies.json` (useful for offline testing). Different progress keys and older patterns.
- `data/movies.json`: Local demo dataset with sample movies/TV shows including `tmdbId` for cross-referencing.

## Critical Developer Workflows
- **Local Serving:** No build required. Use `python -m http.server 8000` or `npx serve .` then open `http://localhost:8000/index.html`. File:// protocol breaks YouTube embeds due to origin policies.
- **YouTube Hero Trailers:** `assets/js/app.js` loads YouTube IFrame API dynamically with `HERO_INIT_DELAY` (2.5s) and `HERO_PLAYCHECK_DELAY` (1.4s) for muted autoplay. Sets `origin` param to avoid embed errors.
- **Player Integration:** Vidking iframe embeds via `embedMovie(tmdbId, options)` and `embedTv(tmdbId, season, episode, options)`. Progress saved every 5s to localStorage.
- **Accessibility:** Homepage preserves keyboard & focus behaviors (tabindex, aria attributes). Update focus traps and ARIA when changing DOM ids/classes.

## Project-Specific Conventions & Patterns
- **Globals for Cross-File Usage:** Modules expose helpers on `window` (e.g., `window.tmdb.getMovieDetails(id)`, `window.jstreamPlayer.openPlayer(options)`).
- **Storage Keys:**
  - Modern: `jstream:progress:<contentId>` and `jstream:continueWatching` (JSON array of progress objects).
  - Legacy: `jstream:player:progress:<contentId>` — migrate data when updating legacy code.
- **Content Deduplication:** `JStreamApp` tracks `usedContentIds` (Set) and `rowContentIds` (Map) to prevent duplicates across homepage rows.
- **Pagination Helper:** `fetchPages(fetcher, args, minItems, maxPages)` accumulates results across pages until `minItems` reached (max 5 pages).
- **Image Handling:** TMDB images via `getImageURL(path, size)` with fallback to `assets/placeholder.png`.
- **Error Handling:** TMDB fetches use try/catch with console.error; player saves use try/catch with console.warn.

## Integration Points & External Dependencies
- **TMDB API:** Free API key hardcoded in `api.js` (replace for production). Endpoints: trending, popular, search, details with credits/videos/similar.
- **Vidking Embeds:** Primary player provider for movies/TV. No API key needed.
- **YouTube IFrame API:** Dynamically loaded for hero trailer playback. Requires `origin` param for HTTPS serving.
- **Local Demo Data:** `data/movies.json` mirrors TMDB structure for offline development.

## Examples from Codebase
- **TMDB Fetch with Caching:** `const details = await window.tmdb.getMovieDetails(12345);`
- **Player Open:** `window.openPlayerModal({ tmdbId: 123, type: 'movie', title: 'Example' });`
- **Progress Load:** `const saved = JSON.parse(localStorage.getItem('jstream:progress:movie-12345'));`
- **Hero Trailer Setup:** `const YT = await this.loadYouTubeApi(); const player = new YT.Player(iframe, { ... });`

## Debugging Tips & Gotchas
- **YouTube Origin Errors:** Serve over HTTP/HTTPS, not file://. Set `origin` in player params.
- **Progress Key Mismatch:** Modern uses `jstream:progress:<id>`, legacy `jstream:player:progress:<id>` — include both when migrating.
- **Caching Bypass:** Restart server or wait 5min for TMDB cache expiry during testing.
- **Mobile/Desktop Differences:** Search hides trending section on mobile (`window.innerWidth <= 768`).
- **Focus Management:** Modal opens trap focus; close restores previous element.

If anything above is unclear or you'd like expansion (e.g., exact localStorage schemas, event flows), tell me which section to expand and I will iterate.
