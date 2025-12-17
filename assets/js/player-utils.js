// Shared player utility for standalone movie and TV player pages
(function(){
  function embedMovie(tmdbId, options = {}) {
    const base = `https://www.vidking.net/embed/movie/${tmdbId}`;
    const params = new URLSearchParams(options).toString();
    return `${base}${params ? '?' + params : ''}`;
  }
  function embedTv(tmdbId, season, episode, options = {}) {
    const base = `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}`;
    const params = new URLSearchParams(options).toString();
    return `${base}${params ? '?' + params : ''}`;
  }
  function parseQuery(){
    const p = new URLSearchParams(window.location.search);
    const obj = {}; p.forEach((v,k)=> obj[k]=v); return obj;
  }
  function formatTime(seconds){
    if(!seconds||seconds<0) return '0:00';
    const h=Math.floor(seconds/3600), m=Math.floor((seconds%3600)/60), s=Math.floor(seconds%60);
    if(h>0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
  }
  function saveProgress(key, data){
    try { localStorage.setItem(`jstream:progress:${key}`, JSON.stringify(data)); } catch(e){ console.warn('Save progress failed', e); }
  }
  function loadProgress(key){
    try { const d = localStorage.getItem(`jstream:progress:${key}`); return d? JSON.parse(d): null; } catch(e){ return null; }
  }
  window.JStreamPlayerUtils = { embedMovie, embedTv, parseQuery, formatTime, saveProgress, loadProgress };
})();
