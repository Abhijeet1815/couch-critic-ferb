"""
build_poster_cache.py
─────────────────────
One-time script: fetches poster paths for all ~4,800 movies from TMDB
and saves them to models/poster_cache.json.

Run with VPN/hotspot active:
    python3 build_poster_cache.py

The script is fully resumable — if interrupted, re-run and it picks up
where it left off (already-fetched IDs are skipped).
"""

import asyncio
import httpx
import json
import os
import pickle
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
API_KEY   = os.getenv("TMDB_API_KEY", "")
CACHE_FILE = "models/poster_cache.json"
BATCH_SIZE = 40      # concurrent requests per batch
TIMEOUT    = 6.0     # seconds per request
RETRIES    = 2       # retries per failed request


def load_movie_ids() -> list[int]:
    movies_dict = pickle.load(open("models/movies_dict.pkl", "rb"))
    movies = pd.DataFrame(movies_dict)
    return movies["movie_id"].astype(int).tolist()


def load_existing_cache() -> dict[str, str]:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache: dict[str, str]):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)


async def fetch_one(client: httpx.AsyncClient, mid: int) -> tuple[int, str]:
    url = (
        f"https://api.themoviedb.org/3/movie/{mid}"
        f"?api_key={API_KEY}&language=en-US"
    )
    for attempt in range(RETRIES + 1):
        try:
            r = await client.get(url, timeout=TIMEOUT)
            data = r.json()
            path = data.get("poster_path") or ""
            return mid, ("https://image.tmdb.org/t/p/w500" + path) if path else ""
        except Exception as e:
            if attempt == RETRIES:
                return mid, ""
            await asyncio.sleep(0.5 * (attempt + 1))
    return mid, ""


async def main():
    if not API_KEY:
        print("❌  No TMDB_API_KEY found in .env — cannot fetch posters.")
        return

    all_ids = load_movie_ids()
    cache   = load_existing_cache()

    # Filter to only IDs not yet cached
    pending = [mid for mid in all_ids if str(mid) not in cache]
    already = len(all_ids) - len(pending)
    hits    = sum(1 for v in cache.values() if v)

    print(f"📦  Total movies  : {len(all_ids)}")
    print(f"✅  Already cached: {already}  ({hits} with posters)")
    print(f"⏳  To fetch      : {len(pending)}")

    if not pending:
        print("🎉  All posters already cached — nothing to do!")
        return

    # Quick connectivity check
    print("\n🔌  Testing TMDB API connectivity...")
    try:
        async with httpx.AsyncClient() as probe:
            r = await probe.get(
                f"https://api.themoviedb.org/3/configuration?api_key={API_KEY}",
                timeout=5.0,
            )
            if r.status_code == 200:
                print("✅  TMDB API reachable!\n")
            else:
                body = r.json()
                print(f"❌  TMDB returned status {r.status_code}: {body.get('status_message')}")
                return
    except Exception as e:
        print(f"❌  Cannot reach TMDB API: {e}")
        print("    → Make sure your VPN / hotspot is active, then re-run.")
        return

    # Fetch in batches, saving progress after each batch
    fetched_count = 0
    new_hits = 0
    async with httpx.AsyncClient() as client:
        for start in range(0, len(pending), BATCH_SIZE):
            batch = pending[start : start + BATCH_SIZE]
            results = await asyncio.gather(*(fetch_one(client, mid) for mid in batch))

            for mid, url in results:
                cache[str(mid)] = url
                if url:
                    new_hits += 1
            fetched_count += len(batch)

            # Save after every batch (resumable)
            save_cache(cache)

            total_hits = sum(1 for v in cache.values() if v)
            pct = fetched_count / len(pending) * 100
            print(
                f"  [{pct:5.1f}%]  {fetched_count}/{len(pending)} fetched"
                f"  |  {total_hits} posters found"
            )

    total_hits = sum(1 for v in cache.values() if v)
    print(f"\n🎬  Done! {total_hits}/{len(all_ids)} poster URLs saved to {CACHE_FILE}")
    print("    Restart your server — posters will load instantly from cache.")


if __name__ == "__main__":
    asyncio.run(main())
