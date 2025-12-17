// Trending desktop cards (hidden on mobile via CSS)
let trendingLoaded = false;
async function loadTrendingDesktop(){
    if(trendingLoaded) return; 
    if(window.innerWidth <= 768) return; // only desktop
    const grid = document.getElementById('trendingGrid');
    if(!grid) return;
    try{
        grid.innerHTML = '<div class="loading-mini">Loading…</div>';
        const data = await getTrendingAll();
        const list = (data?.results||[]).filter(it=> it.media_type==='tv' || it.media_type==='movie').slice(0,10);
        if(!list.length){ grid.innerHTML = '<div class="empty">No trending items.</div>'; return; }
        grid.innerHTML = list.map(item=>{
            const title = item.title || item.name || 'Untitled';
            const poster = item.poster_path ? getImageURL(item.poster_path,'w342') : 'assets/placeholder.png';
            const type = item.media_type === 'movie' ? 'movie' : 'tv';
            return `<div class="sim-card" data-id="${item.id}" data-type="${type}">
                <img src="${poster}" alt="${title}" loading="lazy"/>
                <div class="sim-overlay"><h5>${title}</h5></div>
            </div>`;
        }).join('');
        grid.querySelectorAll('.sim-card').forEach(card=>{
            card.addEventListener('click',()=>{
                const id = card.dataset.id; const mt = card.dataset.type; window.location.href = mt==='movie'? `movie.html?id=${id}`: `tv.html?id=${id}`;
            });
        });
        trendingLoaded = true;
    }catch(e){ console.error('Trending load failed', e); const grid = document.getElementById('trendingGrid'); if(grid) grid.innerHTML = '<div class="empty">Failed to load trending.</div>'; }
}
window.addEventListener('resize', ()=>{ if(window.innerWidth>768) loadTrendingDesktop(); });
document.addEventListener('DOMContentLoaded', ()=> loadTrendingDesktop());
/**
 * JStream Search Functionality - Step 9
 * Handles search bar, TMDB API search, and result display
 */

let currentFilter = 'all';
let currentQuery = '';
let searchTimeout = null;

// Initialize search functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const scopeSelect = document.getElementById('searchScope');
    if(searchInput){
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (query.length >= 2) {
                    performSearch(query);
                } else if (query.length === 0) {
                    showEmptyState();
                }
            }, 450);
        });
    }
    if(scopeSelect){
        scopeSelect.addEventListener('change', () => {
            currentFilter = scopeSelect.value;
            if(currentQuery) performSearch(currentQuery);
        });
    }
});

// Global search function for navbar
function handleSearchInput(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (!query) return;
        const onSearchPage = window.location.pathname.toLowerCase().endsWith('search.html');
        if (onSearchPage) {
            performSearch(query);
        } else {
            window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    }
}

// Toggle search input visibility (for mobile/desktop)
function toggleSearch() {
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');
    
    searchContainer.classList.toggle('active');
    if (searchContainer.classList.contains('active')) {
        searchInput.focus();
    }
}

