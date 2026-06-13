const DOM = {
    searchInput: document.getElementById('movie-search'),
    autocompleteDropdown: document.getElementById('autocomplete-results'),
    loader: document.getElementById('loader'),
    resultsSection: document.getElementById('results-section'),
    moviesGrid: document.getElementById('movies-grid')
};

let debounceTimeout = null;

DOM.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimeout);
    
    if (!query) {
        DOM.autocompleteDropdown.classList.add('hidden');
        return;
    }

    debounceTimeout = setTimeout(() => {
        fetchAutocomplete(query);
    }, 400);
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

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        DOM.autocompleteDropdown.classList.add('hidden');
    }
});

// API Functions
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
        console.error("Autocomplete Error:", err);
    }
}

async function fetchFirstAndRecommend(query) {
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            fetchRecommendations(data.results[0]);
        } else {
            alert("No movies found for that search.");
        }
    } catch (err) {
        console.error("Search Error:", err);
    }
}

async function fetchRecommendations(movie) {
    DOM.autocompleteDropdown.classList.add('hidden');
    DOM.resultsSection.classList.add('hidden');
    DOM.loader.classList.remove('hidden');

    try {
        const res = await fetch(`/api/recommend/${encodeURIComponent(movie.title)}`);
        const data = await res.json();
        
        DOM.loader.classList.add('hidden');
        if (data.results) {
            // Also include the searched movie at the beginning
            renderMovies([movie, ...data.results]);
            DOM.resultsSection.classList.remove('hidden');
        }
    } catch (err) {
        DOM.loader.classList.add('hidden');
        alert("Error fetching recommendations.");
        console.error(err);
    }
}

// UI Renderers
function renderAutocomplete(movies) {
    DOM.autocompleteDropdown.innerHTML = '';
    
    movies.forEach(movie => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        
        const posterUrl = movie.poster_path || 'https://via.placeholder.com/45x65?text=No+Img';
        const year = movie.release_date && movie.release_date !== "N/A" ? movie.release_date.split('-')[0] : '';
        
        div.innerHTML = `
            <img src="${posterUrl}" alt="${movie.title}" class="autocomplete-poster" onerror="this.src='https://via.placeholder.com/45x65?text=No+Img'">
            <div class="autocomplete-info">
                <h4 style="font-size:1rem; margin-bottom:0.2rem">${movie.title}</h4>
                <p style="font-size:0.8rem; color:var(--text-muted)">${year} • ${movie.genres || 'Action'}</p>
            </div>
        `;
        
        div.addEventListener('click', () => {
            DOM.searchInput.value = movie.title;
            fetchRecommendations(movie);
        });
        
        DOM.autocompleteDropdown.appendChild(div);
    });
}

function renderMovies(movies) {
    DOM.moviesGrid.innerHTML = '';
    
    movies.forEach(movie => {
        const div = document.createElement('div');
        div.className = 'movie-card';
        
        const posterUrl = movie.poster_path || 'https://via.placeholder.com/500x750?text=No+Poster';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'NR';
        const genres = movie.genres || 'Sci-Fi | Adventure';
        
        div.innerHTML = `
            <div class="movie-poster-container">
                <img src="${posterUrl}" alt="${movie.title}" class="movie-poster" loading="lazy" onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'">
            </div>
            <div class="movie-info-header">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-rating"><i class="fas fa-star"></i> ${rating}</div>
            </div>
            <div class="movie-genres">${genres}</div>
            <div class="card-actions">
                <button class="card-btn"><i class="far fa-heart"></i> Watchlist</button>
                <button class="card-btn"><i class="fas fa-info-circle"></i> Info</button>
            </div>
        `;
        
        DOM.moviesGrid.appendChild(div);
    });
}

// Categories
const categoryLinks = document.querySelectorAll('.category-links li');
categoryLinks.forEach(link => {
    link.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.sidebar-section li').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const genre = link.textContent.trim();
        fetchCategory(genre);
    });
});

async function fetchCategory(genre) {
    DOM.autocompleteDropdown.classList.add('hidden');
    DOM.resultsSection.classList.add('hidden');
    DOM.loader.classList.remove('hidden');

    try {
        const res = await fetch(`/api/category/${encodeURIComponent(genre)}`);
        const data = await res.json();
        
        DOM.loader.classList.add('hidden');
        if (data.results && data.results.length > 0) {
            document.getElementById('search-query-display').textContent = genre + ' Movies';
            renderMovies(data.results);
            DOM.resultsSection.classList.remove('hidden');
        } else {
            alert(`No ${genre} movies found.`);
        }
    } catch (err) {
        DOM.loader.classList.add('hidden');
        alert("Error fetching category.");
        console.error(err);
    }
}
