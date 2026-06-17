import asyncio
import json
from curl_cffi.requests import AsyncSession
from bs4 import BeautifulSoup
from schemas.media import PlatformPayload, NormalizedItem
from core.config import settings

class LetterboxdAdapter:
    def __init__(self):
        self.base_url = settings.LETTERBOXD_URL

    async def fetch_user_list(self, username: str) -> PlatformPayload:
        entries = []
        page = 1
        
        async with AsyncSession(impersonate="chrome110", timeout=30.0) as client:
            while True:
                # Use /films/ for page 1, /films/page/N/ for subsequent pages
                if page == 1:
                    url = f"{self.base_url}/{username}/films/"
                else:
                    url = f"{self.base_url}/{username}/films/page/{page}/"
                
                response = await client.get(url)
                
                if response.status_code == 404:
                    if page == 1:
                        raise ValueError(f"User {username} not found on Letterboxd")
                    else:
                        break  # Past the last page
                
                if response.status_code == 403:
                    if page == 1:
                        raise ValueError(f"User {username} not found or profile is private on Letterboxd")
                    else:
                        break  # Cloudflare blocked us, return what we have
                        
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Films are in li.griditem elements inside ul.grid
                grid_items = soup.select('li.griditem')
                if not grid_items:
                    break
                    
                for item in grid_items:
                    # The LazyPoster div contains all the metadata as data attributes
                    poster_div = item.select_one('div[data-component-class="LazyPoster"]')
                    if not poster_div:
                        continue
                    
                    title = poster_div.get('data-item-name', 'Unknown')
                    film_slug = poster_div.get('data-item-slug', '')
                    
                    # Extract the film UID from the postered-identifier JSON
                    film_id = film_slug  # Fallback
                    postered_id_str = poster_div.get('data-postered-identifier', '')
                    if postered_id_str:
                        try:
                            postered_data = json.loads(postered_id_str)
                            film_id = postered_data.get('uid', film_slug)
                        except (json.JSONDecodeError, TypeError):
                            pass
                    
                    # Rating is in the poster-viewingdata paragraph
                    viewingdata = item.select_one('p.poster-viewingdata')
                    if not viewingdata:
                        continue
                    
                    rating_span = viewingdata.select_one('span.rating')
                    if not rating_span:
                        continue  # No rating for this film, skip
                    
                    # Extract rating from CSS class like "rated-9" (out of 10, half-star increments)
                    # rated-1 = 0.5 stars, rated-2 = 1 star, ..., rated-10 = 5 stars
                    rating_classes = rating_span.get('class', [])
                    raw_rating_val = 0
                    for cls in rating_classes:
                        if cls.startswith('rated-'):
                            try:
                                raw_rating_val = int(cls.split('-')[1])
                            except (ValueError, IndexError):
                                pass
                    
                    if raw_rating_val <= 0:
                        continue
                    
                    # Convert from 1-10 scale to star rating (0.5 - 5.0)
                    stars = raw_rating_val / 2.0
                    
                    # Poster URL from the img tag inside the poster div
                    poster_url = None
                    img = poster_div.select_one('img.image')
                    if img:
                        src = img.get('src', '')
                        if 'empty-poster' not in src:
                            poster_url = src

                    entries.append(NormalizedItem(
                        external_id=film_slug,
                        title=title,
                        raw_rating=stars,
                        rating_normalized=round(stars * 20),  # 5 stars = 100
                        watched_date=None,
                        genres=[],
                        poster_url=poster_url,
                        popularity=0
                    ))
                
                # Check for next page
                next_link = soup.select_one('.paginate-next')
                if not next_link or 'paginate-disabled' in next_link.get('class', []):
                    break
                    
                page += 1
                await asyncio.sleep(1.5)  # Generous delay to avoid Cloudflare 403

        return PlatformPayload(
            username=username,
            platform="letterboxd",
            domain="movie",
            profile_url=f"{self.base_url}/{username}/",
            entries=entries
        )
