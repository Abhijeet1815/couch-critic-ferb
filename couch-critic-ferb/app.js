// ========================
//  COUCH-CRITIC FERB APP
// ========================

// ---- State ----
let watchlist = JSON.parse(localStorage.getItem('ccf-watchlist') || '[]');
let categoriesPanelOpen = false;
let activePage = 'home';

const ALL_GENRES = [
    { name: 'Action',           icon: 'fas fa-meteor' },
    { name: 'Adventure',        icon: 'fas fa-map' },
    { name: 'Animation',        icon: 'fas fa-paint-brush' },
    { name: 'Comedy',           icon: 'fas fa-masks-theater' },
    { name: 'Crime',            icon: 'fas fa-user-secret' },
    { name: 'Documentary',      icon: 'fas fa-film' },
    { name: 'Drama',            icon: 'fas fa-theater-masks' },
    { name: 'Family',           icon: 'fas fa-house-user' },
    { name: 'Fantasy',          icon: 'fas fa-dragon' },
    { name: 'History',          icon: 'fas fa-landmark' },
    { name: 'Horror',           icon: 'fas fa-ghost' },
    { name: 'Music',            icon: 'fas fa-music' },
    { name: 'Mystery',          icon: 'fas fa-magnifying-glass' },
    { name: 'Romance',          icon: 'fas fa-heart' },
    { name: 'Science Fiction',  icon: 'fas fa-rocket' },
    { name: 'Thriller',         icon: 'fas fa-eye' },
    { name: 'War',              icon: 'fas fa-shield-halved' },
    { name: 'Western',          icon: 'fas fa-hat-cowboy' },
];

// ---- DOM ----
const DOM = {
    searchInput: document.getElementById('movie-search'),
    autocompleteDropdown: document.getElementById('autocomplete-results'),
    loader: document.getElementById('loader'),
    resultsSection: document.getElementById('results-section'),
    moviesGrid: document.getElementById('movies-grid'),
    resultsHeader: document.getElementById('results-header'),
    resultsLabel: document.getElementById('results-label'),
    watchlistGrid: document.getElementById('watchlist-grid'),
    watchlistEmpty: document.getElementById('watchlist-empty'),
    categoriesPanel: document.getElementById('categories-panel'),
    categoriesPanelGrid: document.getElementById('categories-panel-grid'),
};

// ========================
//   PAGE ROUTER
// ========================
function showPage(page) {
    // hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    // update topbar active link
    document.querySelectorAll('.topbar-nav a').forEach(a => a.classList.remove('active'));
    const navMap = { home: 'nav-home', watchlist: 'nav-watchlist', about: 'nav-about', discover: 'nav-home' };
    const navEl = document.getElementById(navMap[page]);
    if (navEl) navEl.classList.add('active');
    if (page === 'about') {
        document.getElementById('nav-about').classList.add('active');
        document.getElementById('nav-home').classList.remove('active');
    }

    // update sidebar active
    document.querySelectorAll('.sidebar-section li').forEach(l => l.classList.remove('active'));
    const sbMap = { home: 'sb-home', discover: 'sb-discover', watchlist: 'sb-watchlist' };
    const sbEl = document.getElementById(sbMap[page]);
    if (sbEl) sbEl.classList.add('active');

    // close categories panel on page switch
    closeCategoriesPanel();

    activePage = page;

    if (page === 'watchlist') renderWatchlist();
}

// ========================
//   CATEGORIES PANEL
// ========================
function buildCategoriesPanel() {
    DOM.categoriesPanelGrid.innerHTML = '';
    ALL_GENRES.forEach(g => {
        const btn = document.createElement('button');
        btn.className = 'cat-pill';
        btn.innerHTML = `<i class="${g.icon}"></i> ${g.name}`;
        btn.onclick = () => { filterCategory(g.name); };
        DOM.categoriesPanelGrid.appendChild(btn);
    });
}

function toggleCategoriesPanel() {
    if (categoriesPanelOpen) {
        closeCategoriesPanel();
    } else {
        DOM.categoriesPanel.classList.remove('hidden');
        categoriesPanelOpen = true;
    }
}

function closeCategoriesPanel() {
    DOM.categoriesPanel.classList.add('hidden');
    categoriesPanelOpen = false;
}

// Close categories panel on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.categories-panel') && !e.target.closest('#nav-categories')) {
        closeCategoriesPanel();
    }
    if (!e.target.closest('.search-container')) {
        DOM.autocompleteDropdown.classList.add('hidden');
    }
});

