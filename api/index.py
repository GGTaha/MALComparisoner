import sys
import os
# Add the current directory to sys.path to allow absolute imports from project root on Vercel
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from curl_cffi.requests import errors as curl_errors
import httpx
from schemas.media import PlatformPayload
from core.config import settings
from core.registry import get_adapter
import re

app = FastAPI(title="Watch Overlap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sanitize_username(username: str) -> str:
    # Basic sanitization: alphanumeric, underscore, hyphen
    if not re.match(r'^[\w-]+$', username):
        raise ValueError("Invalid username format")
    return username

@app.get("/api/fetch/{platform}/{username}", response_model=PlatformPayload)
async def fetch_user_data(platform: str, username: str):
    try:
        clean_username = sanitize_username(username)
        adapter = get_adapter(platform)
        payload = await adapter.fetch_user_list(clean_username)
        
        if not payload.entries:
            raise ValueError(f"No public entries found for {clean_username} on {platform}")
            
        return payload
    except ValueError as e:
        # Map known value errors to proper HTTP exceptions
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": error_msg})
        if "no public entries" in error_msg.lower():
            raise HTTPException(status_code=404, detail={"error": "empty", "message": error_msg})
        raise HTTPException(status_code=400, detail={"error": "bad_request", "message": error_msg})
    except RuntimeError as e:
        if "Rate limited" in str(e):
            raise HTTPException(status_code=429, detail={"error": "rate_limited", "message": str(e)})
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": str(e)})
    except (curl_errors.RequestsError, httpx.RequestError) as e:
        raise HTTPException(status_code=502, detail={"error": "upstream_error", "message": f"Connection to platform failed: {str(e)}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal_error", "message": "An unexpected error occurred."})
