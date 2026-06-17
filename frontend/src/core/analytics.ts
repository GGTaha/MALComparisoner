import type { NormalizedItem, PlatformPayload } from './types';

export interface OverlapItem {
  itemA: NormalizedItem;
  itemB: NormalizedItem;
  diff: number; // absolute difference in rating_normalized
  sum: number;  // sum of ratings for "best connection" logic
}

export interface AnalyticsResult {
  overlapping: OverlapItem[];
  pearson: number;
  cosine: number;
  jaccard: number; // Kept for raw data display if needed
  overlapProfile: number; // Geometric Mean Overlap
  absoluteAgreement: number; // 100 minus Mean Absolute Error
  blendScore: number;
  bestConnection: OverlapItem | null;
  recommendationsForA: NormalizedItem[];
  recommendationsForB: NormalizedItem[];
}

export function runAnalytics(payloadA: PlatformPayload, payloadB: PlatformPayload): AnalyticsResult {
  const mapA = new Map(payloadA.entries.map(e => [e.external_id, e]));
  const mapB = new Map(payloadB.entries.map(e => [e.external_id, e]));

  const overlapping: OverlapItem[] = [];
  const recsForA: NormalizedItem[] = [];
  const recsForB: NormalizedItem[] = [];

  // 1. Find overlap and separate recommendations
  for (const itemA of payloadA.entries) {
    const itemB = mapB.get(itemA.external_id);
    if (itemB) {
      overlapping.push({
        itemA,
        itemB,
        diff: Math.abs(itemA.rating_normalized - itemB.rating_normalized),
        sum: itemA.rating_normalized + itemB.rating_normalized
      });
    } else {
      if (itemA.rating_normalized >= 80) recsForB.push(itemA);
    }
  }

  for (const itemB of payloadB.entries) {
    if (!mapA.has(itemB.external_id)) {
      if (itemB.rating_normalized >= 80) recsForA.push(itemB);
    }
  }

  const intersectionSize = overlapping.length;
  const lenA = payloadA.entries.length;
  const lenB = payloadB.entries.length;

  // Classic Jaccard (Keep for potential raw data display)
  const unionSize = lenA + lenB - intersectionSize;
  const jaccard = unionSize === 0 ? 0 : intersectionSize / unionSize;

  // FIX 1: Geometric Mean Overlap (Balanced Power-User scaling)
  const overlapA = lenA === 0 ? 0 : intersectionSize / lenA;
  const overlapB = lenB === 0 ? 0 : intersectionSize / lenB;
  const overlapProfile = Math.sqrt(overlapA * overlapB);

  // FIX 2: Absolute Score Agreement (100 minus Mean Absolute Error)
  let absoluteAgreement = 0;
  if (intersectionSize > 0) {
    const totalDiff = overlapping.reduce((sum, o) => sum + o.diff, 0);
    const meanDiff = totalDiff / intersectionSize;
    // Since diff is on a 0-100 scale, (100 - meanDiff) / 100 converts it to a 0-1 percentage
    absoluteAgreement = (100 - meanDiff) / 100;
  }

  // Pearson correlation
  let pearson = 0;
  if (intersectionSize > 1) {
    const meanA = overlapping.reduce((sum, o) => sum + o.itemA.rating_normalized, 0) / intersectionSize;
    const meanB = overlapping.reduce((sum, o) => sum + o.itemB.rating_normalized, 0) / intersectionSize;

    let num = 0;
    let denA = 0;
    let denB = 0;

    for (const o of overlapping) {
      const diffA = o.itemA.rating_normalized - meanA;
      const diffB = o.itemB.rating_normalized - meanB;
      num += diffA * diffB;
      denA += diffA * diffA;
      denB += diffB * diffB;
    }

    if (denA > 0 && denB > 0) {
      pearson = num / Math.sqrt(denA * denB);
    }
  }

  // FIX 3: Directional Clamping for Pearson (Rewards positive trends, ignores negative)
  const pearsonScore = Math.max(0, pearson);

  // Genre Cosine Similarity
  const genreFreqA = getGenreFrequencies(payloadA.entries);
  const genreFreqB = getGenreFrequencies(payloadB.entries);
  const allGenres = new Set([...Object.keys(genreFreqA), ...Object.keys(genreFreqB)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const genre of allGenres) {
    const freqA = genreFreqA[genre] || 0;
    const freqB = genreFreqB[genre] || 0;
    dotProduct += freqA * freqB;
    normA += freqA * freqA;
    normB += freqB * freqB;
  }

  const cosine = (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

  // Check if we actually have genre data to work with
  const hasGenres = allGenres.size > 0 && normA > 0 && normB > 0;

  // FIX 4: Dynamic Re-balanced Blend Weight Matrix
  let blendScore = 0;

  if (intersectionSize < 3) {
    // FALLBACK: Not enough shared data for statistical score comparison.
    if (hasGenres) {
      blendScore = Math.round((0.75 * cosine + 0.25 * overlapProfile) * 100);
    } else {
      // If we have no genres AND almost no overlap, the Overlap Profile is literally
      // the only valid metric we have left.
      blendScore = Math.round(overlapProfile * 100);
    }
  } else {
    // STANDARD: Robust sample size available.
    if (hasGenres) {
      // Live API Data: Full matrix
      blendScore = Math.round(
        (0.30 * absoluteAgreement + 
         0.25 * overlapProfile + 
         0.25 * pearsonScore + 
         0.20 * cosine) * 100
      );
    } else {
      // Offline File Data: Redistribute the 20% genre weight proportionally
      blendScore = Math.round(
        (0.375 * absoluteAgreement + 
         0.3125 * overlapProfile + 
         0.3125 * pearsonScore) * 100
      );
    }
  }

  // Best Connection Logic: Title maximizing (R_A + R_B) - |R_A - R_B|
  let bestConnection: OverlapItem | null = null;
  let bestScore = -Infinity;
  for (const o of overlapping) {
    const score = o.sum - o.diff;
    if (score > bestScore) {
      bestScore = score;
      bestConnection = o;
    }
  }

  // Default sorting: Smallest rating gap first (0 gap items jump to the top)
  overlapping.sort((a, b) => a.diff - b.diff);

  // Sort recommendations by score descending
  recsForA.sort((a, b) => b.rating_normalized - a.rating_normalized);
  recsForB.sort((a, b) => b.rating_normalized - a.rating_normalized);

  return {
    overlapping,
    pearson,
    cosine,
    jaccard,
    overlapProfile,
    absoluteAgreement,
    blendScore: Math.min(100, Math.max(0, blendScore)),
    bestConnection,
    recommendationsForA: recsForA,
    recommendationsForB: recsForB
  };
}

function getGenreFrequencies(entries: NormalizedItem[]): Record<string, number> {
  const freqs: Record<string, number> = {};
  for (const item of entries) {
    for (const genre of item.genres) {
      freqs[genre] = (freqs[genre] || 0) + 1;
    }
  }
  return freqs;
}