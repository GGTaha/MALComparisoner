export interface NormalizedItem {
  external_id: string;
  title: string;
  raw_rating: number;
  rating_normalized: number;
  watched_date: string | null;
  genres: string[];
  poster_url: string | null;
  popularity: number;
}

export interface PlatformPayload {
  username: string;
  platform: "mal" | "letterboxd" | "trakt";
  domain: "anime" | "movie" | "tv";
  profile_url: string;
  entries: NormalizedItem[];
}
