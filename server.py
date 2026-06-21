import asyncio
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pickle
import pandas as pd
import os
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("TMDB_API_KEY", "")

# ── Global state ──────────────────────────────────────────────────────────────
movies      = None
similarity  = None
metadata_df = None

# In-memory poster lookup: {movie_id (int) -> "https://..." or ""}
poster_cache: dict[int, str] = {}

POSTER_CACHE_FILE = "models/poster_cache.json"


# ── Startup ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global movies, similarity, metadata_df

    # 1. Load ML models (blocking — must finish before requests are served)
    try:
        movies_dict = pickle.load(open('models/movies_dict.pkl', 'rb'))
        movies      = pd.DataFrame(movies_dict)
        similarity  = pickle.load(open('models/similarity.pkl', 'rb'))
        metadata_df = pd.read_csv('data/tmdb_5000_movies.csv')
        print(f"✅ Models loaded — {len(movies)} movies")
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        raise

    # 2. Load poster cache from local JSON (instant — no network call)
    if os.path.exists(POSTER_CACHE_FILE):
        try:
            with open(POSTER_CACHE_FILE) as f:
                raw = json.load(f)
            for mid, url in raw.items():
                poster_cache[int(mid)] = url
            hits = sum(1 for v in poster_cache.values() if v)
            print(f"✅ Poster cache loaded: {hits}/{len(poster_cache)} posters ready")
        except Exception as e:
            print(f"⚠️  Could not read poster cache: {e}")
    else:
        print("⚠️  No poster cache found. Run: python3 build_poster_cache.py")

    yield  # server is live here


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_poster(movie_id: int) -> str:
    """Instant O(1) lookup — no network, no I/O."""
    return poster_cache.get(movie_id, "")


def get_movie_metadata(movie_id: int):
    try:
        row         = metadata_df[metadata_df['id'] == movie_id].iloc[0]
        genres_data = json.loads(row['genres'])
        genres_str  = " | ".join([g['name'] for g in genres_data[:2]]) if genres_data else ""
        vote_avg    = float(row['vote_average'])
        release     = str(row['release_date'])
        return genres_str, vote_avg, release
    except Exception:
        return "", 0.0, ""


def movie_to_dict(movie_id: int, title: str) -> dict:
    genres, vote, release = get_movie_metadata(movie_id)
    return {
        "id":           movie_id,
        "title":        title,
        "poster_path":  get_poster(movie_id),   # ← instant cache lookup
        "release_date": release,
        "vote_average": vote,
        "genres":       genres,
    }


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/api/search")
async def search(q: str):
    q_lower    = q.lower()
    results_df = movies[movies['title'].str.lower().str.contains(q_lower, na=False)].head(8)
    return {
        "results": [
            movie_to_dict(int(row['movie_id']), row['title'])
            for _, row in results_df.iterrows()
        ]
    }


@app.get("/api/recommend/{movie_title}")
async def recommend(movie_title: str):
    if 'similarity' not in globals() or similarity is None:
        raise HTTPException(status_code=500, detail="ML model not loaded. Run movie-recommender-system.py first.")

    if movie_title not in movies['title'].values:
        matches = movies[movies['title'].str.lower() == movie_title.lower()]
        if matches.empty:
            raise HTTPException(status_code=404, detail="Movie not found")
        movie_title = matches.iloc[0]['title']

    idx        = movies[movies['title'] == movie_title].index[0]
    distances  = similarity[idx]
    top        = sorted(enumerate(distances), reverse=True, key=lambda x: x[1])[1:9]

    return {
        "results": [
            movie_to_dict(int(movies.iloc[i].movie_id), movies.iloc[i].title)
            for i, _ in top
        ]
    }


@app.get("/api/category/{genre}")
async def get_by_category(genre: str):
    def has_genre(json_str):
        try:
            return any(g['name'].lower() == genre.lower() for g in json.loads(json_str))
        except Exception:
            return False

    ml_ids   = set(movies['movie_id'].astype(int))
    filtered = (
        metadata_df[metadata_df['genres'].apply(has_genre)]
        .sort_values(by='vote_average', ascending=False)
    )
    filtered = filtered[filtered['id'].isin(ml_ids)].head(12)

    results = []
    for _, row in filtered.iterrows():
        mid   = int(row['id'])
        match = movies[movies['movie_id'] == mid]
        title = match.iloc[0]['title'] if not match.empty else row['title']
        results.append(movie_to_dict(mid, title))
    return {"results": results}


@app.get("/api/popular")
async def get_popular():
    ml_ids = set(movies['movie_id'].astype(int))
    top    = (
        metadata_df[metadata_df['id'].isin(ml_ids)]
        .sort_values(by='vote_average', ascending=False)
        .head(24)
    )
    results = []
    for _, row in top.iterrows():
        mid   = int(row['id'])
        match = movies[movies['movie_id'] == mid]
        title = match.iloc[0]['title'] if not match.empty else row['title']
        results.append(movie_to_dict(mid, title))
    return {"results": results}


@app.get("/api/cache_status")
async def cache_status():
    hits = sum(1 for v in poster_cache.values() if v)
    return {"total": len(poster_cache), "posters_found": hits}


app.mount("/", StaticFiles(directory="couch-critic-ferb", html=True), name="static")