// ========================
//   CATEGORY FILTER
// ========================
function filterCategory(genre) {
    showPage('discover');
    closeCategoriesPanel();

    // highlight sidebar item
    document.querySelectorAll('.category-links li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.category-links li').forEach(l => {
        if (l.textContent.trim().toLowerCase().includes(genre.toLowerCase().split(' ')[0].toLowerCase())) {
            l.classList.add('active');
        }
    });

    fetchCategory(genre);
}

// ========================
//   SEARCH / AUTOCOMPLETE
// ========================
let debounceTimeout = null;

DOM.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);
    if (!query) { DOM.autocompleteDropdown.classList.add('hidden'); return; }
    debounceTimeout = setTimeout(() => fetchAutocomplete(query), 350);
});

DOM.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = DOM.searchInput.value.trim();
        if (query) {
            fetchFirstAndRecommend(query);
            DOM.autocompleteDropdown.classList.add('hidden');
        }
    }
});

async function fetchAutocomplete(query) {
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            renderAutocomplete(data.results);
            DOM.autocompleteDropdown.classList.remove('hidden');
        } else {
            DOM.autocompleteDropdown.classList.add('hidden');
        }
    } catch (err) {
        console.error('Autocomplete Error:', err);
    }
}

async function fetchFirstAndRecommend(query) {
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            fetchRecommendations(data.results[0]);
        } else {
            showToast('No movies found for that search.');
        }
    } catch (err) {
        console.error('Search Error:', err);
    }
}

async function fetchRecommendations(movie) {
    DOM.autocompleteDropdown.classList.add('hidden');
    showLoader();
    try {
        const res = await fetch(`/api/recommend/${encodeURIComponent(movie.title)}`);
        const data = await res.json();
        hideLoader();
        if (data.results) {
            DOM.resultsLabel.textContent = `Because you searched: ${movie.title}`;
            renderMovies([movie, ...data.results]);
        }
    } catch (err) {
        hideLoader();
        showToast('Error fetching recommendations.');
        console.error(err);
    }
}

// ========================
//   POPULAR / EXPLORE NOW
// ========================
async function loadPopular() {
    showPage('discover');
    showLoader();
    try {
        const res = await fetch('/api/popular');
        const data = await res.json();
        hideLoader();
        if (data.results && data.results.length > 0) {
            DOM.resultsLabel.textContent = 'Top Rated Movies';
            renderMovies(data.results);
        } else {
            showToast('Could not load popular movies.');
        }
    } catch (err) {
        hideLoader();
        showToast('Error loading movies.');
        console.error(err);
    }
}

// ========================
//   CATEGORY FETCH
// ========================
async function fetchCategory(genre) {
    showLoader();
    try {
        const res = await fetch(`/api/category/${encodeURIComponent(genre)}`);
        const data = await res.json();
        hideLoader();
        if (data.results && data.results.length > 0) {
            DOM.resultsLabel.textContent = `${genre} Movies`;
            renderMovies(data.results);
        } else {
            showToast(`No ${genre} movies found in the dataset.`);
        }
    } catch (err) {
        hideLoader();
        showToast('Error fetching category.');
        console.error(err);
    }
}

// ========================
//   LOADER HELPERS
// ========================
function showLoader() {
    DOM.loader.classList.remove('hidden');
    DOM.resultsSection.classList.add('hidden');
    DOM.resultsHeader.classList.add('hidden');
}

function hideLoader() {
    DOM.loader.classList.add('hidden');
}

// ========================
//   RENDER MOVIES
// ========================
function renderMovies(movieList) {
    DOM.moviesGrid.innerHTML = '';
    movieList.forEach(movie => {
        DOM.moviesGrid.appendChild(buildMovieCard(movie, toggleWatchlist));
    });
    DOM.resultsSection.classList.remove('hidden');
    DOM.resultsHeader.classList.remove('hidden');
}