// Main search function
async function performSearch(query) {
    currentQuery = query;
    
    // Update page title and search title
    document.title = `"${query}" - Search - JStream`;
    const st = document.getElementById('searchTitle');
    if(st) st.textContent = `Search results for "${query}"`;
    
    // Show loading state
    showLoadingState();
    
    try {
        let results = [];
        
        // Search based on current filter
    if (currentFilter === 'all' || currentFilter === 'movie') {
            const movieResults = await searchMovies(query);
            if (movieResults && movieResults.results) {
                results = results.concat(movieResults.results.map(item => ({
                    ...item,
                    media_type: 'movie'
                })));
            }
        }
        
        if (currentFilter === 'all' || currentFilter === 'tv') {
            const tvResults = await searchTV(query);
            if (tvResults && tvResults.results) {
                results = results.concat(tvResults.results.map(item => ({
                    ...item,
                    media_type: 'tv'
                })));
            }
        }
        if (currentFilter === 'all') {
            // Use multi search to back-fill any people not already included
            const multiResults = await searchMulti(query);
            if(multiResults && multiResults.results){
                const existingKeys = new Set(results.map(r=> `${r.media_type}-${r.id}`));
                multiResults.results.forEach(item=>{
                    const key = `${item.media_type}-${item.id}`;
                    if(!existingKeys.has(key)) results.push(item);
                });
            }
        } else if(currentFilter === 'person') {
            const peopleResults = await searchPeople(query);
            if(peopleResults && peopleResults.results){
                results = results.concat(peopleResults.results.map(p=> ({...p, media_type:'person'})));
            }
        }
        
        // Sort results by popularity
        results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        // Display results
        if (results.length > 0) {
            displaySearchResults(results);
        } else {
            showNoResultsState();
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showErrorState();
    }
}

// Display search results
function displaySearchResults(results) {
    const resultsGrid = document.getElementById('resultsGrid');
    const searchEmpty = document.getElementById('searchEmpty');
    const searchLoading = document.getElementById('searchLoading');
    const searchNoResults = document.getElementById('searchNoResults');
    const trendingSection = document.getElementById('trendingSection');
    
    // Hide other states
    searchEmpty.hidden = true;
    searchLoading.hidden = true;
    searchNoResults.hidden = true;
    if(trendingSection) trendingSection.hidden = window.innerWidth <= 768; // keep on desktop
    resultsGrid.hidden = false;
    
    // Generate HTML for results
    resultsGrid.innerHTML = results.map(item => {
        const title = item.title || item.name;
        const releaseYear = item.release_date ? new Date(item.release_date).getFullYear() : 
                           item.first_air_date ? new Date(item.first_air_date).getFullYear() : '';
        const mediaType = item.media_type === 'movie' ? 'Movie' : 
                         item.media_type === 'tv' ? 'TV Show' : 
                         item.known_for_department ? 'Person' : 'Unknown';
        const posterPath = item.poster_path || item.profile_path;
        const imageUrl = posterPath ? getImageURL(posterPath, 'w342') : '/assets/images/placeholder.jpg';
        
        // For people, show their known works
        const overview = item.media_type === 'person' ? 
                        (item.known_for ? `Known for: ${item.known_for.map(work => work.title || work.name).slice(0, 3).join(', ')}` : '') :
                        (item.overview || 'No description available.');
        
        // Generate click handler based on media type
        const clickHandler = item.media_type === 'person' ? 
                            `onclick="showPersonDetails(${item.id})"` :
                            item.media_type === 'movie' ? 
                            `onclick="window.location.href='movie.html?id=${item.id}'"` :
                            `onclick="window.location.href='tv.html?id=${item.id}'"`;
        
        return `
            <div class="search-result-card" ${clickHandler}>
                <div class="result-image">
                    <img src="${imageUrl}" alt="${title}" loading="lazy">
                    <div class="result-overlay">
                        <button class="result-play-btn" onclick="event.stopPropagation(); ${item.media_type === 'person' ? 'showPersonDetails(' + item.id + ')' : 'playContent(' + item.id + ', \'' + item.media_type + '\')'}">
                            ${item.media_type === 'person' ? 
                                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>' :
                                '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                            }
                        </button>
                    </div>
                </div>
                <div class="result-info">
                    <h3 class="result-title">${title}</h3>
                    <div class="result-meta">
                        <span class="result-type">${mediaType}</span>
                        ${releaseYear ? `<span class="result-year">${releaseYear}</span>` : ''}
                        ${item.vote_average ? `<span class="result-rating">${item.vote_average.toFixed(1)}/10</span>` : ''}
                    </div>
                    <p class="result-overview">${overview.substring(0, 120)}${overview.length > 120 ? '...' : ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Show different states
function showEmptyState() {
    document.getElementById('searchEmpty').hidden = false;
    document.getElementById('searchLoading').hidden = true;
    document.getElementById('searchNoResults').hidden = true;
    document.getElementById('resultsGrid').hidden = true;
    const ts = document.getElementById('trendingSection'); if(ts) ts.hidden = window.innerWidth <= 768;
    document.getElementById('searchTitle').textContent = 'Search Results';
    document.title = 'Search - JStream';
}

function showLoadingState() {
    document.getElementById('searchEmpty').hidden = true;
    document.getElementById('searchLoading').hidden = false;
    document.getElementById('searchNoResults').hidden = true;
    document.getElementById('resultsGrid').hidden = true;
    const ts1 = document.getElementById('trendingSection'); if(ts1) ts1.hidden = window.innerWidth <= 768;
}

function showNoResultsState() {
    document.getElementById('searchEmpty').hidden = true;
    document.getElementById('searchLoading').hidden = true;
    document.getElementById('searchNoResults').hidden = false;
    document.getElementById('resultsGrid').hidden = true;
    const ts2 = document.getElementById('trendingSection'); if(ts2) ts2.hidden = window.innerWidth <= 768;
}

function showErrorState() {
    const searchNoResults = document.getElementById('searchNoResults');
    searchNoResults.querySelector('h2').textContent = 'Search Error';
    searchNoResults.querySelector('p').textContent = 'Something went wrong. Please try again later.';
    showNoResultsState();
}

// Play content function
function playContent(id, mediaType) {
    if (mediaType === 'movie') {
        window.location.href = `movie.html?id=${id}`;
    } else if (mediaType === 'tv') {
        window.location.href = `tv.html?id=${id}`;
    }
}

// Show person details (placeholder - could expand to person detail page)
async function showPersonDetails(personId) {
    try {
        const modalId = 'personDetailModal';
        let modal = document.getElementById(modalId);
        if(!modal){
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'person-modal';
            modal.innerHTML = `
                <div class="person-backdrop"></div>
                <div class="person-dialog" role="dialog" aria-modal="true" aria-label="Person details">
                    <button class="person-close" aria-label="Close" data-close>&times;</button>
                    <div class="person-header">
                        <div class="person-photo-wrap"><img alt="Profile" class="person-photo" loading="lazy"/></div>
                        <div class="person-head-meta">
                            <h2 class="person-name"></h2>
                            <div class="person-sub"></div>
                            <div class="person-ext-links" aria-label="External links"></div>
                        </div>
                    </div>
                    <div class="person-body">
                        <div class="person-bio"></div>
                        <div class="person-knownfor">
                            <h3>Known For</h3>
                            <div class="person-knownfor-grid"></div>
                        </div>
                        <div class="person-credits">
                            <h3>Filmography</h3>
                            <div class="person-credits-list"></div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            modal.addEventListener('click', e=>{ if(e.target===modal || e.target.hasAttribute('data-close')) closePersonModal(); });
            document.addEventListener('keydown', e=>{ if(e.key==='Escape') closePersonModal(); });
        }
        modal.classList.add('open');
        document.body.classList.add('modal-open');
        const nameEl = modal.querySelector('.person-name');
        const photoEl = modal.querySelector('.person-photo');
        const subEl = modal.querySelector('.person-sub');
        const bioEl = modal.querySelector('.person-bio');
        const knownGrid = modal.querySelector('.person-knownfor-grid');
        const creditsList = modal.querySelector('.person-credits-list');
        const linksEl = modal.querySelector('.person-ext-links');
        nameEl.textContent = 'Loading…';
        bioEl.textContent = '';
        knownGrid.innerHTML = '<div class="loading-mini">Loading…</div>';
        creditsList.innerHTML = '';
        const data = await getPersonDetails(personId);
        nameEl.textContent = data.name || 'Unknown';
        subEl.textContent = [data.known_for_department, data.place_of_birth && `From ${data.place_of_birth}`, data.birthday && `Born ${data.birthday}`].filter(Boolean).join(' • ');
        if(data.profile_path) photoEl.src = getImageURL(data.profile_path,'w342'); else photoEl.src='assets/placeholder.png';
        if(data.biography) bioEl.textContent = data.biography.split('\n').slice(0,3).join(' ');
        // External IDs
        const ext = data.external_ids || {};
        linksEl.innerHTML = '';
        const extLinks = [
            ext.imdb_id && {href:`https://www.imdb.com/name/${ext.imdb_id}/`, label:'IMDb'},
            ext.instagram_id && {href:`https://instagram.com/${ext.instagram_id}`, label:'Instagram'},
            ext.twitter_id && {href:`https://x.com/${ext.twitter_id}`, label:'X'},
        ].filter(Boolean);
        if(extLinks.length){
            extLinks.forEach(l=>{
                const a=document.createElement('a'); a.href=l.href; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=l.label; linksEl.appendChild(a); });
        }
        // Known for (top popularity combined_credits cast)
        const combined = (data.combined_credits && data.combined_credits.cast) ? data.combined_credits.cast.slice() : [];
        combined.sort((a,b)=> (b.popularity||0)-(a.popularity||0));
        const topKnown = combined.slice(0,8);
        knownGrid.innerHTML = topKnown.map(it=>{
            const img = it.poster_path ? getImageURL(it.poster_path,'w185'): 'assets/placeholder.png';
            const t = it.title || it.name || 'Untitled';
            const yr = (it.release_date||it.first_air_date)? new Date(it.release_date||it.first_air_date).getFullYear():'';
            return `<div class="kf-card" data-type="${it.media_type}" data-id="${it.id}">
                <img src="${img}" alt="${t}" loading="lazy"/>
                <div class="kf-meta"><span class="kf-title">${t}</span>${yr?`<span class="kf-year">${yr}</span>`:''}</div>
            </div>`;
        }).join('');
        knownGrid.querySelectorAll('.kf-card').forEach(card=>{
            card.addEventListener('click',()=>{
                const mt = card.getAttribute('data-type'); const id = card.getAttribute('data-id');
                if(mt==='movie') window.location.href = `movie.html?id=${id}`; else if(mt==='tv') window.location.href=`tv.html?id=${id}`;
            });
        });
        // Filmography grouped by year (cast only for brevity)
        const creditsByYear = {};
        combined.forEach(c=>{
            const y = (c.release_date||c.first_air_date||'').slice(0,4)||'—';
            if(!creditsByYear[y]) creditsByYear[y]=[]; creditsByYear[y].push(c);
        });
        const years = Object.keys(creditsByYear).sort((a,b)=> b.localeCompare(a));
        creditsList.innerHTML = years.slice(0,12).map(y=>{
            const items = creditsByYear[y].sort((a,b)=> (b.popularity||0)-(a.popularity||0)).slice(0,6).map(c=>{
                const title = c.title||c.name||'Untitled';
                const role = c.character ? `<span class="cr-role">as ${c.character.split('/')[0].trim()}</span>`: '';
                return `<div class="cr-item" data-type="${c.media_type}" data-id="${c.id}"><span class="cr-title">${title}</span>${role}</div>`;
            }).join('');
            return `<div class="cr-year"><h4>${y}</h4><div class="cr-items">${items}</div></div>`;
        }).join('');
        creditsList.querySelectorAll('.cr-item').forEach(it=>{
            it.addEventListener('click',()=>{
                const mt=it.getAttribute('data-type'); const id=it.getAttribute('data-id'); if(mt==='movie') window.location.href=`movie.html?id=${id}`; else if(mt==='tv') window.location.href=`tv.html?id=${id}`; });
        });
    } catch(err){
        console.error('Person details failed', err);
        alert('Failed to load person details.');
    }
}

function closePersonModal(){
    const modal = document.getElementById('personDetailModal');
    if(modal){ modal.classList.remove('open'); document.body.classList.remove('modal-open'); }
}

// Initialize search from URL parameter if present
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (query) {
        document.getElementById('searchInput').value = query;
        performSearch(query);
    }
});
