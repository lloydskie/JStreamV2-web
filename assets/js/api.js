/**
 * TMDB API Integration for JStream
 * Simplified API wrapper with caching
 */

const API_KEY = "49787128da94b3585b21dac5c4a92fcc";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

// Cache for API responses
const apiCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Generic fetch with caching (simple path only, no extra params)
async function fetchData(endpoint) {
    return fetchDataWithParams(endpoint, {});
}

// Enhanced generic fetch that accepts query parameters object
async function fetchDataWithParams(endpoint, params = {}) {
    try {
        const searchParams = new URLSearchParams({ api_key: API_KEY, language: 'en-US', ...params });
    const separator = endpoint.includes('?') ? '&' : '?';
    const cacheKey = endpoint + separator + searchParams.toString();

        if (apiCache.has(cacheKey)) {
            const cached = apiCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
                return cached.data;
            }
            apiCache.delete(cacheKey);
        }

    const res = await fetch(`${BASE_URL}${endpoint}${separator}${searchParams.toString()}`);
        if (!res.ok) throw new Error(`API request failed: ${res.status} ${res.statusText}`);
        const data = await res.json();

        apiCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    } catch (err) {
        console.error('TMDB API error:', err);
        throw err;
    }
}

// Homepage content functions
async function getTrendingMovies(page = 1) {
    return fetchDataWithParams("/trending/movie/week", { page });
}

async function getTrendingTV(page = 1) {
    return fetchDataWithParams("/trending/tv/week", { page });
}

async function getTrendingAll(page = 1) {
    return fetchDataWithParams("/trending/all/day", { page });
}

async function getPopularMovies(page = 1) {
    return fetchDataWithParams("/movie/popular", { page });
}

async function getPopularTV(page = 1) {
    return fetchDataWithParams("/tv/popular", { page });
}

async function getTopRatedMovies(page = 1) {
    return fetchDataWithParams("/movie/top_rated", { page });
}

async function getTopRatedTV(page = 1) {
    return fetchDataWithParams("/tv/top_rated", { page });
}

async function getNowPlayingMovies(page = 1) {
    return fetchDataWithParams("/movie/now_playing", { page });
}

async function getUpcomingMovies(page = 1) {
    return fetchDataWithParams("/movie/upcoming", { page });
}

// Discover helpers (used for upgraded UI sections)
async function discoverTVByNetwork(networkId, page = 1) {
    return fetchDataWithParams('/discover/tv', {
        with_networks: networkId,
        sort_by: 'popularity.desc',
        page
    });
}

async function discoverMoviesByGenre(genreId, page = 1) {
    return fetchDataWithParams('/discover/movie', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page
    });
}

async function discoverTVByGenre(genreId, page = 1) {
    return fetchDataWithParams('/discover/tv', {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page
    });
}

// Detail page functions
async function getMovieDetails(id) {
    return fetchData(`/movie/${id}?append_to_response=credits,videos,similar,reviews`);
}

async function getTvDetails(id) {
    return fetchData(`/tv/${id}?append_to_response=credits,videos,similar,reviews`);
}

async function getTvSeasonDetails(tvId, seasonNumber) {
    return fetchData(`/tv/${tvId}/season/${seasonNumber}`);
}

// Search functions
async function searchMulti(query, page = 1) {
    return fetchData(`/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
}

async function searchMovies(query, page = 1) {
    return fetchData(`/search/movie?query=${encodeURIComponent(query)}&page=${page}`);
}

async function searchTV(query, page = 1) {
    return fetchData(`/search/tv?query=${encodeURIComponent(query)}&page=${page}`);
}

// Person search (actors / people)
async function searchPeople(query, page = 1) {
    return fetchData(`/search/person?query=${encodeURIComponent(query)}&page=${page}`);
}

// Person details (includes combined credits for filmography)
async function getPersonDetails(id) {
    return fetchData(`/person/${id}?append_to_response=combined_credits,external_ids`);
}

// Utility functions
function getImageURL(path, size = 'w500') {
    if (!path) return 'assets/placeholder.png';
    return `https://image.tmdb.org/t/p/${size}${path}`;
}

function formatRuntime(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatReleaseDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).getFullYear();
}

function getTrailerURL(videos) {
    if (!videos || !videos.results) return null;
    const trailer = videos.results.find(video => 
        video.type === 'Trailer' && 
        video.site === 'YouTube'
    );
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

// Create global TMDB object for compatibility
window.tmdb = {
    getTrending: (mediaType = 'all', timeWindow = 'day') => {
        if (mediaType === 'movie') return getTrendingMovies();
        if (mediaType === 'tv') return getTrendingTV();
        return getTrendingAll();
    },
    getPopular: (mediaType = 'movie') => {
        return mediaType === 'tv' ? getPopularTV() : getPopularMovies();
    },
    getTopRated: (mediaType = 'movie') => {
        return mediaType === 'tv' ? getTopRatedTV() : getTopRatedMovies();
    },
    getNowPlaying: getNowPlayingMovies,
    getUpcoming: getUpcomingMovies,
    discoverTVByNetwork,
    discoverMoviesByGenre,
    discoverTVByGenre,
    getMovieDetails,
    getTVShowDetails: getTvDetails,
    getTVSeasonDetails: getTvSeasonDetails,
    searchMulti,
    searchMovies,
    searchTVShows: searchTV,
    searchPeople,
    getImageURL,
    formatRuntime,
    formatReleaseDate,
    getTrailerURL,
    getPersonDetails
};

// Export functions for direct use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchData,
        getTrendingMovies,
        getTrendingTV,
        getTrendingAll,
        getPopularMovies,
        getPopularTV,
        getTopRatedMovies,
        getTopRatedTV,
        getNowPlayingMovies,
        getUpcomingMovies,
    discoverTVByNetwork,
    discoverMoviesByGenre,
    discoverTVByGenre,
        getMovieDetails,
        getTvDetails,
        getTvSeasonDetails,
        searchMulti,
        searchMovies,
        searchTV,
    searchPeople,
    getPersonDetails,
        getImageURL,
        formatRuntime,
        formatReleaseDate,
        getTrailerURL
    };
}
