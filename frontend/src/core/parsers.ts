import JSZip from 'jszip';
import type { NormalizedItem } from './types';

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

export async function parseMALXML(file: File): Promise<NormalizedItem[]> {
  const text = await file.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, 'text/xml');
  const animeElements = xmlDoc.getElementsByTagName('anime');
  const items: NormalizedItem[] = [];

  for (let i = 0; i < animeElements.length; i++) {
    const el = animeElements[i];
    const title = el.getElementsByTagName('series_title')[0]?.textContent || '';
    const scoreText = el.getElementsByTagName('my_score')[0]?.textContent || '0';
    const score = parseInt(scoreText, 10);
    
    // FIX: Extract the actual MAL ID from the XML
    const idText = el.getElementsByTagName('series_animedb_id')[0]?.textContent;
    
    // Fallback to slugify ONLY if the ID is somehow missing, to prevent crashes
    const finalId = idText ? idText : slugify(title);
    
    if (title && score > 0) {
      items.push({
        external_id: finalId, // Now this perfectly matches the backend's numeric ID!
        title: title,
        raw_rating: score,
        rating_normalized: score * 10,
        watched_date: el.getElementsByTagName('my_finish_date')[0]?.textContent || null,
        genres: [],
        poster_url: null,
        popularity: 0
      });
    }
  }
  return items;
}

export async function parseLetterboxdCSV(file: File): Promise<NormalizedItem[]> {
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const nameIdx = headers.indexOf('name');
  const ratingIdx = headers.indexOf('rating');
  const uriIdx = headers.indexOf('letterboxd uri');

  if (nameIdx === -1 || ratingIdx === -1) {
    throw new Error('CSV is missing "Name" or "Rating" columns');
  }

  const items: NormalizedItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(nameIdx, ratingIdx)) continue;

    const title = row[nameIdx];
    const ratingVal = row[ratingIdx];
    const score = parseFloat(ratingVal);
    
    let slug = slugify(title);
    if (uriIdx !== -1 && row[uriIdx]) {
      const uri = row[uriIdx];
      const match = uri.match(/\/film\/([^/]+)\/?/);
      if (match && match[1]) {
        slug = match[1];
      }
    }

    if (title && !isNaN(score) && score > 0) {
      items.push({
        external_id: slug,
        title: title,
        raw_rating: score,
        rating_normalized: Math.round(score * 20),
        watched_date: null,
        genres: [],
        poster_url: null,
        popularity: 0
      });
    }
  }
  return items;
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  return lines
    .map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    })
    .filter(row => row.some(cell => cell.length > 0));
}

export async function parseTraktJSON(file: File): Promise<NormalizedItem[]> {
  let jsonText = '';
  
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    // Prefer shows ratings, but fallback to any ratings or any json
    const jsonFile = 
      loadedZip.file(/.*shows.*ratings.*\.json$/i)[0] || 
      loadedZip.file(/.*ratings.*\.json$/i)[0] || 
      loadedZip.file(/\.json$/i)[0];
      
    if (!jsonFile) {
      throw new Error('No rating JSON files found in Trakt zip export');
    }
    jsonText = await jsonFile.async('string');
  } else {
    jsonText = await file.text();
  }

  const data = JSON.parse(jsonText);
  if (!Array.isArray(data)) {
    throw new Error('Trakt rating data must be an array');
  }

  const items: NormalizedItem[] = [];
  for (const item of data) {
    if (!item) continue;
    let title = '';
    let rating = 0;
    let watchedDate = null;
    let ids: any = null;

    if (item.show && typeof item.show === 'object') {
      title = item.show.title || '';
      ids = item.show.ids;
    } else if (item.movie && typeof item.movie === 'object') {
      title = item.movie.title || '';
      ids = item.movie.ids;
    } else if (typeof item.title === 'string') {
      title = item.title;
      ids = item.ids;
    }

    if (typeof item.rating === 'number') {
      rating = item.rating;
    }

    if (typeof item.rated_at === 'string') {
      watchedDate = item.rated_at;
    }
    
    let externalId = slugify(title);
    if (ids) {
      if (ids.tmdb) externalId = String(ids.tmdb);
      else if (ids.trakt) externalId = String(ids.trakt);
    }

    if (title && rating > 0) {
      items.push({
        external_id: externalId,
        title: title,
        raw_rating: rating,
        rating_normalized: rating * 10,
        watched_date: watchedDate,
        genres: [],
        poster_url: null,
        popularity: 0
      });
    }
  }
  return items;
}
