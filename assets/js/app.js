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

    async init() {
        this.setupEventListeners();
        await this.loadHomepageContent();
        this.loadContinueWatching(); // Step 9 - Load continue watching
        this.setupSearch();
        this.setupNavigation();
        this.setupContinueWatchingListener(); // Step 9 - Listen for updates
    this.setupTrendingTabs();
    this.setupGenreTabs();
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
            // Get a mix of trending movies & tv for richness
            const [trendMoviesRaw, trendTVRaw] = await Promise.all([
                window.tmdb.getTrending('movie','day').catch(e=>{console.warn('Movie trending failed',e); return {}; }),
                window.tmdb.getTrending('tv','day').catch(e=>{console.warn('TV trending failed',e); return {}; })
            ]);
            const trendMovies = trendMoviesRaw || {}; const trendTV = trendTVRaw || {};
            console.log('API responses:', { trendMovies, trendTV });
            const candidates = [...(trendMovies.results||[]), ...(trendTV.results||[])]
                .filter(it=>it && it.backdrop_path)
                .sort((a,b)=>(b.popularity||0)-(a.popularity||0))
                .slice(0,6);
            console.log('Hero candidates:', candidates);
            if(!candidates.length) {
                console.warn('No hero candidates found');
                this.buildFallbackHero();
                return;
            }
            this.buildHeroSlides(candidates);
            this.goToHeroSlide(0, false);
            this.startHeroCarousel();
            console.log('Hero carousel started successfully');
        } catch (error) {
            console.error('Failed to load hero content:', error);
        }
    }

    buildHeroSlides(items){
        console.log('Building hero slides for:', items);
        const container = document.getElementById('heroSlides');
        if(!container) {
            console.error('Hero slides container not found');
            return;
        }
        container.innerHTML='';
        this.heroSlides = items.map((item,idx)=>{
            const overview = (item.overview||'').trim();
            const words = overview.split(/\s+/).filter(Boolean);
            const short = words.length > 8 ? words.slice(0,8).join(' ') + '...' : words.join(' ') || 'No description available.';
            const isTV = item.media_type==='tv' || item.first_air_date;
            const slide = document.createElement('div');
            slide.className = 'hero-slide';
            slide.setAttribute('data-index', idx);
            slide.setAttribute('aria-hidden','true');
            const imageUrl = window.tmdb.getImageURL(item.backdrop_path,'w1280');
            console.log(`Creating slide ${idx} for ${item.title||item.name} with image: ${imageUrl}`);
            slide.innerHTML = `
                <div class="hero-backdrop"><img class="hero-image" src="${imageUrl}" alt="${(item.title||item.name)} backdrop" loading="lazy"/></div>
                <div class="hero-content">
                    <div class="hero-info">
                        <h1 class="hero-title">${item.title||item.name}</h1>
                        <p class="hero-description">${short}</p>
                        <div class="hero-actions">
                            <button class="btn btn-primary play-btn" data-type="${isTV?'tv':'movie'}"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Play</button>
                            <button class="btn btn-secondary info-btn" data-type="${isTV?'tv':'movie'}"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>More Info</button>
                        </div>
                    </div>
                </div>`;
            // Button handlers
            slide.querySelector('.play-btn').addEventListener('click', ()=>{
                if(isTV){
                    window.location.href = `tv-player.html?id=${item.id}&season=1&episode=1`;
                } else {
                    window.location.href = `movie-player.html?id=${item.id}`;
                }
            });
            slide.querySelector('.info-btn').addEventListener('click', ()=>{
                if(isTV){
                    window.location.href = `tv.html?id=${item.id}`;
                } else {
                    window.location.href = `movie.html?id=${item.id}`;
                }
            });
            container.appendChild(slide);
            return {el:slide, data:item};
        });
    // Reset translate for fresh build
    container.style.transform = 'translateX(0)';
    console.log(`Created ${this.heroSlides.length} hero slides`);
        this.buildHeroDots();
        this.setupHeroNav();
    }

    buildHeroDots(){
        const dotsWrap = document.getElementById('heroDots'); if(!dotsWrap) return;
        dotsWrap.innerHTML = '';
        this.heroSlides.forEach((s,i)=>{
            const b = document.createElement('button');
            b.className='hero-dot';
            b.type='button';
            b.setAttribute('role','tab');
            b.setAttribute('aria-label',`Go to slide ${i+1}`);
            b.addEventListener('click', ()=> this.goToHeroSlide(i));
            dotsWrap.appendChild(b);
        });
    }

    setupHeroNav(){
        const prev = document.querySelector('.hero-prev');
        const next = document.querySelector('.hero-next');
        if(prev) prev.addEventListener('click', ()=> this.prevHeroSlide());
        if(next) next.addEventListener('click', ()=> this.nextHeroSlide());
        const hero = document.getElementById('hero');
        if(hero){
            hero.addEventListener('mouseenter', ()=> this.pauseHeroCarousel());
            hero.addEventListener('mouseleave', ()=> this.resumeHeroCarousel());
            hero.addEventListener('keydown', (e)=>{ if(e.key==='ArrowRight') { this.nextHeroSlide(); } else if(e.key==='ArrowLeft'){ this.prevHeroSlide(); }});
        }
    }

    goToHeroSlide(index, animate=true){
        if(!this.heroSlides.length) {
            console.warn('No hero slides available');
            return;
        }
        const clamped = (index+this.heroSlides.length)%this.heroSlides.length;
        console.log(`Going to hero slide ${clamped} (animate: ${animate})`);
        this.heroSlides.forEach((s,i)=>{
            const active = i===clamped;
            s.el.classList.toggle('active', active);
            s.el.setAttribute('aria-hidden', active? 'false':'true');
        });
        const slidesContainer = document.getElementById('heroSlides');
        if(slidesContainer){ slidesContainer.style.transform = `translateX(-${clamped*100}%)`; }
        // Update dots
        const dots = document.querySelectorAll('.hero-dot');
        dots.forEach((d,i)=> d.classList.toggle('active', i===clamped));
        this.heroIndex = clamped;
        this.currentHeroMovie = this.heroSlides[clamped].data;
        console.log('Current hero movie:', this.currentHeroMovie.title || this.currentHeroMovie.name);
    }

    nextHeroSlide(){ this.goToHeroSlide(this.heroIndex+1); }
    prevHeroSlide(){ this.goToHeroSlide(this.heroIndex-1); }

    startHeroCarousel(){
        this.clearHeroTimer();
        this.heroTimer = setInterval(()=> this.nextHeroSlide(), 5000); // 5s
    }
    pauseHeroCarousel(){ this.clearHeroTimer(); }
    resumeHeroCarousel(){ if(!this.heroTimer) this.startHeroCarousel(); }
    clearHeroTimer(){ if(this.heroTimer){ clearInterval(this.heroTimer); this.heroTimer=null; } }

    buildFallbackHero(){
        const container = document.getElementById('heroSlides');
        if(!container) return;
    container.innerHTML = `<div class=\"hero-slide active\" aria-hidden=\"false\">\n            <div class=\"hero-backdrop\"><div class=\"hero-image skeleton-bg\"></div></div>\n            <div class=\"hero-content\"><div class=\"hero-info\"><h1 class=\"hero-title\">Featured Unavailable</h1><p class=\"hero-description\">Content unavailable. Please refresh.</p></div></div></div>`;
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
        // Load trending content
        try {
            const trendingData = await this.fetchPages(getTrendingAll, [], 20);
            this.populateRow('trending', trendingData);
        } catch (error) {
            console.error('Failed to load trending:', error);
        }

        // Load Top 10 (reuse trending + popular combined, then sort by popularity)
        try {
            // Fetch more pages from both trending and popular so we have enough items to pick Top 10
            const trendingItems = await this.fetchPages(getTrendingAll, [], 30);
            const popularItems = await this.fetchPages(getPopularMovies, [], 30);
            const combined = [...trendingItems, ...popularItems];
            // Build unique map by id to avoid duplicates in combined pool
            const byId = new Map();
            for(const it of combined){ if(it && it.id && it.poster_path){ if(!byId.has(it.id)) byId.set(it.id, it); } }
            const ranked = Array.from(byId.values()).sort((a,b)=> (b.popularity||0)-(a.popularity||0)).slice(0,10);
            // Ensure Top 10 displays a full set by allowing it to bypass the global duplicate filter.
            this.populateRow('top-10', ranked, null, { ignoreGlobalDuplicates: true });
        } catch(e){ console.warn('Top 10 load failed', e); }

        // Load popular movies
        try {
            const popularMovies = await this.fetchPages(getPopularMovies, [], 20);
            this.populateRow('popular-movies', popularMovies, 'movie');
        } catch (error) {
            console.error('Failed to load popular movies:', error);
        }

        // Load popular TV shows
        try {
            const popularTV = await this.fetchPages(getPopularTV, [], 20);
            this.populateRow('popular-tv', popularTV, 'tv');
        } catch (error) {
            console.error('Failed to load popular TV:', error);
        }

        // Load top rated movies
        try {
            const topRatedMovies = await this.fetchPages(getTopRatedMovies, [], 20);
            this.populateRow('top-rated-movies', topRatedMovies, 'movie');
        } catch (error) {
            console.error('Failed to load top rated movies:', error);
        }

        // Load top rated TV shows
        try {
            const topRatedTV = await this.fetchPages(getTopRatedTV, [], 20);
            this.populateRow('top-rated-tv', topRatedTV, 'tv');
        } catch (error) {
            console.error('Failed to load top rated TV:', error);
        }

        // Load now playing
        try {
            const nowPlaying = await this.fetchPages(getNowPlayingMovies, [], 20);
            this.populateRow('now-playing', nowPlaying, 'movie');
        } catch (error) {
            console.error('Failed to load now playing:', error);
        }

        // Load upcoming
        try {
            const upcoming = await this.fetchPages(getUpcomingMovies, [], 20);
            this.populateRow('upcoming', upcoming, 'movie');
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
        for (const it of valid) {
            if (!it || !it.id) continue;
            if (!ignoreGlobal && this.usedContentIds.has(it.id)) continue; // skip duplicates across previously rendered rows
            unique.push(it);
            if (unique.length >= 40) break; // safety cap
        }

        // Decide how many to render (cap at 20 like before)
        const renderList = unique.slice(0, 20);
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
                    this.populateRow('trending', data.results, 'movie');
                } else if(tab==='tv') {
                    const data = await getTrendingTV();
                    this.populateRow('trending', data.results, 'tv');
                } else {
                    const data = await getTrendingAll();
                    this.populateRow('trending', data.results);
                }
            } catch(err){ console.warn('Trending tab error', err); }
        });
    }

    /* NEW: Genre tabs (Movies) */
    setupGenreTabs(){
        const genreTabs = document.getElementById('genreTabs');
        const genreRow = document.getElementById('genre-row');
        if(!genreTabs || !genreRow) return;
        // Basic curated genre list
        const genres = [
            {id:28, name:'Action'},
            {id:35, name:'Comedy'},
            {id:27, name:'Horror'},
            {id:10749, name:'Romance'},
            {id:878, name:'Sci-Fi'},
            {id:16, name:'Animation'}
        ];
        genreTabs.innerHTML = genres.map((g,i)=>`<button class="tab-btn ${i===0?'active':''}" data-genre="${g.id}">${g.name}</button>`).join('');
        const loadGenre = async (id)=>{
            try {
                const data = await window.tmdb.discoverMoviesByGenre(id);
                this.populateRow('genre-row', data.results, 'movie');
            } catch(err){ console.warn('Genre load failed', err); }
        };
        loadGenre(genres[0].id);
        genreTabs.addEventListener('click', (e)=>{
            const btn = e.target.closest('.tab-btn'); if(!btn) return;
            genreTabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            loadGenre(btn.dataset.genre);
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
            try { const data = await window.tmdb.discoverMoviesByGenre(genre); this.populateRow('seasonal-row', data.results, 'movie'); }
            catch(err){ console.warn('Seasonal load failed', err); }
        };
        load(collections[0].genre);
        tabs.addEventListener('click', (e)=>{
            const btn = e.target.closest('.tab-btn'); if(!btn) return;
            tabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            load(btn.dataset.seasonal);
        });
    }

    setFooterYear(){
        const el = document.getElementById('yearCopy');
        if(el) el.textContent = new Date().getFullYear();
    }

    // Step 9 - Continue Watching functionality
    loadContinueWatching() {
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.jstreamApp = new JStreamApp();
});

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
