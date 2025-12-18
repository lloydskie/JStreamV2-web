/**
 * Main Application for JStream Homepage
 * Handles homepage functionality and content loading
 */

class JStreamApp {
    constructor() {
    this.currentHeroMovie = null;
    this.heroSlides = [];
    this.heroIndex = 0;
    this.heroTimer = null;
        this.contentRows = [];
    // Track globally used content IDs to prevent duplicates across rows
    this.usedContentIds = new Set();
    // Track which IDs were rendered per row so we can safely re-render (e.g. switching tabs)
    this.rowContentIds = new Map();
        this.init();
    }

    // Load YouTube IFrame API (singleton promise)
    loadYouTubeApi() {
        if (this._ytApiPromise) return this._ytApiPromise;
        this._ytApiPromise = new Promise((resolve) => {
            if (window.YT && window.YT.Player) return resolve(window.YT);
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            window.onYouTubeIframeAPIReady = function() { resolve(window.YT); };
            document.head.appendChild(tag);
            // Fallback if API loads but callback not invoked
            setTimeout(()=>{ if(window.YT && window.YT.Player) resolve(window.YT); }, 3000);
        });
        return this._ytApiPromise;
    }

    async init() {
        this.setupEventListeners();
        // Global first-user-gesture handler: if the user interacts anywhere on the page
        // before the hero has been unmuted, treat that as an explicit gesture to enable sound.
        // In addition to clicks/keys we also watch for meaningful mouse movement (dx+dy > 10px)
        // so a user moving their mouse can enable sound. Note: some browsers do NOT treat
        // mousemove alone as an activation for autoplay policies; this is best-effort.
        try {
            let _gestureFired = false;
            const markGesture = () => {
                if (_gestureFired || window._jstreamHeroGestureFired) return;
                _gestureFired = true; window._jstreamHeroGestureFired = true;
                try { localStorage.setItem('jstream:hero-muted', JSON.stringify(false)); } catch(_){ }
                try {
                    if (this.heroYTPlayer) {
                        this.heroYTPlayer.unMute && this.heroYTPlayer.unMute();
                        this.heroYTPlayer.playVideo && this.heroYTPlayer.playVideo();
                    }
                } catch(err) { console.warn('First gesture unmute failed', err); }
                // cleanup move listeners
                try { document.removeEventListener('mousemove', onMouseMove); } catch(_){}
                try { document.removeEventListener('pointermove', onMouseMove); } catch(_){}
            };

            const onPointerDown = (e) => { markGesture(); };
            const onKeyDown = (e) => { markGesture(); };

            let lastPos = null;
            const onMouseMove = (e) => {
                try {
                    if (_gestureFired) return;
                    if (!lastPos) { lastPos = { x: e.clientX, y: e.clientY }; return; }
                    const dx = Math.abs(e.clientX - lastPos.x);
                    const dy = Math.abs(e.clientY - lastPos.y);
                    // threshold to avoid tiny accidental jitter
                    if ((dx + dy) > 10) {
                        markGesture();
                    }
                } catch(_){}
            };

            document.addEventListener('pointerdown', onPointerDown, { once: true });
            document.addEventListener('keydown', onKeyDown, { once: true });
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('pointermove', onMouseMove);
        } catch (e) { /* ignore */ }
        await this.loadHomepageContent();
        this.loadContinueWatching(); // Step 9 - Load continue watching
        this.setupSearch();
        this.setupNavigation();
        this.setupContinueWatchingListener(); // Step 9 - Listen for updates
    this.setupTrendingTabs();
    this.setupSeasonalSpotlight();
    this.setFooterYear();
    }

