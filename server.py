import asyncio
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pickle
import pandas as pd
import os
from dotenv import load_dotenv
import json

load_dotenv()
api_key = os.getenv("TMDB_API_KEY", "")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models & Metadata
try:
    movies_dict = pickle.load(open('models/movies_dict.pkl', 'rb'))
    movies = pd.DataFrame(movies_dict)
    similarity = pickle.load(open('models/similarity.pkl', 'rb'))
    metadata_df = pd.read_csv('data/tmdb_5000_movies.csv')
except Exception as e:
    print(f"Error loading models or metadata: {e}")

def get_movie_metadata(movie_id):
    try:
        row = metadata_df[metadata_df['id'] == movie_id].iloc[0]
        genres_data = json.loads(row['genres'])
        genres_str = " | ".join([g['name'] for g in genres_data[:2]]) if genres_data else "Action"
        vote_average = float(row['vote_average'])
        release_date = str(row['release_date'])
        return genres_str, vote_average, release_date
    except:
        return "Unknown", 0.0, ""

async def fetch_poster_async(client, movie_id):
    if not api_key:
        return ""
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={api_key}&language=en-US"
        res = await client.get(url, timeout=3.0)
        data = res.json()
        if 'poster_path' in data and data['poster_path']:
            return "https://image.tmdb.org/t/p/w500" + data['poster_path']
        return ""
    except:
        return ""

@app.get("/api/search")
async def search(q: str):
    q = q.lower()
    results_df = movies[movies['title'].str.lower().str.contains(q, na=False)].head(5)
    
    async with httpx.AsyncClient() as client:
        tasks = []
        for _, row in results_df.iterrows():
            movie_id = int(row['movie_id'])
            tasks.append(fetch_poster_async(client, movie_id))
        posters = await asyncio.gather(*tasks)
        
    results = []
    for i, (_, row) in enumerate(results_df.iterrows()):
        movie_id = int(row['movie_id'])
        genres, vote, release_date = get_movie_metadata(movie_id)
        results.append({
            "id": movie_id,
            "title": row['title'],
            "poster_path": posters[i],
            "release_date": release_date,
            "vote_average": vote,
            "genres": genres
        })
    return {"results": results}

@app.get("/api/recommend/{movie_title}")
async def recommend(movie_title: str):
    if movie_title not in movies['title'].values:
        matches = movies[movies['title'].str.lower() == movie_title.lower()]
        if matches.empty:
            raise HTTPException(status_code=404, detail="Movie not found in database")
        movie_title = matches.iloc[0]['title']

    movie_index = movies[movies['title'] == movie_title].index[0]
    distances = similarity[movie_index]
    movies_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:9]
    
    async with httpx.AsyncClient() as client:
        tasks = []
        for i in movies_list:
            movie_id = int(movies.iloc[i[0]].movie_id)
            tasks.append(fetch_poster_async(client, movie_id))
        posters = await asyncio.gather(*tasks)

    recommended_movies = []
    for idx, i in enumerate(movies_list):
        movie_id = int(movies.iloc[i[0]].movie_id)
        title = movies.iloc[i[0]].title
        genres, vote, release_date = get_movie_metadata(movie_id)
        
        recommended_movies.append({
            "id": movie_id,
            "title": title,
            "poster_path": posters[idx],
            "release_date": release_date, 
            "overview": "Recommended based on " + movie_title,
            "vote_average": vote,
            "genres": genres
        })
    return {"results": recommended_movies}

@app.get("/api/category/{genre}")
async def get_by_category(genre: str):
    # Filter metadata_df where genre exists
    def has_genre(json_str):
        try:
            g_list = json.loads(json_str)
            return any(g['name'].lower() == genre.lower() for g in g_list)
        except:
            return False
            
    filtered = metadata_df[metadata_df['genres'].apply(has_genre)].sort_values(by='vote_average', ascending=False)
    # Ensure they are in our ML movies_dict too
    ml_movie_ids = set(movies['movie_id'].astype(int))
    filtered = filtered[filtered['id'].isin(ml_movie_ids)].head(8)
    
    async with httpx.AsyncClient() as client:
        tasks = []
        for _, row in filtered.iterrows():
            tasks.append(fetch_poster_async(client, int(row['id'])))
        posters = await asyncio.gather(*tasks)
        
    results = []
    for i, (_, row) in enumerate(filtered.iterrows()):
        movie_id = int(row['id'])
        genres, vote, release_date = get_movie_metadata(movie_id)
        # title is in our movies_dict
        title_matches = movies[movies['movie_id'] == str(movie_id)]
        title = title_matches.iloc[0]['title'] if not title_matches.empty else row['title']
        results.append({
            "id": movie_id,
            "title": title,
            "poster_path": posters[i],
            "release_date": release_date,
            "vote_average": vote,
            "genres": genres
        })
    return {"results": results}

app.mount("/", StaticFiles(directory="couch-critic-ferb", html=True), name="static")
