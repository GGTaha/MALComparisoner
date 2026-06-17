import asyncio
from typing import List, Dict, Any
from curl_cffi.requests import AsyncSession, errors as curl_errors
from schemas.media import PlatformPayload, NormalizedItem
from adapters.base import PlatformAdapter
from core.config import settings

class TraktAdapter(PlatformAdapter):
    def __init__(self):
        self.base_url = "https://api.trakt.tv"
        self.client_id = settings.TRAKT_CLIENT_ID
        
    async def fetch_user_list(self, username: str) -> PlatformPayload:
        if not self.client_id:
            raise ValueError("Trakt API Client ID is not configured. Please add TRAKT_CLIENT_ID to your backend environment.")

        entries: List[NormalizedItem] = []
        
        headers = {
            "Content-Type": "application/json",
            "trakt-api-version": "2",
            "trakt-api-key": self.client_id,
            "User-Agent": "TasteBlend/1.0"
        }

        async with AsyncSession(impersonate="chrome110", headers=headers, timeout=30.0) as client:
            current_page = 1
            total_pages = 1
            
            while current_page <= total_pages:
                url = f"{self.base_url}/users/{username}/ratings/shows"
                params = {
                    "extended": "full",
                    "limit": 100,
                    "page": current_page
                }
                
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        response = await client.get(url, params=params)
                        break
                    except curl_errors.RequestsError as e:
                        if attempt == max_retries - 1:
                            raise
                        await asyncio.sleep(2 * (attempt + 1))
                
                if response.status_code == 404:
                    raise ValueError(f"User {username} not found or has no public profile on Trakt.")
                if response.status_code == 401:
                    raise ValueError("Trakt API Client ID is invalid.")
                if response.status_code == 403:
                    raise ValueError(f"User {username} profile is private.")
                if response.status_code == 429:
                    await asyncio.sleep(2)
                    continue
                    
                response.raise_for_status()
                
                try:
                    data = response.json()
                except ValueError:
                    raise RuntimeError("Invalid JSON response from Trakt API")
                
                # Update total pages from headers
                page_count_header = response.headers.get("X-Pagination-Page-Count")
                if page_count_header and page_count_header.isdigit():
                    total_pages = int(page_count_header)
                    
                for item in data:
                    show = item.get("show", {})
                    raw_rating = item.get("rating")
                    
                    if not raw_rating or not show:
                        continue
                        
                    ids = show.get("ids", {})
                    # Prefer tmdb, fallback to trakt internal id
                    external_id = str(ids.get("tmdb") or ids.get("trakt"))
                    if not external_id:
                        continue
                        
                    entries.append(NormalizedItem(
                        external_id=external_id,
                        title=show.get("title", "Unknown"),
                        raw_rating=float(raw_rating),
                        rating_normalized=int(raw_rating * 10),
                        watched_date=item.get("rated_at"),
                        genres=show.get("genres", []),
                        poster_url=None, # Trakt API doesn't return poster URLs without a TMDB/Fanart API key
                        popularity=0
                    ))
                
                current_page += 1
                if current_page <= total_pages:
                    await asyncio.sleep(0.5) # Be gentle on the API
                    
        return PlatformPayload(
            username=username,
            platform="trakt",
            domain="tv",
            profile_url=f"https://trakt.tv/users/{username}",
            entries=entries
        )
