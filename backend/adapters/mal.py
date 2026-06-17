import asyncio
from curl_cffi.requests import AsyncSession, errors as curl_errors
from schemas.media import PlatformPayload, NormalizedItem
from core.config import settings

class MALAdapter:
    def __init__(self):
        self.base_url = "https://api.myanimelist.net/v2"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-MAL-CLIENT-ID": "6114d00ca681b7701d1e15fe11a4987e"
        }

    async def fetch_user_list(self, username: str) -> PlatformPayload:
        entries = []
        
        async with AsyncSession(impersonate="chrome110", headers=self.headers, timeout=30.0) as client:
            # We fetch all list items, limiting to 1000 per page to minimize requests
            url = f"{self.base_url}/users/{username}/animelist"
            params = {
                "limit": 1000,
                "fields": "list_status,genres,num_episodes,mean,main_picture"
            }
            
            while url:
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        response = await client.get(url, params=params)
                        break
                    except curl_errors.RequestsError as e:
                        if attempt == max_retries - 1:
                            raise
                        await asyncio.sleep(2 * (attempt + 1))
                
                # Clear params after first request because the 'next' URL from paging already contains them
                params = None

                if response.status_code in (400, 404):
                    raise ValueError(f"User {username} not found on MyAnimeList")
                if response.status_code == 403:
                    raise ValueError(f"User {username} has a private animelist or API block.")
                if response.status_code == 429:
                    await asyncio.sleep(2)
                    continue # Retry same url
                        
                response.raise_for_status()
                
                try:
                    data = response.json()
                except ValueError:
                    raise RuntimeError("Invalid response from MyAnimeList API v2")

                items = data.get("data", [])
                if not items:
                    break
                    
                for item_wrapper in items:
                    node = item_wrapper.get("node", {})
                    list_status = item_wrapper.get("list_status", {})
                    
                    raw_score = list_status.get("score", 0)
                    
                    if raw_score > 0:
                        genres_list = node.get("genres", [])
                        genres = [g.get("name") for g in genres_list if isinstance(g, dict)]
                        
                        poster = None
                        main_picture = node.get("main_picture")
                        if main_picture:
                            poster = main_picture.get("large") or main_picture.get("medium")

                        entries.append(NormalizedItem(
                            external_id=str(node.get("id")),
                            title=node.get("title", "Unknown"),
                            raw_rating=raw_score,
                            rating_normalized=round(raw_score * 10),
                            watched_date=list_status.get("finish_date"),
                            genres=genres,
                            poster_url=poster,
                            popularity=0 # v2 list endpoint doesn't return popularity natively without an extra fetch, so we skip it to save rate limits
                        ))
                
                paging = data.get("paging", {})
                url = paging.get("next")
                if url:
                    await asyncio.sleep(0.5)

        return PlatformPayload(
            username=username,
            platform="mal",
            domain="anime",
            profile_url=f"https://myanimelist.net/profile/{username}",
            entries=entries
        )