    setupEventListeners() {
        // Hero play button
        const heroPlayBtn = document.querySelector('.hero .play-btn');
        if (heroPlayBtn) {
            heroPlayBtn.addEventListener('click', () => this.playHeroContent());
        }

        // Hero info button
        const heroInfoBtn = document.querySelector('.hero .info-btn');
        if (heroInfoBtn) {
            heroInfoBtn.addEventListener('click', () => this.showHeroInfo());
        }

        // Search functionality
        const searchInput = document.querySelector('.search-input');
        const searchBtn = document.querySelector('.search-btn');
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(searchInput.value);
                }
            });
        }
    // Removed duplicate searchBtn click listener to avoid double toggle.
    }

    async loadHomepageContent() {
        this.showLoadingSpinner(true);
        
        try {
            // Load hero content
            await this.loadHeroContent();
            
            // Load content rows
            await this.loadContentRows();
            
        } catch (error) {
            console.error('Failed to load homepage content:', error);
            this.showError('Failed to load content. Please try again later.');
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    async loadHeroContent() {
        try {
            console.log('Starting hero content load...');
            // Use TMDB trending to choose the featured hero (top 1 from Top 10 Today)
            const trendingItems = await this.fetchPages(getTrendingAll, [], 20);
            // find first unique item that has a backdrop or poster
            const candidate = (trendingItems || []).find(it => it && (it.backdrop_path || it.poster_path));
            if (!candidate) {
                console.warn('No hero candidate found in trending');
                this.buildFallbackHero();
                return;
            }
            await this.buildHeroSlides([candidate]);
            console.log('Featured hero set to top trending item:', candidate.title || candidate.name);
        } catch (error) {
            console.error('Failed to load hero content:', error);
        }
    }

    async buildHeroSlides(items){
        // Build only a single hero (first candidate). Removes carousel behavior.
        console.log('Building single hero for:', items && items[0]);
        const container = document.getElementById('hero');
        if(!container) {
            console.error('Hero container not found');
            return;
        }
        const item = items[0];
        const isTV = item.media_type==='tv' || item.first_air_date;
        const title = item.title || item.name || 'Untitled';
        const overview = (item.overview||'').trim();
        const short = overview.split(/\s+/).slice(0,36).join(' ') + (overview.split(/\s+/).length>36? '...':'');

        // We'll update existing DOM elements (no new slide creation)

        // Determine image URL
        const imageUrl = window.tmdb.getImageURL(item.backdrop_path || item.poster_path,'w1280');

        // Insert into DOM — we will use existing elements if present
        const heroImageEl = document.getElementById('heroImage');
        if(heroImageEl) {
            heroImageEl.style.backgroundImage = `url(${imageUrl})`;
            heroImageEl.classList.remove('skeleton-bg');
            heroImageEl.setAttribute('aria-hidden','false');
            heroImageEl.setAttribute('role','img');
            heroImageEl.setAttribute('alt', `${title} backdrop`);
        }

        // Fill content fields
        const titleEl = document.querySelector('.hero-title');
        const descEl = document.querySelector('.hero-description');
        const playBtn = document.getElementById('heroPlay');
        const infoBtn = document.getElementById('heroInfo');
        const maturityEl = document.getElementById('heroMaturity');

        // Set textual title initially; will replace with TMDB logo if available after details fetch
        if (titleEl) titleEl.textContent = title;
        if(descEl) descEl.textContent = short || (item.overview || 'No description available.');

        // Fetch details to obtain trailer and certification
        try {
            let details = null;
            if (isTV) details = await window.tmdb.getTVShowDetails(item.id);
            else details = await window.tmdb.getMovieDetails(item.id);

            // Extract trailer (YouTube) via helper
            const trailerUrl = window.tmdb.getTrailerURL(details.videos || details.videos || (details.results && details.results.videos));
            // Extract US certification if available
            let cert = '';
            try {
                if(details.release_dates && Array.isArray(details.release_dates.results)){
                    const us = details.release_dates.results.find(r=> r.iso_3166_1 === 'US');
                    if(us && us.release_dates && us.release_dates[0] && us.release_dates[0].certification) cert = us.release_dates[0].certification;
                }
                if(!cert && details.content_ratings && details.content_ratings.results){
                    const us2 = details.content_ratings.results.find(r=> r.iso_3166_1 === 'US');
                    if(us2 && us2.rating) cert = us2.rating;
                }
            } catch(e){ console.warn('Failed to parse certification', e); }
            if(maturityEl) maturityEl.textContent = cert || (item.adult? '18+':'');

            // Prefer TMDB logo image for title if available (details.images.logos)
            try {
                const imgs = details.images && (details.images.logos || details.images.posters || []);
                let logoPath = null;
                if (details.images && Array.isArray(details.images.logos) && details.images.logos.length) {
                    // prefer English logos when present
                    const enLogo = details.images.logos.find(l => l.iso_639_1 === 'en');
                    const chosen = enLogo || details.images.logos[0];
                    if (chosen && chosen.file_path) logoPath = chosen.file_path;
                }
                if (!logoPath && item.poster_path) {
                    logoPath = item.poster_path;
                }

                if (logoPath && titleEl) {
                    const logoUrl = window.tmdb.getImageURL(logoPath, 'original');
                    titleEl.innerHTML = `<img src="${logoUrl}" alt="${title} title" class="hero-logo-inline">`;
                    titleEl.setAttribute('aria-label', title);
                }
            } catch (e) { console.warn('Failed to render logo title', e); }

            // Wire up play / info buttons
            if(playBtn){
                playBtn.disabled = false;
                playBtn.addEventListener('click', ()=>{
                    if(isTV) window.location.href = `tv-player.html?id=${item.id}&season=${item.season||1}&episode=${item.episode||1}`;
                    else window.location.href = `movie-player.html?id=${item.id}`;
                });
            }
            if(infoBtn){
                infoBtn.disabled = false;
                infoBtn.addEventListener('click', ()=>{
                    if(isTV) window.location.href = `tv.html?id=${item.id}`;
                    else window.location.href = `movie.html?id=${item.id}`;
                });
            }

                // Trailer handling: delay loading autoplay iframe until 8s to allow backdrop to show first
            const trailerContainer = document.getElementById('heroTrailer');
                const muteBtn = document.getElementById('heroMute');
                // Configurable timings
                const HERO_INIT_DELAY = 2500; // attempt start after 2.5s
                const HERO_PLAYCHECK_DELAY = 1400; // verify playback after 1.4s

                // Remember user preference for hero mute/unmute
                let muted = true;
                try {
                    const saved = localStorage.getItem('jstream:hero-muted');
                    if (saved !== null) muted = JSON.parse(saved);
                    else muted = false; // default: try unmuted first
                } catch (e) { muted = false; }
                try { console.debug('[HeroTrailer] initial muted:', muted); } catch(_){}

                // Helper to toggle trailer view. Only reveal trailer when playback confirmed.
                function setTrailerView(active){
                    const heroEl = document.getElementById('hero');
                    try {
                        if(active) heroEl && heroEl.classList.add('trailer-active');
                        else heroEl && heroEl.classList.remove('trailer-active');
                    } catch(e) { /* ignore */ }
                }
            function buildEmbedSrc(youtubeUrl, muteFlag){
                if(!youtubeUrl) return null;
                // extract video id
                const m = youtubeUrl.match(/[?&]v=([^&]+)/);
                const id = m ? m[1] : (youtubeUrl.split('/').pop());
                const params = new URLSearchParams({ autoplay: '1', controls: '0', rel: '0', modestbranding: '1', playsinline: '1' });
                if(muteFlag) params.set('mute','1');
                // Add origin param to satisfy YouTube API client identification (prevents Error 153)
                try {
                    if (typeof location !== 'undefined' && location.origin && /^https?:/.test(location.origin)) {
                        params.set('origin', location.origin);
                    }
                } catch (e) {
                    // ignore
                }
                return `https://www.youtube.com/embed/${id}?${params.toString()}`;
            }

            let trailerTimer = null;
            // Use YouTube IFrame Player API for reliable config and error handling
            if (trailerUrl && trailerContainer) {
                // clear existing
                trailerContainer.innerHTML = '';
                // placeholder for player + fallback play button
                const playerWrap = document.createElement('div');
                playerWrap.id = 'heroYTWrap';
                const playerDiv = document.createElement('div');
                playerDiv.id = 'heroYTPlayer';
                playerDiv.style.width = '100%';
                playerDiv.style.height = '100%';
                playerWrap.appendChild(playerDiv);
                const tryBtn = document.createElement('button');
                tryBtn.id = 'heroTryPlay';
                tryBtn.textContent = 'Tap to unmute & play';
                tryBtn.setAttribute('aria-label','Play trailer and enable sound');
                tryBtn.style.display = 'none';
                tryBtn.className = 'hero-trailer-play';
                playerWrap.appendChild(tryBtn);

                // Provide a user-gesture fallback: clicking the try button will unmute/play the trailer
                tryBtn.addEventListener('click', async () => {
                    tryBtn.style.display = 'none';
                    try {
                        if (this.heroYTPlayer) {
                            // attempt to unmute and play on user gesture
                            try { this.heroYTPlayer.unMute && this.heroYTPlayer.unMute(); } catch(_){}
                            try { this.heroYTPlayer.playVideo && this.heroYTPlayer.playVideo(); } catch(_){}
                        } else {
                            // If player not available, open trailer in new tab
                            if (trailerUrl) window.open(trailerUrl, '_blank');
                        }
                        // persist preference as unmuted (user manually requested it)
                        muted = false;
                        try { localStorage.setItem('jstream:hero-muted', JSON.stringify(muted)); } catch(_){ }
                        setTrailerView(true);
                    } catch (e) { console.warn('Try play click failed', e); }
                });
                trailerContainer.appendChild(playerWrap);

                // extract video id
                const m = trailerUrl.match(/[?&]v=([^&]+)/);
                const videoId = m ? m[1] : (trailerUrl.split('/').pop());

                // cleanup existing YT player if present, observer, and any pending timers
                if (this.heroYTPlayer && this.heroYTPlayer.destroy) {
                    try { this.heroYTPlayer.destroy(); } catch (e) {}
                    this.heroYTPlayer = null;
                }
                if (this.heroObserver && this.heroObserver.disconnect) {
                    try { this.heroObserver.disconnect(); } catch (e) {}
                    this.heroObserver = null;
                }
                if (this.heroTrailerTimer) {
                    clearTimeout(this.heroTrailerTimer);
                    this.heroTrailerTimer = null;
                }

                // Initialize player after delay to allow backdrop to show
                trailerTimer = setTimeout(async () => {
                    try {
                        const YT = await this.loadYouTubeApi();
                        this.heroYTPlayer = new YT.Player('heroYTPlayer', {
                            height: '100%',
                            width: '100%',
                            videoId: videoId,
                            playerVars: {
                                autoplay: 1,
                                controls: 0,
                                rel: 0,
                                modestbranding: 1,
                                playsinline: 1,
                                mute: muted ? 1 : 0
                            },
                            events: {
                                onReady: (ev) => {
                                    // Try to start unmuted if user preference allows
                                    try {
                                        if (!muted) {
                                            try { ev.target.unMute && ev.target.unMute(); } catch(_){}
                                        } else {
                                            try { ev.target.mute && ev.target.mute(); } catch(_){}
                                        }
                                        ev.target.playVideo && ev.target.playVideo();
                                    } catch(e){ /* ignore */ }

                                    // Wait a bit and verify playback state. Only reveal trailer when actually playing.
                                    setTimeout(()=>{
                                        try {
                                            const state = ev.target.getPlayerState && ev.target.getPlayerState();
                                            try { console.debug('[HeroTrailer] onReady: playerState=', state, 'muted=', muted); } catch(_){}
                                            if (state === YT.PlayerState.PLAYING) {
                                                setTrailerView(true);
                                                tryBtn.style.display = 'none';
                                            } else {
                                                // If we attempted unmuted and it didn't start, fallback to muted autoplay
                                                if (!muted) {
                                                    // Browser blocked unmuted autoplay — fallback to muted for this session.
                                                    muted = true;
                                                    try { ev.target.mute && ev.target.mute(); } catch(_){ }
                                                    try { ev.target.playVideo && ev.target.playVideo(); } catch(_){ }
                                                    // Do NOT persist this automatic fallback to localStorage so we can
                                                    // re-attempt unmuted autoplay on subsequent visits. Only persist
                                                    // when the user explicitly toggles mute/unmute via the UI.
                                                }
                                                // Show user gesture button so they can explicitly play/unmute
                                                tryBtn.style.display = 'inline-block';
                                                // Also listen for the first user interaction (click/tap/keydown)
                                                // and treat that as an explicit gesture to unmute and persist preference.
                                                const onFirstUserGesture = (e) => {
                                                    try {
                                                        if (this.heroYTPlayer) {
                                                            this.heroYTPlayer.unMute && this.heroYTPlayer.unMute();
                                                            this.heroYTPlayer.playVideo && this.heroYTPlayer.playVideo();
                                                        }
                                                        muted = false;
                                                        try { localStorage.setItem('jstream:hero-muted', JSON.stringify(muted)); } catch(_){ }
                                                        tryBtn.style.display = 'none';
                                                    } catch(err) { /* ignore */ }
                                                    // remove listeners
                                                    document.removeEventListener('pointerdown', onFirstUserGesture);
                                                    document.removeEventListener('keydown', onFirstUserGesture);
                                                };
                                                // Attach once
                                                document.addEventListener('pointerdown', onFirstUserGesture, { once: true });
                                                document.addEventListener('keydown', onFirstUserGesture, { once: true });
                                            }
                                        } catch(err) {
                                            tryBtn.style.display = 'inline-block';
                                        }
                                    }, HERO_PLAYCHECK_DELAY);
                                },
                                onStateChange: (ev) => {
                                    try {
                                        // When trailer finishes playing, revert to backdrop view and show a replay control
                                        if (ev.data === YT.PlayerState.ENDED) {
                                            const heroEl = document.getElementById('hero');
                                            if (heroEl) setTrailerView(false);
                                            // show replay button to let user restart the trailer
                                            tryBtn.style.display = 'inline-block';
                                            tryBtn.textContent = 'Replay Trailer';
                                            tryBtn.onclick = () => {
                                                tryBtn.style.display = 'none';
                                                try {
                                                    // ensure trailer view is shown and playback starts
                                                    if (heroEl) setTrailerView(true);
                                                    ev.target.seekTo && ev.target.seekTo(0);
                                                    ev.target.playVideo && ev.target.playVideo();
                                                } catch(e) { console.warn('Replay failed', e); }
                                            };
                                            if (this.heroTrailerTimer) { clearTimeout(this.heroTrailerTimer); this.heroTrailerTimer = null; }
                                            return;
                                        }

                                        // When trailer is playing, ensure trailer view is shown
                                        else if (ev.data === YT.PlayerState.PLAYING) {
                                            try {
                                                const heroEl = document.getElementById('hero');
                                                if (heroEl) setTrailerView(true);
                                                tryBtn.style.display = 'none';
                                            } catch(e) {}
                                        }
                                        // When trailer is paused, revert to backdrop view
                                        else if (ev.data === YT.PlayerState.PAUSED) {
                                            try {
                                                const heroEl = document.getElementById('hero');
                                                if (heroEl) setTrailerView(false);
                                            } catch(e) {}
                                        }
                                    } catch(e) { console.warn('onStateChange error', e); }
                                },
                                onError: (e) => {
                                    console.warn('YT player error', e.data);
                                    // show try button to allow user gesture fallback
                                    tryBtn.style.display = 'inline-block';
                                }
                            }
                            });

                        // Ensure mute button reflects current state and allow toggling
                        if (muteBtn) {
                            try { muteBtn.setAttribute('aria-pressed', String(muted)); } catch(_){ }
                            muteBtn.addEventListener('click', ()=>{
                                muted = !muted;
                                muteBtn.setAttribute('aria-pressed', String(muted));
                                try { localStorage.setItem('jstream:hero-muted', JSON.stringify(muted)); } catch(_){ }
                                try {
                                    if (this.heroYTPlayer) {
                                        if (muted) this.heroYTPlayer.mute && this.heroYTPlayer.mute();
                                        else this.heroYTPlayer.unMute && this.heroYTPlayer.unMute();
                                    }
                                } catch(e) { console.warn('Mute toggle failed', e); }
                            });
                        }

                        // Pause/resume trailer when hero scrolls out of view
                        try {
                            const heroEl = document.getElementById('hero');
                            if (heroEl && !this.heroObserver) {
                                // track whether the player was playing before leaving viewport
                                this._heroWasPlaying = false;
                                this.heroObserver = new IntersectionObserver((entries) => {
                                    entries.forEach(entry => {
                                        try {
                                            if (!this.heroYTPlayer || !this.heroYTPlayer.getPlayerState) return;
                                            const state = this.heroYTPlayer.getPlayerState();
                                            // If hero is not visible, pause playback and show backdrop
                                            if (!entry.isIntersecting) {
                                                this._heroWasPlaying = (state === YT.PlayerState.PLAYING);
                                                if (state === YT.PlayerState.PLAYING) {
                                                    try { this.heroYTPlayer.pauseVideo && this.heroYTPlayer.pauseVideo(); } catch(e){}
                                                }
                                                setTrailerView(false);
                                            } else {
                                                // When visible again, attempt to resume if it was playing before
                                                    if (this._heroWasPlaying) {
                                                        try { this.heroYTPlayer.playVideo && this.heroYTPlayer.playVideo(); } catch(e){}
                                                        // Only reveal trailer once playback actually starts; setTrailerView will be toggled
                                                        // by onStateChange when PLAYING is reported.
                                                    // verify resume; if still not playing, show try button
                                                    setTimeout(()=>{
                                                        try {
                                                            const s = this.heroYTPlayer.getPlayerState && this.heroYTPlayer.getPlayerState();
                                                            if (s !== YT.PlayerState.PLAYING) {
                                                                if (tryBtn) tryBtn.style.display = 'inline-block';
                                                            } else {
                                                                if (tryBtn) tryBtn.style.display = 'none';
                                                            }
                                                        } catch(e) { if (tryBtn) tryBtn.style.display = 'inline-block'; }
                                                    }, 700);
                                                }
                                                this._heroWasPlaying = false;
                                            }
                                        } catch(e) { /* ignore per-entry errors */ }
                                    });
                                }, { threshold: 0.5 });
                                try { this.heroObserver.observe(heroEl); } catch(e) { /* ignore */ }
                            }
                        } catch(e) { /* non-fatal */ }

                    } catch (err) {
                        console.warn('Failed to init YT player for hero trailer', err);
                        // fallback: show try button to allow manual open in new tab
                        const fallbackBtn = document.getElementById('heroTryPlay');
                        if (fallbackBtn) { fallbackBtn.style.display = 'inline-block'; fallbackBtn.addEventListener('click', ()=>{ window.open(trailerUrl,'_blank'); }); }
                    }
                }, HERO_INIT_DELAY);
                // keep reference so we can clear if needed
                this.heroTrailerTimer = trailerTimer;
            }

        } catch (err) {
            console.warn('Failed to fetch hero details', err);
        }

        // store single hero reference
        this.heroSlides = [{ el: container, data: item }];
        // expose current hero for play/info buttons
        try { this.currentHeroMovie = item; } catch(_){}
    }

    // Carousel removed: single-hero implementation in place. Carousel helpers intentionally omitted.

    buildFallbackHero(){
        const container = document.getElementById('hero');
        if(!container) return;
        container.innerHTML = `
            <div class="hero-backdrop"><div class="hero-image skeleton-bg"></div></div>
            <div class="hero-content"><div class="hero-info"><h1 class="hero-title">Featured Unavailable</h1><p class="hero-description">Content unavailable. Please refresh.</p></div></div>
        `;
        this.heroSlides = [];
    }

    updateHeroSection(movie) {
        const heroTitle = document.querySelector('.hero-title');
        const heroDescription = document.querySelector('.hero-description');
        const heroImage = document.querySelector('.hero-image');
        const heroSection = document.querySelector('.hero');
        
        if (heroTitle) {
            heroTitle.textContent = movie.title || movie.name;
        }
        
        if (heroDescription) {
            heroDescription.textContent = movie.overview || 'No description available.';
        }
        
        if (heroImage && movie.backdrop_path) {
            heroImage.src = window.tmdb.getImageURL(movie.backdrop_path, 'w1280');
            heroImage.alt = `${movie.title || movie.name} backdrop`;
        }
        
        // Set background image for parallax effect
        if (heroSection && movie.backdrop_path) {
            heroSection.style.backgroundImage = `url(${window.tmdb.getImageURL(movie.backdrop_path, 'w1280')})`;
        }
    }

    async loadContentRows() {
        // Load Top 10 from TMDB trending (prefer items with posters)
        try {
            const trendingItems = await this.fetchPages(getTrendingAll, [], 50); // fetch more to ensure 10 unique after dedup
            // Ensure unique items and that they have poster/backdrop images
            const byId = new Map();
            for (const it of trendingItems) {
                if (!it || !it.id) continue;
                // prefer items that have a poster or backdrop
                if (it.poster_path || it.backdrop_path) {
                    if (!byId.has(it.id)) byId.set(it.id, it);
                }
            }
            const topTrending = Array.from(byId.values()).slice(0, 10);
            this.populateRow('top-10', topTrending, null, { maxItems: 10 });
        } catch (e) { console.warn('Top 10 load failed', e); }

        // Load trending content
        try {
            const trendingData = await this.fetchPages(getTrendingAll, [], 50);
            this.populateRow('trending', trendingData, null, { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load trending:', error);
        }

        // Load popular movies
        try {
            const popularMovies = await this.fetchPages(getPopularMovies, [], 50);
            this.populateRow('popular-movies', popularMovies, 'movie', { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load popular movies:', error);
        }

        // Load popular TV shows
        try {
            const popularTV = await this.fetchPages(getPopularTV, [], 50);
            this.populateRow('popular-tv', popularTV, 'tv', { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load popular TV:', error);
        }

        // Load top rated movies
        try {
            const topRatedMovies = await this.fetchPages(getTopRatedMovies, [], 50);
            this.populateRow('top-rated-movies', topRatedMovies, 'movie', { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load top rated movies:', error);
        }

        // Load top rated TV shows
        try {
            const topRatedTV = await this.fetchPages(getTopRatedTV, [], 50);
            this.populateRow('top-rated-tv', topRatedTV, 'tv', { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load top rated TV:', error);
        }

        // Load now playing
        try {
            const nowPlaying = await this.fetchPages(getNowPlayingMovies, [], 50);
            this.populateRow('now-playing', nowPlaying, 'movie', { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load now playing:', error);
        }

        // Load upcoming
        try {
            const upcoming = await this.fetchPages(getUpcomingMovies, [], 50);
            this.populateRow('upcoming', upcoming, 'movie', { maxItems: 10 });
        } catch (error) {
            console.error('Failed to load upcoming:', error);
        }
    }

    // Helper: fetch multiple pages from a fetcher until we accumulate at least minItems
    // fetcher: async function(page) -> { results: [] , total_pages }
    async fetchPages(fetcher, args = [], minItems = 20, maxPages = 5) {
        const accumulated = [];
        let page = 1;
        try {
            while (accumulated.length < minItems && page <= maxPages) {
                const data = await fetcher(page, ...args);
                if (!data) break;
                const results = data.results || [];
                // Append new results
                accumulated.push(...results);
                // Stop if no more results or reached last page
                if (!results.length) break;
                if (data.total_pages && page >= data.total_pages) break;
                page++;
            }
        } catch (err) {
            console.warn('fetchPages error', err);
        }
        return accumulated;
    }

    populateRow(rowId, items, mediaType = null, options = {}) {
        const row = document.getElementById(rowId);
        if (!row || !items) return;
        // Remove previous IDs for this row from global set (supports re-population like tab switches)
        if (this.rowContentIds.has(rowId)) {
            const prevIds = this.rowContentIds.get(rowId);
            prevIds.forEach(id => this.usedContentIds.delete(id));
        }
        row.innerHTML = '';
        // Filter items that have valid poster/backdrop first
        const valid = items.filter(it => it && (it.poster_path || it.backdrop_path));

        // Build a unique list (skip IDs already used globally) unless explicitly ignored
        const unique = [];
        const ignoreGlobal = options && options.ignoreGlobalDuplicates;
        const uniqueIds = new Set(); // local dedup for this row
        const maxItems = options.maxItems || 20;
        for (const it of valid) {
            if (!it || !it.id) continue;
            if (uniqueIds.has(it.id)) continue; // strict local dedup
            if (!ignoreGlobal && this.usedContentIds.has(it.id)) continue; // skip duplicates across previously rendered rows
            unique.push(it);
            uniqueIds.add(it.id);
            if (unique.length >= maxItems * 2) break; // safety cap
        }

        // Decide how many to render
        const renderList = unique.slice(0, maxItems);
        const newIdsForRow = [];

        renderList.forEach(item => {
            // Determine media type if not provided
            const isTV = mediaType === 'tv' || item.media_type === 'tv' || item.first_air_date;
            const type = isTV ? 'tv' : 'movie';
            const title = item.title || item.name;
            const posterPath = item.poster_path;

            const div = document.createElement('div');
            div.classList.add('card');
            div.dataset.id = item.id;
            div.dataset.type = type;
            
            const imgSrc = posterPath ? getImageURL(posterPath) : getImageURL(item.backdrop_path);
            div.innerHTML = `
                <a href="${type}.html?id=${item.id}" class="card-link" data-type="${type}">
                    <img src="${imgSrc}" alt="${title}" loading="lazy" onerror="this.closest('.card').remove();">
                    <div class="sim-overlay"><h5>${title}</h5></div>
                </a>`;

            const cardLink = div.querySelector('.card-link');
            if(cardLink){
                cardLink.addEventListener('click',(e)=>{
                    // If a drag happened, the click was already suppressed at row level.
                    // Otherwise allow default navigation for TV, but we custom-handle movie playback.
                    if(isTV){
                        // let anchor navigate normally
                        return;
                    } else {
                        e.preventDefault();
                        this.playContent(item, 'movie');
                    }
                });
            }

            row.appendChild(div);
            // Track ID
            if (item.id) {
                this.usedContentIds.add(item.id);
                newIdsForRow.push(item.id);
            }
        });

        // Persist the set of IDs rendered for this row
        this.rowContentIds.set(rowId, newIdsForRow);

        // Attach carousel nav if not already
        this.ensureCarouselControls(rowId);
    this.makeRowInteractive(row);
    }

    ensureCarouselControls(rowId){
        const container = document.getElementById(rowId);
        if(!container) return;
        // Avoid duplicating controls
        if(container.parentElement && container.parentElement.querySelector('.carousel-prev')) return;
        const parent = container.parentElement;
        parent.style.position = 'relative';
        const prev = document.createElement('button');
        prev.className = 'carousel-prev nav-fade';
        prev.setAttribute('aria-label','Scroll left');
        prev.innerHTML = '&#10094;';
        const next = document.createElement('button');
        next.className = 'carousel-next nav-fade';
        next.setAttribute('aria-label','Scroll right');
        next.innerHTML = '&#10095;';
        Object.assign(prev.style,{position:'absolute',left:'8px',top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,0.5)',color:'#fff',border:'none',fontSize:'26px',cursor:'pointer',padding:'4px 10px',borderRadius:'4px',zIndex:50});
        Object.assign(next.style,{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',background:'rgba(0,0,0,0.5)',color:'#fff',border:'none',fontSize:'26px',cursor:'pointer',padding:'4px 10px',borderRadius:'4px',zIndex:50});
        const scrollAmt = () => Math.round(container.clientWidth * 0.9);
        prev.addEventListener('click', ()=> container.scrollBy({left:-scrollAmt(),behavior:'smooth'}));
        next.addEventListener('click', ()=> container.scrollBy({left: scrollAmt(),behavior:'smooth'}));
        parent.appendChild(prev); parent.appendChild(next);
    }

    // NEW: Make row keyboard & swipe interactive
    makeRowInteractive(row){
        if(!row || row.dataset.interactive) return;
        row.dataset.interactive = '1';
        row.setAttribute('tabindex','0');
        row.setAttribute('role','list');
        const scrollByAmt = () => Math.round(row.clientWidth * 0.9);

        // Keyboard support when focused
        row.addEventListener('keydown', (e)=>{
            if(e.key === 'ArrowRight') { row.scrollBy({left: scrollByAmt(), behavior:'smooth'}); e.preventDefault(); }
            else if(e.key === 'ArrowLeft') { row.scrollBy({left: -scrollByAmt(), behavior:'smooth'}); e.preventDefault(); }
            else if(e.key === 'Home') { row.scrollTo({left:0, behavior:'smooth'}); }
            else if(e.key === 'End') { row.scrollTo({left: row.scrollWidth, behavior:'smooth'}); }
        });

        // Pointer-based grab-to-scroll with inertia (mouse + touch + pen)
    let isActive = false;
    let startX = 0;
    let startScroll = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0; // px/ms
    let raf = null;
    let moved = false; // slop exceeded
    let dragDistance = 0; // actual horizontal scroll delta
    let currentPointerType = 'mouse';
    let activePointerId = null;
        const friction = 0.94;
        const minVelocity = 0.02;
        const frameDuration = 16;

        function cancelMomentum(){ if(raf){ cancelAnimationFrame(raf); raf=null; } }
        function momentum(){
            velocity *= friction;
            if(Math.abs(velocity) < minVelocity){ velocity = 0; raf=null; return; }
            row.scrollLeft -= velocity * frameDuration;
            raf = requestAnimationFrame(momentum);
        }
        function onPointerDown(e){
            if(e.pointerType === 'mouse' && e.button !== 0) return; // left button only for mouse
            currentPointerType = e.pointerType || 'mouse';
            isActive = true; moved = false;
            row.classList.add('grabbing');
            document.body.classList.add('no-select');
            startX = e.clientX;
            startScroll = row.scrollLeft;
            lastX = e.clientX;
            lastTime = performance.now();
            velocity = 0;
            cancelMomentum();
            activePointerId = e.pointerId;
            // Only capture immediately if pointer is not starting on a link (so simple clicks on links work reliably)
            const targetIsLink = e.target.closest('a');
            if(!targetIsLink){
                try { row.setPointerCapture && row.setPointerCapture(activePointerId); } catch(_){ }
            }
    }
        function onPointerMove(e){
            if(!isActive) return;
            const dx = e.clientX - startX; // pointer displacement
            // If vertical movement dominates, treat as non-drag to avoid hijacking scroll (esp. touch)
            if(Math.abs(e.movementY) > Math.abs(e.movementX)*1.2){ return; }
            const slop = currentPointerType === 'mouse' ? 8 : 14; // avoid accidental drags
            if(!moved){
                if(Math.abs(dx) <= slop) return; // don't scroll yet
                moved = true; // now we start scrolling
                // If we delayed capture due to link, capture now to continue receiving moves
                if(activePointerId != null){
                    try { row.setPointerCapture && row.setPointerCapture(activePointerId); } catch(_){ }
                }
            }
            row.scrollLeft = startScroll - dx;
            dragDistance = Math.abs(row.scrollLeft - startScroll);
            const now = performance.now();
            const dt = now - lastTime;
            if(dt > 0){
                const dist = e.clientX - lastX;
                velocity = dist / dt;
                lastX = e.clientX;
                lastTime = now;
            }
        }
        function endPointer(e){
            if(!isActive) return;
            isActive = false;
            row.classList.remove('grabbing');
            document.body.classList.remove('no-select');
            const didDrag = moved && dragDistance > 32;
            // If it was NOT a drag, ensure the underlying link triggers
            if(!didDrag && e){
                const tgt = e.target.closest('a.card-link');
                if(tgt){
                    // For movie links we rely on existing click handler (preventDefault + playContent). Just trigger default.
                    // Force a programmatic click if the browser suppressed it due to pointer capture.
                    if(!e.defaultPrevented){
                        // Let the natural click occur; if it didn't (some browsers), dispatch one.
                        if(!tgt._dispatched){
                            const evt = new MouseEvent('click',{bubbles:true,cancelable:true,view:window});
                            tgt.dispatchEvent(evt);
                            tgt._dispatched = true;
                            setTimeout(()=> delete tgt._dispatched,50);
                        }
                    }
                }
            }
            // release pointer capture so clicks propagate correctly
            if(activePointerId !== null){
                try { row.releasePointerCapture && row.releasePointerCapture(activePointerId); } catch(_){}
                activePointerId = null;
            }
            // reset moved for next interaction
            moved = false;
            dragDistance = 0;
            if(Math.abs(velocity) > minVelocity){ raf = requestAnimationFrame(momentum); }
        }
        function onPointerUp(e){ endPointer(e); }
        function onPointerCancel(e){ endPointer(); }
        function onPointerLeave(e){ if(isActive && e.pointerType==='mouse') endPointer(); }
        // No blanket click suppression: handled conditionally in endPointer
        row.addEventListener('pointerdown', onPointerDown);
        row.addEventListener('pointermove', onPointerMove);
        row.addEventListener('pointerup', onPointerUp);
        row.addEventListener('pointercancel', onPointerCancel);
        row.addEventListener('pointerleave', onPointerLeave);
    }

    playContent(item, mediaType) {
        const title = item.title || item.name;
        
        // Redirect to new standalone player pages
        if(mediaType === 'tv') {
            window.location.href = `tv-player.html?id=${item.id}&season=1&episode=1`;
        } else {
            window.location.href = `movie-player.html?id=${item.id}`;
        }
    }

    showContentInfo(item, mediaType) {
        const itemId = item.id;
        
        if (mediaType === 'tv') {
            window.location.href = `tv.html?id=${itemId}`;
        } else {
            window.location.href = `movie.html?id=${itemId}`;
        }
    }

    playHeroContent() {
        if (!this.currentHeroMovie) return;
        
        const isTV = this.currentHeroMovie.media_type === 'tv' || this.currentHeroMovie.first_air_date;
        if(isTV){
            window.location.href = `tv-player.html?id=${this.currentHeroMovie.id}&season=1&episode=1`;
        } else {
            window.location.href = `movie-player.html?id=${this.currentHeroMovie.id}`;
        }
    }

    showHeroInfo() {
        if (!this.currentHeroMovie) return;
        
        const isTV = this.currentHeroMovie.media_type === 'tv' || this.currentHeroMovie.first_air_date;
        const itemId = this.currentHeroMovie.id;
        
        if (isTV) {
            window.location.href = `tv.html?id=${itemId}`;
        } else {
            window.location.href = `movie.html?id=${itemId}`;
        }
    }

    setupSearch() {
        const searchInput = document.querySelector('.search-input');
        let searchTimeout;
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length > 2) {
                    searchTimeout = setTimeout(() => {
                        this.showSearchSuggestions(query);
                    }, 300);
                } else {
                    this.hideSearchSuggestions();
                }
            });
        }
    }

    async showSearchSuggestions(query) {
        // This could show a dropdown with search suggestions
        // For now, we'll just implement basic search redirect
    }

    hideSearchSuggestions() {
        // Hide search suggestions dropdown
    }

    performSearch(query) {
        if (!query.trim()) return;
        window.location.href = `search.html?q=${encodeURIComponent(query.trim())}`;
    }

    setupNavigation() {
        // Remove any event listeners that might interfere with default navigation
        // Navigation now uses default browser behavior for page links
        console.log('Navigation setup complete - using default page navigation');
    }

    /* NEW: Trending tabs switching */
    setupTrendingTabs(){
        const tabs = document.getElementById('trendingTabs');
        if(!tabs) return;
        tabs.addEventListener('click', async (e)=>{
            const btn = e.target.closest('.tab-btn');
            if(!btn) return;
            tabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            try {
                if(tab==='movies') {
                    const data = await getTrendingMovies();
                    this.populateRow('trending', data.results, 'movie', { maxItems: 10, ignoreGlobalDuplicates: true });
                } else if(tab==='tv') {
                    const data = await getTrendingTV();
                    this.populateRow('trending', data.results, 'tv', { maxItems: 10, ignoreGlobalDuplicates: true });
                } else {
                    const data = await getTrendingAll();
                    this.populateRow('trending', data.results, null, { maxItems: 10, ignoreGlobalDuplicates: true });
                }
            } catch(err){ console.warn('Trending tab error', err); }
        });
    }

    /* NEW: Seasonal spotlight (simple rotating curated sets) */
    setupSeasonalSpotlight(){
        const tabs = document.getElementById('seasonalTabs');
        const row = document.getElementById('seasonal-row');
        if(!tabs || !row) return;
        const collections = [
            { key:'halloween', label:'Chills', genre:27 },
            { key:'family', label:'Family', genre:10751 },
            { key:'space', label:'Sci‑Fi', genre:878 }
        ];
        tabs.innerHTML = collections.map((c,i)=>`<button class="tab-btn ${i===0?'active':''}" data-seasonal="${c.genre}">${c.label}</button>`).join('');
        const load = async (genre)=>{
            try {
                // Try fetching multiple pages for better chance of 10 unique items
                const items = await this.fetchPages((p) => window.tmdb.discoverMoviesByGenre(genre, p), [], 30);
                if (!items || !items.length) {
                    // fallback: use popular movies if discover yields nothing
                    const fallback = await this.fetchPages(getPopularMovies, [], 30);
                    this.populateRow('seasonal-row', fallback, 'movie', { maxItems: 10, ignoreGlobalDuplicates: true });
                } else {
                    this.populateRow('seasonal-row', items, 'movie', { maxItems: 10, ignoreGlobalDuplicates: true });
                }
            } catch(err){ console.warn('Seasonal load failed', err); }
        };
        load(collections[0].genre);
        tabs.addEventListener('click', (e)=>{
            const btn = e.target.closest('.tab-btn'); if(!btn) return;
            tabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            load(btn.dataset.seasonal);
        });
    }

    continueWatching() {
        const continueWatching = this.getContinueWatchingData();
        if (continueWatching.length > 0) {
            this.populateContinueWatchingRow(continueWatching);
            this.showContinueWatchingSection();
        } else {
            this.hideContinueWatchingSection();
        }
    }

    getContinueWatchingData() {
        try {
            const data = localStorage.getItem('jstream:continueWatching');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.warn('Failed to get continue watching data:', error);
            return [];
        }
    }

    populateContinueWatchingRow(items) {
        const row = document.getElementById('continue-watching');
        if (!row) return;

        row.innerHTML = items.map(item => {
            const title = item.title;
            const imageUrl = item.posterPath ? getImageURL(item.posterPath, 'w342') : '/assets/images/placeholder.jpg';
            const progressPercent = Math.round(item.progress || 0);
            const mediaType = item.mediaType;
            
            // Format display text for TV shows
            let displayTitle = title;
            if (mediaType === 'tv' && item.season && item.episode) {
                displayTitle += ` (S${item.season}E${item.episode})`;
            }

            // Generate click handler
            const clickHandler = mediaType === 'movie' ? 
                                `window.location.href='movie-player.html?id=${item.id}'` :
                                `window.location.href='tv-player.html?id=${item.id}&season=${item.season||1}&episode=${item.episode||1}'`;

            return `
                <div class="card continue-watching-card" onclick="${clickHandler}">
                    <a href="#" onclick="event.preventDefault();">
                        <div class="continue-poster-wrapper">
                            <img src="${imageUrl}" alt="${title}" loading="lazy">
                            <div class="continue-progress-bar">
                                <div class="continue-progress" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="continue-overlay">
                                <button class="continue-play-btn" onclick="event.stopPropagation(); resumeContent('${item.id}', '${mediaType}', ${item.season || 'null'}, ${item.episode || 'null'})">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                </button>
                                <button class="continue-remove-btn" onclick="event.stopPropagation(); removeContinueWatching('${this.getContentId(item)}')" title="Remove from Continue Watching">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="continue-info">
                            <h3>${displayTitle}</h3>
                            <p>${progressPercent}% watched</p>
                        </div>
                    </a>
                </div>
            `;
        }).join('');
    }

    showContinueWatchingSection() {
        const section = document.getElementById('continueWatchingSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    hideContinueWatchingSection() {
        const section = document.getElementById('continueWatchingSection');
        if (section) {
            section.style.display = 'none';
        }
    }

    setupContinueWatchingListener() {
        // Listen for continue watching updates
        document.addEventListener('continueWatchingUpdated', () => {
            this.loadContinueWatching();
        });
    }

    // Backwards-compatible wrapper: older code calls loadContinueWatching()
    loadContinueWatching() {
        try { this.continueWatching(); } catch (e) { console.warn('loadContinueWatching wrapper failed', e); }
    }
    getContentId(item) {
        const id = item.id;
        if (item.mediaType === 'tv' && item.season && item.episode) {
            return `${item.mediaType}-${id}-s${item.season}e${item.episode}`;
        }
        return `${item.mediaType || 'movie'}-${id}`;
    }

    showLoadingSpinner(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.hidden = !show;
            spinner.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        // Show error message to user
        console.error(message);
        // Could implement a toast notification here
    }

    setFooterYear() {
        try {
            const el = document.getElementById('yearCopy');
            if (el) el.textContent = new Date().getFullYear();
        } catch (e) { /* ignore */ }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jstreamApp = new JStreamApp();
});

// Testing helpers: allow forcing unmute or clearing the persisted hero mute preference
window.forceHeroUnmute = function(){
    try {
        try { localStorage.setItem('jstream:hero-muted', JSON.stringify(false)); } catch(_){ }
        const app = window.jstreamApp;
        if (app && app.heroYTPlayer) {
            try { app.heroYTPlayer.unMute && app.heroYTPlayer.unMute(); } catch(_){ }
            try { app.heroYTPlayer.playVideo && app.heroYTPlayer.playVideo(); } catch(_){ }
        }
        console.log('[HeroTrailer] forceHeroUnmute applied');
    } catch (e) { console.warn('forceHeroUnmute failed', e); }
};

window.clearHeroMutedPref = function(){
    try {
        localStorage.removeItem('jstream:hero-muted');
        console.log('[HeroTrailer] cleared jstream:hero-muted');
    } catch (e) { console.warn('clearHeroMutedPref failed', e); }
};

// Global functions for Continue Watching - Step 9
window.resumeContent = function(id, mediaType, season = null, episode = null) {
    if (mediaType === 'movie') {
        window.location.href = `movie-player.html?id=${id}`;
    } else if (mediaType === 'tv') {
        const s = season || 1; const e = episode || 1;
        window.location.href = `tv-player.html?id=${id}&season=${s}&episode=${e}`;
    }
};

window.removeContinueWatching = function(contentId) {
    try {
        const continueWatching = JSON.parse(localStorage.getItem('jstream:continueWatching') || '[]');
        const filtered = continueWatching.filter(item => {
            const itemId = window.jstreamApp.getContentId(item);
            return itemId !== contentId;
        });
        localStorage.setItem('jstream:continueWatching', JSON.stringify(filtered));
        
        // Refresh the continue watching section
        window.jstreamApp.loadContinueWatching();
    } catch (error) {
        console.warn('Failed to remove from continue watching:', error);
    }
};

// Global search function for navbar - Step 9
window.handleSearchInput = function(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    }
};

window.toggleSearch = function(ref) {
    // Accept either element (preferred) or event object
    let btn = null;
    if(ref instanceof Event) {
        btn = ref.currentTarget || ref.target;
    } else if (ref && ref.nodeType === 1) {
        btn = ref;
    }
    const container = btn ? btn.closest('.search-container') : document.querySelector('.search-container');
    if(!container) return;
    const input = container.querySelector('.search-input');
    const opening = !container.classList.contains('active');
    container.classList.toggle('active', opening);
    if(btn) btn.setAttribute('aria-expanded', String(opening));
    if(opening && input) {
        requestAnimationFrame(()=> { input.focus(); input.select(); ensureSearchVisible(container, input); });
    }
    // Debug (can be removed later)
    if(window.location.search.includes('debugSearch')) console.log('[SearchToggle]', {opening, container, input});
};

function ensureSearchVisible(container, input){
    if(!container || !input) return;
    // After transition start, verify width > minimal threshold; otherwise apply fallback inline style
    requestAnimationFrame(()=>{
        const w = input.getBoundingClientRect().width;
        if(w < 20){
            container.classList.add('fallback-inline');
            // Inline fallback styles (kept minimal to avoid CSS specificity battles)
            input.style.position = 'static';
            input.style.transform = 'none';
            input.style.width = '180px';
            input.style.opacity = '1';
            input.style.visibility = 'visible';
            input.style.pointerEvents = 'auto';
            input.focus();
        }
    });
}

// Mobile menu toggle
window.toggleMobileMenu = function() {
    const navMenu = document.querySelector('.nav-menu');
    const navToggle = document.querySelector('.nav-toggle');
    
    if (navMenu && navToggle) {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    }
};

// Close search when clicking outside or pressing ESC
document.addEventListener('click', (e)=>{
    const sc = document.querySelector('.search-container');
    if(!sc) return;
    if(sc.classList.contains('active')){
        if(!sc.contains(e.target)){
            sc.classList.remove('active');
            const btn = sc.querySelector('.search-btn');
            if(btn) btn.setAttribute('aria-expanded','false');
        }
    }
});
document.addEventListener('keydown',(e)=>{
    if(e.key==='Escape'){
        const sc = document.querySelector('.search-container');
        if(sc && sc.classList.contains('active')){
            sc.classList.remove('active');
            const btn = sc.querySelector('.search-btn');
            if(btn) btn.setAttribute('aria-expanded','false');
        }
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JStreamApp;
}