function buildMovieCard(movie, onWatchlistToggle) {
    const saved = watchlist.some(m => m.id === movie.id);
    const div = document.createElement('div');
    div.className = 'movie-card';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
    const genres = movie.genres || '';
    const year = movie.release_date ? movie.release_date.split('-')[0] : '';
    const hasPoster = movie.poster_path && movie.poster_path.startsWith('http');

    div.innerHTML = `
        <div class="movie-poster-container" id="pc-${movie.id}">
            ${hasPoster
                ? `<img src="${movie.poster_path}" alt="${escHtml(movie.title)}" class="movie-poster"
                        data-container-id="pc-${movie.id}"
                        onload="onPosterLoad(this)" onerror="onPosterError(this)">`
                : `<div class="no-poster-label"><i class="fas fa-film"></i>${escHtml(movie.title)}</div>`
            }
        </div>
        <div class="movie-info-header">
            <div class="movie-title" title="${escHtml(movie.title)}">${escHtml(movie.title)}</div>
            <div class="movie-rating"><i class="fas fa-star"></i> ${rating}</div>
        </div>
        <div class="movie-genres">${escHtml(genres)}${year ? ' · ' + year : ''}</div>
        <div class="card-actions">
            <button class="card-btn watchlist-btn ${saved ? 'saved' : ''}" data-id="${movie.id}">
                <i class="${saved ? 'fas' : 'far'} fa-heart"></i> ${saved ? 'Saved' : 'Watchlist'}
            </button>
            <button class="card-btn similar-btn">
                <i class="fas fa-wand-magic-sparkles"></i> Similar
            </button>
        </div>
    `;

    div.querySelector('.watchlist-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onWatchlistToggle(movie, div.querySelector('.watchlist-btn'));
    });
    div.querySelector('.similar-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        fetchRecommendations(movie);
    });
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.card-btn')) fetchRecommendations(movie);
    });

    return div;
}

// Called by onload — stop shimmer, fade image in
function onPosterLoad(img) {
    img.classList.add('visible');
    const container = img.closest('.movie-poster-container');
    if (container) container.classList.add('loaded');
}

// Called by onerror — show fallback label
function onPosterError(img) {
    const container = img.closest('.movie-poster-container');
    if (!container) return;
    container.classList.add('loaded');
    img.remove();
    const label = document.createElement('div');
    label.className = 'no-poster-label';
    label.innerHTML = `<i class="fas fa-film"></i>${container.closest('.movie-card')?.querySelector('.movie-title')?.textContent || ''}`;
    container.appendChild(label);
}

// ========================
//   WATCHLIST
// ========================
function toggleWatchlist(movie, btn) {
    const idx = watchlist.findIndex(m => m.id === movie.id);
    if (idx === -1) {
        watchlist.push(movie);
        btn.classList.add('saved');
        btn.innerHTML = `<i class="fas fa-heart"></i> Saved`;
        showToast(`"${movie.title}" added to Watchlist!`);
    } else {
        watchlist.splice(idx, 1);
        btn.classList.remove('saved');
        btn.innerHTML = `<i class="far fa-heart"></i> Watchlist`;
        showToast(`"${movie.title}" removed.`);
    }
    localStorage.setItem('ccf-watchlist', JSON.stringify(watchlist));
    // if currently viewing watchlist, refresh it
    if (activePage === 'watchlist') renderWatchlist();
}

function renderWatchlist() {
    DOM.watchlistGrid.innerHTML = '';
    if (watchlist.length === 0) {
        DOM.watchlistEmpty.classList.remove('hidden');
        return;
    }
    DOM.watchlistEmpty.classList.add('hidden');
    watchlist.forEach(movie => {
        DOM.watchlistGrid.appendChild(buildMovieCard(movie, toggleWatchlist));
    });
}

// ========================
//   AUTOCOMPLETE RENDER
// ========================
function renderAutocomplete(movies) {
    DOM.autocompleteDropdown.innerHTML = '';
    movies.forEach(movie => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        const posterUrl = movie.poster_path || 'https://placehold.co/42x62/130a27/6d28d9?text=?';
        const year = movie.release_date && movie.release_date !== 'N/A' ? movie.release_date.split('-')[0] : '';
        div.innerHTML = `
            <img src="${posterUrl}" alt="${escHtml(movie.title)}" class="autocomplete-poster"
                 onerror="this.src='https://placehold.co/42x62/130a27/6d28d9?text=?'">
            <div class="autocomplete-info">
                <h4 style="font-size:0.95rem; margin-bottom:0.2rem">${escHtml(movie.title)}</h4>
                <p style="font-size:0.78rem; color:var(--text-muted)">${year}${year && movie.genres ? ' · ' : ''}${escHtml(movie.genres || '')}</p>
            </div>
        `;
        div.addEventListener('click', () => {
            DOM.searchInput.value = movie.title;
            fetchRecommendations(movie);
        });
        DOM.autocompleteDropdown.appendChild(div);
    });
}

// ========================
//   TOAST NOTIFICATION
// ========================
function showToast(msg) {
    let toast = document.getElementById('ccf-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ccf-toast';
        toast.style.cssText = `
            position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
            background: rgba(19,10,39,0.95); border: 1px solid rgba(157,78,221,0.5);
            color: white; padding: 0.9rem 1.5rem; border-radius: 12px;
            font-family: Outfit, sans-serif; font-size: 0.95rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); backdrop-filter: blur(10px);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ========================
//   UTILITIES
// ========================
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ========================
//   INIT
// ========================
buildCategoriesPanel();
showPage('home');
