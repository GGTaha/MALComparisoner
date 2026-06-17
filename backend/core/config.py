import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    MAL_API_URL: str = "https://api.jikan.moe/v4"
    LETTERBOXD_URL: str = "https://letterboxd.com"
    TRAKT_CLIENT_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), "..", ".env"),
        extra="ignore"
    )

settings = Settings()
