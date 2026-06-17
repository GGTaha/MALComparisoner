# Taste Blend - Comprehensive Implementation Documentation

This document serves as an exhaustive, low-level technical reference for all implemented systems, architectural decisions, mathematical algorithms, and state management within the Taste Blend application.

---

## 1. Core Architecture & Philosophy
Taste Blend is a stateless, heavily cached React/Vite/TypeScript frontend paired with a thin, proxying FastAPI/Python backend. 
* **Statelessness**: There is no SQL/NoSQL database, no server-side sessions, and no user accounts. Data flows entirely from external APIs -> Backend Normalization -> Frontend Computation.
* **Client-Side Heavy**: To minimize backend costs and logic, the backend exists *only* to bypass CORS and normalize external JSON/HTML data. All mathematical comparisons (analytics) happen in the browser.
* **Caching**: IndexedDB is used in the browser to store fetched profiles for 24 hours to prevent redundant backend API hits and rate-limiting.

---

## 2. Frontend Implementation (`frontend/`)

### 2.1 Technology Stack
* **Vite**: Ultra-fast build tool and development server.
* **React 18 + TypeScript**: Strict typings for all component props, state, and normalized API payloads.
* **Tailwind CSS v3**: Utility-first CSS framework. We locked to v3 to avoid breaking changes in the newer v4 alpha/beta releases. We heavily utilize custom HSL colors, dark-mode glassmorphism, and micro-animations defined in `tailwind.config.js`.

### 2.2 Component Hierarchy & State (`src/App.tsx`)
State is managed globally at the `App.tsx` level using React's `useState`:
* `view`: Enum/String controlling what page renders (`landing`, `loading`, `results`).
* `leftUser` & `rightUser`: Strings holding the inputted usernames.
* `platform`: String holding the selected platform (currently `"mal"` or `"letterboxd"`).
* `leftData` & `rightData`: Holds the `PlatformPayload` objects returned by the backend.

### 2.3 Caching Layer (`src/core/cache.ts`)
We use `idb-keyval`, a super lightweight wrapper around IndexedDB.
* **Structure**: `CacheEntry { data: PlatformPayload, timestamp: number }`
* **TTL (Time to Live)**: 24 hours. When `App.tsx` requests a user, it first checks `cache.ts`. If the timestamp is < 24h old, it instantly resolves without hitting the backend.

### 2.4 Analytics Engine (`src/core/analytics.ts`)
This is the mathematical core of the app. It compares two `PlatformPayload` arrays.
1. **Intersection**: Identifies media present in BOTH users' lists.
2. **Jaccard Similarity (Overlap)**: `Intersection Size / Union Size`. Measures how much of their overall libraries they share.
3. **Pearson Correlation Coefficient**: Measures the linear correlation between their numeric ratings. If User A rates a show a 10 and User B rates it a 10, correlation increases. It perfectly handles users who rate on different strictness scales (e.g., User A's average is 5, User B's average is 8) by normalizing around their respective means.
4. **Cosine Similarity**: Treats the ratings of the shared anime as two vectors in a high-dimensional space and calculates the angle between them. Useful for capturing raw magnitude similarity.
5. **Blend Score**: A proprietary weighted average:
   * 50% Pearson Correlation (How similarly they rate things).
   * 30% Jaccard Overlap (How many things they both watched).
   * 20% Cosine Similarity.
   * Modifiers: Tie-breakers utilizing genres and popularity (from the normalized data) can be applied here.

### 2.5 User Interface (`src/views/`)
* **LandingPage**: A sleek, glassmorphic form. Includes dynamic platform selectors.
* **LoadingPage**: A purely aesthetic transition screen with simulated "progress" steps and spinner to prevent user abandonment during long API fetches.
* **ResultsPage**: The final dashboard. Maps the calculated metrics into visual "Dials" (circular progress indicators) and builds a side-by-side grid showing what scores each user gave to specific shared media.

---

## 3. Backend Implementation (`backend/`)

### 3.1 Technology Stack
* **FastAPI**: Asynchronous Python web framework for maximum throughput.
* **Uvicorn**: ASGI server.
* **Pydantic**: Validates external JSON data into strict Python objects before returning it to the frontend.

### 3.2 Data Normalization (`schemas/media.py`)
To ensure the frontend mathematical engine never breaks, the backend strictly enforces a schema.
* **`NormalizedItem`**: 
  * `external_id`: String (e.g., MAL's anime ID).
  * `title`: String.
  * `raw_rating`: Float (Original platform rating).
  * `rating_normalized`: Float (Always mapped to a 0-100 scale. E.g., a Letterboxd 4/5 becomes 80. A MAL 8/10 becomes 80).
  * `genres`: Array of Strings.
  * `poster_url`: String.

### 3.3 Adapter Pattern (`adapters/`)
The backend uses a standard Interface/Protocol `PlatformAdapter`. 
* **Letterboxd (`letterboxd.py`)**: Uses `BeautifulSoup4` to scrape raw HTML from the user's diary pages. It uses `curl_cffi` to mimic Chrome 110 to bypass basic scraper protections, paginating through `/username/films/diary/page/N/`.
* **MyAnimeList (`mal.py`)**: (Heavily modified due to extreme WAF blocking). Currently configured to use the official MyAnimeList v2 Developer API (`api.myanimelist.net/v2`) using a public OAuth Client ID, bypassing the need for a server-side session.

### 3.4 Request Handling & Fault Tolerance (`main.py`)
* Connects the `/api/fetch/{platform}/{username}` route to the respective adapter.
* Includes global exception handlers. If an adapter throws a `Timeout` or `RequestError` (such as when Cloudflare drops the TCP connection), the backend catches it and maps it to a safe `502 Bad Gateway` JSON response, preventing the server from fatally crashing.

---

## 4. Known Environment Limitations & Connectivity
Because the application directly contacts platforms that enforce aggressive anti-scraping firewalls or are subject to regional censorship, networking anomalies may occur:
* **ISP & Regional Blocks**: MyAnimeList is actively blocked by several ISPs across regions like South Asia. If the backend throws persistent `URLError: timed out` or `ConnectError` while the host machine's browser succeeds, it is almost always due to the browser routing through a VPN extension while Python connects via the raw ISP. A **System-Wide VPN** is strictly required in these regions to run the backend.
* **Cloudflare IP Tarpitting**: Aggressively restarting the server and spamming large payload requests (e.g., profiles with 10,000+ entries) can trigger silent IP tarpits by Cloudflare. The `mal.py` adapter handles this via asynchronous sleep delays and an exponential retry loop.
