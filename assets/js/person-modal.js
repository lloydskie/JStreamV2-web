// Global Person Detail Modal (shared across pages)
// Depends on api.js providing getPersonDetails & getImageURL
(function(){
  if(window.showPersonDetails) return; // already defined (e.g., search.js)

  async function showPersonDetails(personId){
    try{
      const modalId='personDetailModal';
      let modal=document.getElementById(modalId);
      if(!modal){
        modal=document.createElement('div');
        modal.id=modalId; modal.className='person-modal';
        modal.innerHTML=`<div class="person-backdrop"></div><div class="person-dialog" role="dialog" aria-modal="true" aria-label="Person details"><button class="person-close" aria-label="Close" data-close>&times;</button><div class="person-header"><div class="person-photo-wrap"><img alt="Profile" class="person-photo" loading="lazy"/></div><div class="person-head-meta"><h2 class="person-name"></h2><div class="person-sub"></div><div class="person-ext-links" aria-label="External links"></div></div></div><div class="person-body"><div class="person-bio"></div><div class="person-knownfor"><h3>Known For</h3><div class="person-knownfor-grid"></div></div><div class="person-credits"><h3>Filmography</h3><div class="person-credits-list"></div></div></div></div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click',e=>{ if(e.target===modal|| e.target.hasAttribute('data-close')) closePersonModal(); });
        document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePersonModal(); });
      }
      modal.classList.add('open'); document.body.classList.add('modal-open');
      const nameEl=modal.querySelector('.person-name');
      const photoEl=modal.querySelector('.person-photo');
      const subEl=modal.querySelector('.person-sub');
      const bioEl=modal.querySelector('.person-bio');
      const knownGrid=modal.querySelector('.person-knownfor-grid');
      const creditsList=modal.querySelector('.person-credits-list');
      const linksEl=modal.querySelector('.person-ext-links');
      nameEl.textContent='Loading…'; bioEl.textContent=''; knownGrid.innerHTML='<div class="loading-mini">Loading…</div>'; creditsList.innerHTML='';
      const data = await getPersonDetails(personId);
      nameEl.textContent = data.name || 'Unknown';
      subEl.textContent = [data.known_for_department, data.place_of_birth && `From ${data.place_of_birth}`, data.birthday && `Born ${data.birthday}`].filter(Boolean).join(' • ');
      if(data.profile_path) photoEl.src=getImageURL(data.profile_path,'w342'); else photoEl.src='assets/placeholder.png';
      if(data.biography) bioEl.textContent = data.biography.split('\n').slice(0,3).join(' ');
      const ext=data.external_ids||{}; linksEl.innerHTML='';
      [ext.imdb_id && {href:`https://www.imdb.com/name/${ext.imdb_id}/`,label:'IMDb'}, ext.instagram_id && {href:`https://instagram.com/${ext.instagram_id}`,label:'Instagram'}, ext.twitter_id && {href:`https://x.com/${ext.twitter_id}`,label:'X'}].filter(Boolean).forEach(l=>{ const a=document.createElement('a'); a.href=l.href; a.target='_blank'; a.rel='noopener noreferrer'; a.textContent=l.label; linksEl.appendChild(a); });
      const combined=(data.combined_credits && data.combined_credits.cast)? data.combined_credits.cast.slice():[];
      combined.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
      const topKnown=combined.slice(0,8);
      knownGrid.innerHTML = topKnown.map(it=>{ const img= it.poster_path? getImageURL(it.poster_path,'w185'):'assets/placeholder.png'; const t=it.title||it.name||'Untitled'; const yr=(it.release_date||it.first_air_date)? new Date(it.release_date||it.first_air_date).getFullYear():''; return `<div class="kf-card" data-type="${it.media_type}" data-id="${it.id}"><img src="${img}" alt="${t}" loading="lazy"/><div class="kf-meta"><span class="kf-title">${t}</span>${yr?`<span class=\"kf-year\">${yr}</span>`:''}</div></div>`; }).join('');
      knownGrid.querySelectorAll('.kf-card').forEach(card=> card.addEventListener('click',()=>{ const mt=card.getAttribute('data-type'); const id=card.getAttribute('data-id'); if(mt==='movie') window.location.href=`movie.html?id=${id}`; else if(mt==='tv') window.location.href=`tv.html?id=${id}`; }));
      const creditsByYear={}; combined.forEach(c=>{ const y=(c.release_date||c.first_air_date||'').slice(0,4)||'—'; (creditsByYear[y]||(creditsByYear[y]=[])).push(c); });
      const years=Object.keys(creditsByYear).sort((a,b)=> b.localeCompare(a));
      creditsList.innerHTML = years.slice(0,12).map(y=>{ const items=creditsByYear[y].sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,6).map(c=>{ const title=c.title||c.name||'Untitled'; const role=c.character? `<span class=\"cr-role\">as ${c.character.split('/')[0].trim()}</span>`:''; return `<div class=\"cr-item\" data-type=\"${c.media_type}\" data-id=\"${c.id}\"><span class=\"cr-title\">${title}</span>${role}</div>`; }).join(''); return `<div class=\"cr-year\"><h4>${y}</h4><div class=\"cr-items\">${items}</div></div>`; }).join('');
      creditsList.querySelectorAll('.cr-item').forEach(it=> it.addEventListener('click',()=>{ const mt=it.getAttribute('data-type'); const id=it.getAttribute('data-id'); if(mt==='movie') window.location.href=`movie.html?id=${id}`; else if(mt==='tv') window.location.href=`tv.html?id=${id}`; }));
    }catch(err){ console.error('Person details failed', err); alert('Failed to load person details.'); }
  }
  function closePersonModal(){ const modal=document.getElementById('personDetailModal'); if(modal){ modal.classList.remove('open'); document.body.classList.remove('modal-open'); } }
  window.showPersonDetails=showPersonDetails; window.closePersonModal=closePersonModal;
})();

// Delegated click/keyboard handler for actor cards
(function(){
  document.addEventListener('click', e=>{ const card=e.target.closest('.actor-card[data-person-id]'); if(card && window.showPersonDetails){ showPersonDetails(card.dataset.personId); }});
  document.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const card=e.target.closest('.actor-card[data-person-id]'); if(card && window.showPersonDetails){ showPersonDetails(card.dataset.personId); }} });
})();
