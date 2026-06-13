import streamlit as st
import pickle
import pandas as pd
import requests
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("TMDB_API_KEY")
def fetch_poster(movie_id):
 res = requests.get(f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={api_key}&language=en-US")
 data = res.json()
 return "https://image.tmdb.org/t/p/w500"+data["poster_path"]


def recommend(movie):
    movie_index = movies[movies['title'] == movie].index[0]
    distances = similarity[movie_index]
    movies_list = sorted(list(enumerate(distances)), reverse=True, key=lambda x: x[1])[1:6]
    recommended_movies = []
    recommended_movies_posters = []
    for i in movies_list:
        movie_id = movies.iloc[i[0]].movie_id
        recommended_movies.append(movies.iloc[i[0]].title)
        recommended_movies_posters.append(fetch_poster(movie_id))
    return recommended_movies, recommended_movies_posters

movies_dict= pickle.load(open('models/movies_dict.pkl', 'rb'))
movies = pd.DataFrame(movies_dict)
st.title('Movie Recommender System')
similarity = pickle.load(open('models/similarity.pkl', 'rb'))
movie_name =st.selectbox(
    'Which kind of movie do you want to watch?',
                     movies['title'].values)

if st.button('Recommend'):
    names,posters = recommend(movie_name)
    tab1, tab2, tab3, tab4, tab5 = st.tabs([f"{names[0]}",f"{names[1]}",f"{names[2]}",f"{names[3]}",f"{names[4]}"])

    with tab1:
        st.header(names[0])
        st.image(posters[0])
    with tab2:
        st.header(names[1])
        st.image(posters[1])
    with tab3:
        st.header(names[2])
        st.image(posters[2])
    with tab4:
        st.header(names[3])
        st.image(posters[3])
    with tab5:
        st.header(names[4])
        st.image(posters[4])