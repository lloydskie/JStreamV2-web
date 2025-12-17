/* jstream Interactive Behavior */

document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  const header = document.querySelector('.site-header');
  const modal = document.querySelector('.modal');
  const modalContent = modal.querySelector('.modal-content');
  const searchInput = document.querySelector('#search');
  const movieRows = document.querySelector('.carousel-section');
  const hamburger = document.querySelector('.hamburger');

  let movies = [];
  let lastFocusedElement; // Track the last focused element

  // Fetch and Render Movies
  async function loadMovies() {
    try {
      const response = await fetch('data/movies.json');
      movies = await response.json();
      renderMovies();
      renderHero();
    } catch (error) {
      console.error('Failed to load movies:', error);
    }
  }

  function renderMovies() {
    movieRows.innerHTML = '';
    movies.forEach((row, index) => {
      const rowElement = document.createElement('div');
      rowElement.className = 'carousel-row';
      rowElement.setAttribute('tabindex', '0');
      row.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
          <img src="low-res-placeholder.jpg" data-src="${movie.poster}" alt="${movie.title}" />
          <div class="movie-title">${movie.title}</div>
          <button class="play-button" data-movie-id="${movie.id}">Play</button>
        `;
        card.querySelector('.play-button').addEventListener('click', () => onCardPlayClick(movie));
        rowElement.appendChild(card);
      });
      movieRows.appendChild(rowElement);
    });
    setupLazyLoading();
  }

  // Add Metadata Chips
  function renderHero() {
    const featured = movies.find(movie => movie.featured) || movies[0];
    hero.style.backgroundImage = `url(${featured.poster})`;
    hero.querySelector('.hero-title').textContent = featured.title;
    hero.querySelector('.hero-meta').textContent = featured.description;
    hero.querySelector('.hero-metadata').innerHTML = `
      <span class="chip">${featured.year}</span>
      <span class="chip">${featured.duration}</span>
      <span class="chip">${featured.rating}</span>
    `;
  }

  // Carousel Behavior
  function setupCarousel() {
    document.querySelectorAll('.carousel-row').forEach(row => {
      const chevronLeft = row.previousElementSibling;
      const chevronRight = row.nextElementSibling;

      chevronLeft.addEventListener('click', () => {
        row.scrollBy({ left: -row.clientWidth * 0.9, behavior: 'smooth' });
      });

      chevronRight.addEventListener('click', () => {
        row.scrollBy({ left: row.clientWidth * 0.9, behavior: 'smooth' });
      });

      row.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          row.scrollBy({ left: -row.clientWidth * 0.9, behavior: 'smooth' });
        } else if (e.key === 'ArrowRight') {
          row.scrollBy({ left: row.clientWidth * 0.9, behavior: 'smooth' });
        } else if (e.key === 'Enter') {
          const focusedCard = document.activeElement;
          if (focusedCard.classList.contains('movie-card')) {
            const movie = movies.find(m => m.title === focusedCard.querySelector('.movie-title').textContent);
            openModal(movie);
          }
        }
      });
    });
  }

  // Lazy Load with Blur Placeholder
  function setupLazyLoading() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src; // Swap to full resolution
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.blur; // Use blur placeholder initially
      observer.observe(img);
    });
  }

  // Hero Parallax
  function setupParallax() {
    window.addEventListener('scroll', throttle(() => {
      const scrollY = window.scrollY;
      hero.style.transform = `translateY(${scrollY * 0.5}px)`;
      if (scrollY > hero.offsetHeight) {
        header.classList.add('header--hidden');
      } else {
        header.classList.remove('header--hidden');
      }
    }, 100));
  }

  // Modal Logic
  function openModal(movie) {
    lastFocusedElement = document.activeElement; // Record the last focused element
    modalContent.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}" />
      <div class="modal-body">
        <h2>${movie.title}</h2>
        <p>${movie.description}</p>
      </div>
    `;
    modal.setAttribute('open', '');
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-live', 'polite'); // Announce modal content
    trapFocus(modal);
  }

  // Trap Focus in Modal
  function trapFocus(element) {
    const focusableElements = element.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }

  function closeModal() {
    modal.removeAttribute('open');
    modal.setAttribute('aria-hidden', 'true');
    modalContent.innerHTML = '';
    lastFocusedElement.focus(); // Return focus to the last focused element
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Search
  function setupSearch() {
    let timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const query = searchInput.value.toLowerCase();
        const results = movies.filter(movie => movie.title.toLowerCase().includes(query));
        renderMovies(results);
      }, 200);
    });
  }

  // Mini-Preview Card with Autoplaying Trailer
  function setupMiniPreview(card, movie) {
    let previewTimeout;
    card.addEventListener('mouseenter', () => {
      previewTimeout = setTimeout(() => {
        card.classList.add('preview');
        if (movie.trailer) {
          card.innerHTML += `
            <video class="preview-trailer" autoplay muted loop>
              <source src="${movie.trailer}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          `;
        } else {
          card.innerHTML += `
            <div class="preview-content">
              <p>${movie.synopsis}</p>
              <button class="primary">Play</button>
              <button class="secondary">Details</button>
            </div>
          `;
        }
      }, 600);
    });

    card.addEventListener('mouseleave', () => {
      clearTimeout(previewTimeout);
      card.classList.remove('preview');
      const trailer = card.querySelector('.preview-trailer');
      const content = card.querySelector('.preview-content');
      if (trailer) trailer.remove();
      if (content) content.remove();
    });
  }

  // Play Button Ripple and Fake Player
  function setupPlayButton() {
    document.body.addEventListener('click', (e) => {
      if (e.target.classList.contains('play-button')) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        e.target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 300);

        const fakePlayer = document.createElement('div');
        fakePlayer.className = 'fake-player';
        fakePlayer.innerHTML = `
          <img src="${e.target.dataset.poster}" alt="Playing Movie" />
          <div class="playbar"></div>
        `;
        document.body.appendChild(fakePlayer);
        setTimeout(() => fakePlayer.remove(), 1000);
      }
    });
  }

  // Mobile Header Toggle
  hamburger.addEventListener('click', () => {
    header.classList.toggle('nav-open');
  });

  // Swipe-to-Close Modal
  function setupSwipeToClose() {
    let startY;
    modal.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });
    modal.addEventListener('touchmove', (e) => {
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 50) {
        closeModal();
      }
    });
  }

  // Offline Fallback
  function setupOfflineFallback() {
    document.querySelectorAll('img').forEach(img => {
      img.onerror = () => {
        img.classList.add('offline-fallback');
      };
    });
  }

  // Settings Panel Logic
  function setupSettingsPanel() {
    const toggleMotion = document.getElementById('toggle-motion');
    const toggleView = document.getElementById('toggle-view');

    // Load settings from localStorage
    const settings = JSON.parse(localStorage.getItem('settings')) || {};
    if (settings.reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
      toggleMotion.checked = true;
    }
    if (settings.gridView) {
      document.documentElement.classList.add('grid-view');
      toggleView.checked = true;
    }

    // Toggle reduced motion
    toggleMotion.addEventListener('change', () => {
      if (toggleMotion.checked) {
        document.documentElement.classList.add('reduce-motion');
        settings.reduceMotion = true;
      } else {
        document.documentElement.classList.remove('reduce-motion');
        settings.reduceMotion = false;
      }
      localStorage.setItem('settings', JSON.stringify(settings));
    });

    // Toggle grid/list view
    toggleView.addEventListener('change', () => {
      if (toggleView.checked) {
        document.documentElement.classList.add('grid-view');
        settings.gridView = true;
      } else {
        document.documentElement.classList.remove('grid-view');
        settings.gridView = false;
      }
      localStorage.setItem('settings', JSON.stringify(settings));
    });
  }

  // ===== jstream third-party player integration =====

  // Storage key prefix
  const PLAYER_PROGRESS_KEY = 'jstream:player:progress:'; // + content id

  // Build iframe URL for movie or TV
  function buildPlayerUrl({ tmdbId, mediaType = 'movie', season, episode, color, autoPlay = false, nextEpisode = false, episodeSelector = false, progressSeconds } = {}) {
    if (!tmdbId) throw new Error('tmdbId required to build player URL');

    // base path
    let base;
    if (mediaType === 'tv') {
      // require season and episode fallback to 1
      season = season || 1;
      episode = episode || 1;
      base = `https://www.vidking.net/embed/tv/${encodeURIComponent(tmdbId)}/${season}/${episode}`;
    } else {
      base = `https://www.vidking.net/embed/movie/${encodeURIComponent(tmdbId)}`;
    }

    // build query string from options
    const params = new URLSearchParams();
    if (color) params.set('color', color.replace('#', ''));
    if (autoPlay) params.set('autoPlay', 'true');
    if (nextEpisode && mediaType === 'tv') params.set('nextEpisode', 'true');
    if (episodeSelector && mediaType === 'tv') params.set('episodeSelector', 'true');
    if (typeof progressSeconds === 'number' && !Number.isNaN(progressSeconds)) params.set('progress', Math.floor(progressSeconds));

    const url = params.toString() ? `${base}?${params.toString()}` : base;
    return url;
  }

  // Save progress object to localStorage
  function saveProgressToStorage(contentId, progressObj) {
    try {
      const progressKey = `jstream:player:progress:${contentId}`;
      localStorage.setItem(progressKey, JSON.stringify(progressObj));
    } catch (e) {
      console.warn('Could not save progress', e);
    }
  }

  // Get saved progress object from localStorage or null
  function getProgressFromStorage(contentId) {
    try {
      const progressKey = `jstream:player:progress:${contentId}`;
      const raw = localStorage.getItem(progressKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Open the player modal for a given movie/tv item
  // options: { tmdbId, mediaType, id: your content id, season, episode, color, autoPlay, nextEpisode, episodeSelector }
  function openPlayerModal(options = {}) {
    const modal = document.getElementById('playerModal');
    const iframe = document.getElementById('jstreamPlayer');
    const titleEl = document.getElementById('playerTitle');
    const metaEl = document.getElementById('playerMeta');
    const resumePrompt = document.getElementById('resumePrompt');
    const resumeText = document.getElementById('resumeText');
    const resumeContinue = document.getElementById('resumeContinue');
    const resumeRestart = document.getElementById('resumeRestart');

    if (!modal || !iframe) {
      console.error('Player modal or iframe missing in DOM');
      return;
    }

    // Set metadata in header
    titleEl.textContent = options.title || 'Playing';
    metaEl.textContent = `${options.mediaType || 'movie'} • ${options.year || ''}`;

    // check stored progress by your content id (use options.id as unique key)
    const saved = options.id ? getProgressFromStorage(options.id) : null;

    // If we have saved progress > 5% and less than 99%, ask whether to resume.
    const hasResume = saved && typeof saved.currentTime === 'number' && typeof saved.duration === 'number' && saved.duration > 10 && (saved.progress || 0) > 1 && (saved.progress || 0) < 99;

    // set aria states & show modal
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    // trap focus etc — reuse your modal focus-trap routines if you have them
    // if you do not have a trap, implement minimal focus management here

    if (hasResume) {
      // show resume prompt
      resumePrompt.hidden = false;
      const mins = Math.floor(saved.currentTime / 60);
      const secs = Math.floor(saved.currentTime % 60).toString().padStart(2, '0');
      resumeText.textContent = `Resume from ${mins}:${secs}? (watched ${(saved.progress || 0).toFixed(1)}%)`;
      // Continue -> load iframe with progress param (seconds)
      resumeContinue.onclick = () => {
        resumePrompt.hidden = true;
        loadPlayerIframeWithProgress(options, saved.currentTime);
      };
      // Restart -> load iframe without progress param (or with 0)
      resumeRestart.onclick = () => {
        resumePrompt.hidden = true;
        loadPlayerIframeWithProgress(options, 0);
        // optionally clear saved progress
        // localStorage.removeItem(PLAYER_PROGRESS_KEY + options.id);
      };
    } else {
      resumePrompt.hidden = true;
      loadPlayerIframeWithProgress(options, options.startAt || 0);
    }

    // close binding
    document.getElementById('playerClose').onclick = closePlayerModal;
    // ESC handling
    const escHandler = (e) => { if (e.key === 'Escape') closePlayerModal(); };
    document.addEventListener('keydown', escHandler);

    // ensure cleanup when closed
    modal.dataset._escHandler = escHandler;
  }

  // Function to load player iframe with progress
  function loadPlayerIframeWithProgress(options, currentTime) {
    const progressParam = currentTime ? `progress=${Math.floor(currentTime)}` : '';
    const autoPlayParam = options.autoPlay ? 'autoPlay=true' : '';
    const params = [progressParam, autoPlayParam].filter(Boolean).join('&');
    const queryString = params ? `?${params}` : '';
    
    const mediaPath = options.mediaType === 'tv' ? 'tv' : 'movie';
    let iframeSrc = `https://www.vidking.net/embed/${mediaPath}/${options.tmdbId}${queryString}`;
    
    // For TV shows, add season and episode if provided
    if (options.mediaType === 'tv' && options.season && options.episode) {
      iframeSrc += `&season=${options.season}&episode=${options.episode}`;
    }

    const iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
    iframe.className = 'player-iframe';
    iframe.title = `jstream player — ${options.title || ''}`;

    const playerContainer = document.querySelector('.player-container');
    playerContainer.innerHTML = ''; // Clear previous content
    playerContainer.appendChild(iframe);
  }

  // Function to load player iframe with accessibility features
  function loadPlayerIframeWithAccessibility(options, currentTime) {
    const progressParam = currentTime ? `progress=${Math.floor(currentTime)}` : '';
    const autoPlayParam = options.autoPlay ? 'autoPlay=true' : '';
    const params = [progressParam, autoPlayParam].filter(Boolean).join('&');
    const queryString = params ? `?${params}` : '';
    
    const mediaPath = options.mediaType === 'tv' ? 'tv' : 'movie';
    let iframeSrc = `https://www.vidking.net/embed/${mediaPath}/${options.tmdbId}${queryString}`;
    
    // For TV shows, add season and episode if provided
    if (options.mediaType === 'tv' && options.season && options.episode) {
      iframeSrc += `&season=${options.season}&episode=${options.episode}`;
    }

    const iframe = document.createElement('iframe');
    iframe.src = iframeSrc;
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
    iframe.className = 'player-iframe';
    iframe.title = `jstream player — ${options.title || ''}`;

    const playerContainer = document.querySelector('.player-container');
    playerContainer.innerHTML = ''; // Clear previous content
    playerContainer.appendChild(iframe);

    // Set modal accessibility attributes
    const modal = document.querySelector('.player-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Focus management
    const closeButton = modal.querySelector('.player-close');
    closeButton.focus();

    // Restore focus to the original Play button on modal close
    closeButton.addEventListener('click', () => {
      const lastFocusedElement = document.activeElement;
      modal.style.display = 'none';
      if (lastFocusedElement) {
        lastFocusedElement.focus();
      }
    });
  }

  // Close modal and cleanup
  function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    const iframe = document.getElementById('jstreamPlayer');

    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('open');

    if (iframe) {
      // optional: clear src to stop playback and free resources
      iframe.src = 'about:blank';
      iframe.removeAttribute('data-content-id');
    }

    // remove esc handler if we saved it
    const escHandler = modal.dataset._escHandler;
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      delete modal.dataset._escHandler;
    }
  }

  // Listen for messages from the iframe player
  window.addEventListener('message', function(event) {
    // Some providers wrap message in a string; try to parse safely
    let payload = null;
    try {
      if (typeof event.data === 'string') {
        payload = JSON.parse(event.data);
      } else {
        payload = event.data;
      }
    } catch (e) {
      // not JSON — ignore
      return;
    }

    if (!payload || payload.type !== 'PLAYER_EVENT' || !payload.data) return;

    const data = payload.data;
    // Example data contains: event, currentTime, duration, progress, id (tmdbId), mediaType, season, episode, timestamp
    // We'll map storage key to your content id if you passed one; if not, use tmdbId
    // Try to find contentId from iframe dataset if possible
    // But payload.id is the content id per docs (likely tmdb id)
    const contentId = data.id || null;
    if (!contentId) return;

    // Build a saved object
    const saved = {
      event: data.event,
      currentTime: data.currentTime,
      duration: data.duration,
      progress: data.progress, // percent
      timestamp: data.timestamp || Date.now(),
      mediaType: data.mediaType,
      season: data.season,
      episode: data.episode
    };

    // Persist
    saveProgressToStorage(contentId, saved);

    // Optionally update an on-screen progress UI (if you have one)
    // Example: update an aria-live region that shows progress
    const messageArea = document.getElementById('messageArea');
    if (messageArea) {
      messageArea.innerText = `Saved ${Math.round(saved.progress)}% for ${contentId}`;
    }
  });

  // Debounced progress saving to reduce localStorage writes
  let progressSaveTimeout;
  let lastSavedProgress = {};

  function debouncedSaveProgress(movieId, currentTime, duration) {
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    // Only save if progress increased by at least 1% or 5 seconds have passed
    const lastProgress = lastSavedProgress[movieId] || 0;
    const significantChange = Math.abs(progressPercent - lastProgress) >= 1;
    
    if (significantChange) {
      clearTimeout(progressSaveTimeout);
      progressSaveTimeout = setTimeout(() => {
        const progressKey = `jstream:player:progress:${movieId}`;
        const progressData = {
          currentTime: currentTime,
          duration: duration,
          progress: progressPercent,
          timestamp: Date.now()
        };
        localStorage.setItem(progressKey, JSON.stringify(progressData));
        lastSavedProgress[movieId] = progressPercent;
      }, 2000); // Debounce by 2 seconds
    }
  }

  // Event listener for postMessage with origin check
  window.addEventListener('message', (event) => {
    // Verify the origin of the message
    if (event.origin !== 'https://www.vidking.net') return;

    try {
      const data = JSON.parse(event.data);

      if (data.type === 'progressUpdate' && data.currentTime) {
        // Use debounced save to reduce localStorage writes
        const movieId = data.tmdbId || data.id;
        const duration = data.duration || 0;
        debouncedSaveProgress(movieId, data.currentTime, duration);
      }
    } catch (error) {
      console.error('Failed to parse message data:', error);
    }
  });

  // Integration patch: Event listener for Play buttons
  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-play-tmdb]');
    if (!playBtn) return;

    const tmdb = playBtn.dataset.playTmdb;
    const mediaType = playBtn.dataset.mediaType || 'movie';
    const title = playBtn.dataset.title || '';

    // Open player modal with options
    openPlayerModal({
      id: tmdb,
      tmdbId: tmdb,
      mediaType,
      title,
      autoPlay: true,
      episodeSelector: true,
      nextEpisode: true
    });
  });

  // Utilities
  function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function () {
      const context = this;
      const args = arguments;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(function () {
          if ((Date.now() - lastRan) >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  }

  // Example click handler when user clicks Play on a card
  // movieObj is the JSON object from data/movies.json
  function onCardPlayClick(movieObj) {
    // build options object from movieObj
    const opts = {
      id: movieObj.tmdbId || movieObj.id, // unique key for localStorage (prefer tmdbId if compatibility)
      tmdbId: movieObj.tmdbId,
      mediaType: movieObj.mediaType || 'movie',
      title: movieObj.title,
      year: movieObj.year,
      season: movieObj.defaultSeason, // for TV
      episode: movieObj.defaultEpisode, // for TV
      color: null, // let code derive from --accent or pass a hex string without '#'
      autoPlay: true,
      nextEpisode: true,
      episodeSelector: true
    };
    openPlayerModal(opts);
  }

  // Update Play button handlers
  function setupPlayButtons() {
    document.querySelectorAll('.play-button').forEach(button => {
      button.addEventListener('click', () => {
        const movieId = button.dataset.movieId;
        const movieObj = movies.find(movie => movie.id === movieId);
        if (movieObj) {
          onCardPlayClick(movieObj);
        }
      });
    });
  }

  // Function to show resume prompt if applicable
  function showResumePromptIfApplicable(movieObj, savedProgress) {
    if (savedProgress && savedProgress > 0.01 && savedProgress < 0.99) {
      const resumePrompt = document.createElement('div');
      resumePrompt.className = 'resume-prompt';
      resumePrompt.innerHTML = `
        <p>Resume watching <strong>${movieObj.title}</strong>?</p>
        <button class="resume-button">Resume</button>
        <button class="start-over-button">Start Over</button>
      `;

      resumePrompt.querySelector('.resume-button').addEventListener('click', () => {
        loadPlayerIframeWithProgress(movieObj, savedProgress * movieObj.duration);
      });

      resumePrompt.querySelector('.start-over-button').addEventListener('click', () => {
        loadPlayerIframeWithProgress(movieObj, 0);
      });

      const playerContainer = document.querySelector('.player-container');
      playerContainer.innerHTML = ''; // Clear previous content
      playerContainer.appendChild(resumePrompt);
    }
  }

  // Initialize
  loadMovies();
  setupCarousel();
  setupParallax();
  setupSearch();
  setupPlayButton();
  setupSwipeToClose();
  setupOfflineFallback();
  setupSettingsPanel();
  setupPlayButtons();
});
