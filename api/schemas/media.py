from pydantic import BaseModel, Field
from typing import List, Optional

class NormalizedItem(BaseModel):
    external_id: str           # MAL id, or TMDB id for Letterboxd entries
    title: str
    raw_rating: float          # original scale: /10 for MAL, /5 for Letterboxd
    rating_normalized: int     # 0-100, used for all cross-platform math
    watched_date: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    poster_url: Optional[str] = None
    popularity: int = 0        # reserved for a future obscurity-weighted score, unused in v1

class PlatformPayload(BaseModel):
    username: str
    platform: str   # "mal" | "letterboxd"
    domain: str     # "anime" | "movie"
    profile_url: str
    entries: List[NormalizedItem]
