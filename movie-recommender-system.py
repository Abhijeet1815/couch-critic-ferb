import numpy as np
import pandas as pd
import ast
import nltk
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle

# Load datasets
movies = pd.read_csv('data/tmdb_5000_movies.csv')
credits = pd.read_csv('data/tmdb_5000_credits.csv')

# Merge on title and select useful columns
movies = movies.merge(credits, on='title')
movies = movies[['movie_id', 'genres', 'keywords', 'title', 'overview', 'cast', 'crew']]

# Drop nulls
movies.dropna(inplace=True)

# Helper functions
def convert(obj):
    return [i['name'] for i in ast.literal_eval(obj)]

def convert2(obj):
    return [i['name'] for i in ast.literal_eval(obj)[:3]]

def director(obj):
    return [i['name'] for i in ast.literal_eval(obj) if i['job'] == 'Director']

# Apply conversion functions
movies['genres'] = movies['genres'].apply(convert)
movies['keywords'] = movies['keywords'].apply(convert)
movies['cast'] = movies['cast'].apply(convert2)
movies['crew'] = movies['crew'].apply(director)
movies['overview'] = movies['overview'].apply(lambda x: x.split())

# Remove spaces in tags
for col in ['genres', 'keywords', 'cast', 'crew']:
    movies[col] = movies[col].apply(lambda x: [i.replace(" ", "") for i in x])

# Combine all features into 'tags'
movies['tags'] = movies['genres'] + movies['keywords'] + movies['overview'] + movies['cast'] + movies['crew']
movies_new = movies[['movie_id', 'title', 'tags']].copy()
movies_new['tags'] = movies_new['tags'].apply(lambda x: " ".join(x))

# Stemming
ps = PorterStemmer()
def stem(text):
    return " ".join([ps.stem(i) for i in text.split()])

movies_new['tags'] = movies_new['tags'].apply(stem)

# Vectorization
cv = CountVectorizer(max_features=4000, stop_words='english')
vectors = cv.fit_transform(movies_new['tags']).toarray()

# Similarity calculation
similarity = cosine_similarity(vectors)

# Recommendation function
def recommend(movie):
    movie_index = movies_new[movies_new['title'] == movie].index[0]
    distances = similarity[movie_index]
    movies_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:6]
    for i in movies_list:
        print(movies_new.iloc[i[0]].title)

# Save files for deployment
pickle.dump(movies_new, open('models/movies.pkl', 'wb'))
pickle.dump(movies_new.to_dict(), open('models/movies_dict.pkl', 'wb'))
pickle.dump(similarity, open('models/similarity.pkl', 'wb'))
