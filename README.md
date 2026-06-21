# Couch-Critic Ferb 🍿

Couch-Critic Ferb is a premium, lightning-fast movie recommendation web application. It uses a custom machine learning model (cosine similarity) built on top of the TMDB 5000 movies dataset to recommend highly accurate movies based on your cinematic preferences.

The application features a modern, glassmorphic UI built with pure HTML/CSS/JS and is powered by a high-performance, fully asynchronous Python FastAPI backend.

## Features

- **Lightning-Fast Search:** Asynchronous backend fetching for near-instant autocomplete and TMDB poster retrieval.
- **Machine Learning Recommendations:** Content-based filtering using cosine similarity on movie metadata (genres, keywords, cast, crew).
- **Cinematic UI:** Beautiful dark-mode interface with glassmorphism, responsive grids, and high-definition TMDB posters.
- **Dynamic Categories:** Filter the entire dataset by genres like Action, Comedy, Sci-Fi, and Horror instantly.

## Tech Stack
- **Frontend:** HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+)
- **Backend:** Python 3, FastAPI, Uvicorn, HTTPX (Async HTTP)
- **Machine Learning:** Pandas, Scikit-learn
- **API:** TMDB API (The Movie Database)

## Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Abhijeet1815/couch-critic-ferb.git
   cd couch-critic-ferb
   ```

2. **Create a Virtual Environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Add your TMDB API Key**
   - Create a `.env` file in the root directory.
   - Add your key: `TMDB_API_KEY=your_key_here`

5. **Train the Model (Optional)**
   - If you want to rebuild the models, run `python3 movie-recommender-system.py`. This will generate `movies_dict.pkl` and `similarity.pkl` in the `/models` directory.
   
6. **Run the Application**
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
   Open `http://localhost:8000` in your browser.

## Deployment
This application is fully production-ready and optimized for deployment on platforms like Render or Heroku. The backend serves the static frontend files natively via `StaticFiles`.
