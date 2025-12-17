/**
 * Player Utility for JStream
 * Handles Vidking player integration and progress tracking
 */

// Vidking Player Embed Functions
function embedMovie(tmdbId, options = {}) {
    const base = `https://www.vidking.net/embed/movie/${tmdbId}`;
    const params = new URLSearchParams(options).toString();
    return `${base}${params ? "?" + params : ""}`;
}

function embedTv(tmdbId, season, episode, options = {}) {
    const base = `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}`;
    const params = new URLSearchParams(options).toString();
    return `${base}${params ? "?" + params : ""}`;
}

class JStreamPlayer {
    constructor() {
        this.progressSaveTimeout = null;
        this.lastSavedProgress = {};
        this.currentContent = null;
        this.modal = null;
        this.iframe = null;
        this.init();
    }

    init() {
        this.modal = document.getElementById('playerModal');
        this.setupEventListeners();
        this.setupPostMessageHandler();
    }

    setupEventListeners() {
        // Close button
        const closeBtn = document.getElementById('playerClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePlayer());
        }

        // Resume buttons
        const resumeContinue = document.getElementById('resumeContinue');
        const resumeRestart = document.getElementById('resumeRestart');
        
        if (resumeContinue) {
            resumeContinue.addEventListener('click', () => this.handleResumeContinue());
        }
        
        if (resumeRestart) {
            resumeRestart.addEventListener('click', () => this.handleResumeRestart());
        }

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isPlayerOpen()) {
                this.closePlayer();
            }
        });

        // Click outside to close
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closePlayer();
                }
            });
        }
    }

    setupPostMessageHandler() {
        window.addEventListener('message', (event) => {
            // Verify origin for security
            if (event.origin !== 'https://www.vidking.net') return;

            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'progressUpdate' && data.currentTime) {
                    this.handleProgressUpdate(data);
                }
            } catch (error) {
                console.error('Failed to parse player message:', error);
            }
        });
    }

    // Open player modal with content
    openPlayer(options = {}) {
        this.currentContent = options;
        
        // Update modal title and meta
        this.updatePlayerUI(options);
        
        // Check for saved progress
        const savedProgress = this.getSavedProgress(options.id || options.tmdbId);
        
        // Show resume prompt if applicable
        if (this.shouldShowResumePrompt(savedProgress)) {
            this.showResumePrompt(savedProgress);
        } else {
            this.loadPlayerIframe(options, savedProgress?.currentTime || 0);
        }
        
        // Show modal
        this.showModal();
    }

    updatePlayerUI(options) {
        const titleEl = document.getElementById('playerTitle');
        const metaEl = document.getElementById('playerMeta');
        
        if (titleEl) {
            titleEl.textContent = options.title || 'Unknown Title';
        }
        
        if (metaEl) {
            let metaText = options.mediaType === 'tv' ? 'TV Show' : 'Movie';
            if (options.year) metaText += ` • ${options.year}`;
            if (options.season && options.episode) {
                metaText += ` • S${options.season} E${options.episode}`;
            }
            metaEl.textContent = metaText;
        }
    }

    shouldShowResumePrompt(savedProgress) {
        if (!savedProgress || !savedProgress.progress) return false;
        
        const progress = savedProgress.progress;
        return progress > 1 && progress < 95; // Between 1% and 95%
    }

    showResumePrompt(savedProgress) {
        const resumePrompt = document.getElementById('resumePrompt');
        const resumeText = document.getElementById('resumeText');
        const iframeContainer = document.getElementById('iframeContainer');
        
        if (resumePrompt && resumeText) {
            const progressPercent = Math.round(savedProgress.progress);
            const timeString = this.formatTime(savedProgress.currentTime);
            
            resumeText.textContent = `Continue watching from ${timeString} (${progressPercent}%)?`;
            resumePrompt.hidden = false;
        }
        
        if (iframeContainer) {
            iframeContainer.innerHTML = '';
        }
    }

    hideResumePrompt() {
        const resumePrompt = document.getElementById('resumePrompt');
        if (resumePrompt) {
            resumePrompt.hidden = true;
        }
    }

    handleResumeContinue() {
        this.hideResumePrompt();
        const savedProgress = this.getSavedProgress(this.currentContent.id || this.currentContent.tmdbId);
        this.loadPlayerIframe(this.currentContent, savedProgress?.currentTime || 0);
    }

    handleResumeRestart() {
        this.hideResumePrompt();
        this.loadPlayerIframe(this.currentContent, 0);
        // Optionally clear saved progress
        // this.clearSavedProgress(this.currentContent.id || this.currentContent.tmdbId);
    }

    loadPlayerIframe(options, startTime = 0) {
        const iframeContainer = document.getElementById('iframeContainer');
        if (!iframeContainer) return;

        // Build embed options
        const embedOptions = {};
        
        if (startTime > 0) {
            embedOptions.progress = Math.floor(startTime);
        }
        
        if (options.autoPlay !== false) {
            embedOptions.autoPlay = true;
        }
        
        if (options.color) {
            embedOptions.color = options.color.replace('#', '');
        }
        
        // Generate iframe source URL
        let iframeSrc;
        const tmdbId = options.tmdbId || options.id;
        
        if (options.mediaType === 'tv' && options.season && options.episode) {
            iframeSrc = embedTv(tmdbId, options.season, options.episode, embedOptions);
        } else {
            iframeSrc = embedMovie(tmdbId, embedOptions);
        }

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.src = iframeSrc;
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
        iframe.className = 'player-iframe';
        iframe.title = `JStream player — ${options.title || ''}`;
        
        // Store reference
        this.iframe = iframe;
        
        // Clear container and add iframe
        iframeContainer.innerHTML = '';
        iframeContainer.appendChild(iframe);
    }

    showModal() {
        if (!this.modal) return;
        
        this.modal.setAttribute('aria-hidden', 'false');
        this.modal.style.display = 'flex';
        
        // Focus management
        const closeBtn = document.getElementById('playerClose');
        if (closeBtn) {
            closeBtn.focus();
        }
        
        // Disable body scroll
        document.body.style.overflow = 'hidden';
    }

    closePlayer() {
        if (!this.modal) return;
        
        this.modal.setAttribute('aria-hidden', 'true');
        this.modal.style.display = 'none';
        
        // Clear iframe
        const iframeContainer = document.getElementById('iframeContainer');
        if (iframeContainer) {
            iframeContainer.innerHTML = '';
        }
        
        // Hide resume prompt
        this.hideResumePrompt();
        
        // Clear references
        this.iframe = null;
        this.currentContent = null;
        
        // Re-enable body scroll
        document.body.style.overflow = '';
    }

    isPlayerOpen() {
        return this.modal && this.modal.style.display !== 'none';
    }

    // Progress tracking - Step 9 Enhanced
    handleProgressUpdate(data) {
        if (!this.currentContent) return;
        
        const contentId = this.getContentId();
        const currentTime = data.currentTime;
        const duration = data.duration || 0;
        
        // Save detailed progress data
        const progressData = {
            ...this.currentContent,
            currentTime,
            duration,
            progress: duration > 0 ? (currentTime / duration) * 100 : 0,
            timestamp: Date.now(),
            lastWatched: new Date().toISOString()
        };
        
        this.debouncedSaveProgress(contentId, progressData);
    }

    debouncedSaveProgress(contentId, progressData) {
        // Only save if progress increased by at least 1% or is a significant change
        const lastProgress = this.lastSavedProgress[contentId] || 0;
        const currentProgress = progressData.progress;
        const significantChange = Math.abs(currentProgress - lastProgress) >= 1;
        
        if (significantChange) {
            clearTimeout(this.progressSaveTimeout);
            this.progressSaveTimeout = setTimeout(() => {
                this.saveProgress(contentId, progressData);
                this.lastSavedProgress[contentId] = currentProgress;
                
                // Also update continue watching list
                this.updateContinueWatching(progressData);
            }, 2000); // Debounce by 2 seconds
        }
    }

    saveProgress(contentId, progressData) {
        try {
            const key = `jstream:progress:${contentId}`;
            localStorage.setItem(key, JSON.stringify(progressData));
            
            // Also save to continue watching if progress is meaningful
            if (progressData.progress > 1 && progressData.progress < 95) {
                this.addToContinueWatching(progressData);
            }
        } catch (error) {
            console.warn('Failed to save progress:', error);
        }
    }

    // Continue Watching functionality - Step 9
    addToContinueWatching(progressData) {
        try {
            const continueWatching = this.getContinueWatchingList();
            const contentId = this.getContentId();
            
            // Remove existing entry if it exists
            const filtered = continueWatching.filter(item => 
                this.getContentId(item) !== contentId
            );
            
            // Add new entry at the beginning
            filtered.unshift({
                id: progressData.id || progressData.tmdbId,
                title: progressData.title,
                mediaType: progressData.mediaType,
                season: progressData.season,
                episode: progressData.episode,
                currentTime: progressData.currentTime,
                duration: progressData.duration,
                progress: progressData.progress,
                timestamp: progressData.timestamp,
                lastWatched: progressData.lastWatched,
                posterPath: progressData.posterPath,
                backdropPath: progressData.backdropPath
            });
            
            // Keep only the most recent 20 items
            const trimmed = filtered.slice(0, 20);
            
            localStorage.setItem('jstream:continueWatching', JSON.stringify(trimmed));
        } catch (error) {
            console.warn('Failed to update continue watching:', error);
        }
    }

    getContinueWatchingList() {
        try {
            const data = localStorage.getItem('jstream:continueWatching');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.warn('Failed to get continue watching list:', error);
            return [];
        }
    }

    removeContinueWatching(contentId) {
        try {
            const continueWatching = this.getContinueWatchingList();
            const filtered = continueWatching.filter(item => 
                this.getContentId(item) !== contentId
            );
            localStorage.setItem('jstream:continueWatching', JSON.stringify(filtered));
        } catch (error) {
            console.warn('Failed to remove from continue watching:', error);
        }
    }

    getContentId(content = null) {
        const item = content || this.currentContent;
        if (!item) return null;
        
        const id = item.id || item.tmdbId;
        if (item.mediaType === 'tv' && item.season && item.episode) {
            return `${item.mediaType}-${id}-s${item.season}e${item.episode}`;
        }
        return `${item.mediaType || 'movie'}-${id}`;
    }

    updateContinueWatching(progressData) {
        // Trigger custom event for UI updates
        const event = new CustomEvent('continueWatchingUpdated', {
            detail: { progressData }
        });
        document.dispatchEvent(event);
    }

    getSavedProgress(contentId) {
        try {
            // Use the same key format as saveProgress
            const key = `jstream:progress:${contentId}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Failed to retrieve progress:', error);
            return null;
        }
    }

    clearSavedProgress(contentId) {
        try {
            const key = `jstream:progress:${contentId}`;
            localStorage.removeItem(key);
            delete this.lastSavedProgress[contentId];
            
            // Also remove from continue watching
            this.removeContinueWatching(contentId);
        } catch (error) {
            console.warn('Failed to clear progress:', error);
        }
    }

    // Utility methods
    formatTime(seconds) {
        if (!seconds || seconds < 0) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
}

// Create global player instance
window.jstreamPlayer = new JStreamPlayer();

// Convenience function for opening player
window.openPlayerModal = function(options) {
    window.jstreamPlayer.openPlayer(options);
};

// Direct iframe embedding functions (global access)
window.embedMovie = embedMovie;
window.embedTv = embedTv;

// Example usage helper
window.setPlayerSource = function(elementId, tmdbId, options = {}) {
    const iframe = document.getElementById(elementId);
    if (iframe) {
        iframe.src = embedMovie(tmdbId, options);
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        JStreamPlayer, 
        embedMovie, 
        embedTv 
    };
}
