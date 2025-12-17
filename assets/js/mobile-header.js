// Mobile header initial hide + reveal logic
(function(){
  const mq = window.matchMedia('(max-width: 768px)');
  if(!mq.matches) return; // only mobile
  const body = document.body;
  // Avoid re-init
  if(body.classList.contains('mh-initialized')) return;
  body.classList.add('mh-initialized','mobile-header-init');
  let revealed = false;
  function reveal(){
    if(revealed) return; revealed = true;
    body.classList.add('header-visible');
    body.classList.remove('mobile-header-init');
    window.removeEventListener('scroll', onScroll, {passive:true});
    window.removeEventListener('touchstart', onFirstInteraction, {passive:true});
    window.removeEventListener('click', onFirstInteraction, true);
  }
  function onScroll(){ if(window.scrollY > 10) reveal(); }
  function onFirstInteraction(){ reveal(); }
  // Fallback auto reveal after 3s if no interaction
  setTimeout(reveal, 3000);
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('touchstart', onFirstInteraction, {passive:true});
  window.addEventListener('click', onFirstInteraction, true);
})();
