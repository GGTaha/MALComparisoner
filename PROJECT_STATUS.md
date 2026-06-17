# Taste Blend - Project Status & Architecture

## 1. Project Overview
Taste Blend is a stateless media-compatibility application that compares the tastes of two users across different platforms (currently MyAnimeList, with support for Letterboxd). It calculates similarity scores using statistical algorithms (Pearson, Jaccard, Cosine) to generate a final "Blend Score".

The application strictly adheres to a stateless architecture: no databases and no server-side sessions. All caching is handled client-side via IndexedDB.

---

## 2. Architecture Structure

### Frontend (React + TypeScript + Vite + TailwindCSS v3)
The frontend handles state, routing, and all mathematical similarity computations.
* **`src/App.tsx`**: The main entry point that manages the active view state (Landing, Loading, Results) and coordinates fetching data from the backend.
* **`src/views/`**:
  * `LandingPage.tsx`: The initial form to select a platform and input two usernames.
  * `LoadingPage.tsx`: A loading screen displayed while the backend is fetching and the frontend is calculating scores.
  * `ResultsPage.tsx`: Displays the final Identity header, similarity dials, and side-by-side comparative grids.
* **`src/core/analytics.ts`**: The core mathematics engine. Computes Jaccard Similarity (overlap), Pearson Correlation (rating trends), Cosine Similarity (vector angle), and the final weighted Blend Score.
* **`src/core/cache.ts`**: Manages a 24-hour IndexedDB cache to prevent spamming the backend for the same username within a 24-hour window.

**Connection to Backend:**
The frontend communicates with the backend purely via HTTP GET requests. When a user submits the form, `App.tsx` triggers parallel `fetch` calls to `http://127.0.0.1:8000/api/fetch/{platform}/{username}`.

### Backend (FastAPI + Python)
The backend is a lightweight proxy that scrapes or fetches data from external platforms and normalizes it into a standard JSON schema.
* **`backend/main.py`**: The FastAPI application setup. Defines the `/api/fetch/{platform}/{username}` endpoint, handles CORS, and routes requests to the correct adapter based on the platform. It wraps network exceptions and returns `502 Bad Gateway` if upstream platforms fail.
* **`backend/schemas/media.py`**: Pydantic models (`NormalizedItem`, `PlatformPayload`) ensuring that no matter what platform is scraped, the frontend receives identical, predictable data structures.
* **`backend/core/registry.py`**: Factory pattern registry mapping string IDs (like `"mal"`) to their respective adapter classes.
* **`backend/adapters/`**:
  * `base.py`: Defines the `PlatformAdapter` protocol every adapter must implement.
  * `letterboxd.py`: Scrapes Letterboxd user diary pages using `BeautifulSoup4` and `curl_cffi` to mimic browser TLS fingerprints.
  * `mal.py`: The MyAnimeList adapter responsible for fetching a user's anime list, scores, and genres.

---


