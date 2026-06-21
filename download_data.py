import urllib.request
import os

movies_url = "https://raw.githubusercontent.com/alura-cursos/introducao-a-data-science/aula3/aula3.1/tmdb_5000_movies.csv"
credits_url = "https://raw.githubusercontent.com/noahjett/Movie-Goodreads-Analysis/master/tmdb_5000_credits.csv"

os.makedirs('data', exist_ok=True)


print("Downloading tmdb_5000_movies.csv...")
urllib.request.urlretrieve(movies_url, "data/tmdb_5000_movies.csv")
print("Done.")

print("Downloading tmdb_5000_credits.csv...")
urllib.request.urlretrieve(credits_url, "data/tmdb_5000_credits.csv")
print("Done.")
