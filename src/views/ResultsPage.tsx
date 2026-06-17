import { useState } from 'react';
import type { PlatformPayload } from '../core/types';
import type { AnalyticsResult } from '../core/analytics';

interface ResultsPageProps {
  payloadA: PlatformPayload;
  payloadB: PlatformPayload;
  analytics: AnalyticsResult;
  onReset: () => void;
}

type SortField = 'title' | 'ratingA' | 'ratingB' | 'gap';
type SortOrder = 'asc' | 'desc';

export const ResultsPage: React.FC<ResultsPageProps> = ({ payloadA, payloadB, analytics, onReset }) => {
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [secondarySortField, setSecondarySortField] = useState<SortField | null>(null);
  const [secondarySortOrder, setSecondarySortOrder] = useState<SortOrder>('asc');

  const [showBreakdown, setShowBreakdown] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSecondarySortField(sortField);
      setSecondarySortOrder(sortOrder);
      setSortField(field);
      setSortOrder(field === 'title' || field === 'gap' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-zinc-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const sortedOverlaps = [...analytics.overlapping].sort((a, b) => {
    const compare = (x: typeof a, y: typeof b, field: SortField, order: SortOrder): number => {
      let valX: number | string;
      let valY: number | string;

      switch (field) {
        case 'title':
          valX = x.itemA.title.toLowerCase();
          valY = y.itemA.title.toLowerCase();
          break;
        case 'ratingA':
          valX = x.itemA.raw_rating > 0 ? x.itemA.raw_rating : (order === 'asc' ? 999 : -999);
          valY = y.itemA.raw_rating > 0 ? y.itemA.raw_rating : (order === 'asc' ? 999 : -999);
          break;
        case 'ratingB':
          valX = x.itemB.raw_rating > 0 ? x.itemB.raw_rating : (order === 'asc' ? 999 : -999);
          valY = y.itemB.raw_rating > 0 ? y.itemB.raw_rating : (order === 'asc' ? 999 : -999);
          break;
        case 'gap':
          {
            const hasX = x.itemA.raw_rating > 0 && x.itemB.raw_rating > 0;
            const hasY = y.itemA.raw_rating > 0 && y.itemB.raw_rating > 0;
            valX = hasX ? Math.abs(x.itemA.raw_rating - x.itemB.raw_rating) : (order === 'asc' ? 999 : -999);
            valY = hasY ? Math.abs(y.itemA.raw_rating - y.itemB.raw_rating) : (order === 'asc' ? 999 : -999);
          }
          break;
      }

      if (valX < valY) return order === 'asc' ? -1 : 1;
      if (valX > valY) return order === 'asc' ? 1 : -1;
      return 0;
    };

    const primaryResult = compare(a, b, sortField, sortOrder);
    if (primaryResult !== 0) return primaryResult;

    if (secondarySortField) {
      const secondaryResult = compare(a, b, secondarySortField, secondarySortOrder);
      if (secondaryResult !== 0) return secondaryResult;
    }

    if (sortField !== 'title') {
      const titleValA = a.itemA.title.toLowerCase();
      const titleValB = b.itemA.title.toLowerCase();
      if (titleValA < titleValB) return -1;
      if (titleValA > titleValB) return 1;
    }
    return 0;
  });

  const intersectionSize = analytics.overlapping.length;
  const hasGenres = payloadA.entries.some(e => e.genres && e.genres.length > 0) || 
                    payloadB.entries.some(e => e.genres && e.genres.length > 0);

  const ratingMatch = Math.round(analytics.absoluteAgreement * 100) + '%';
  const tasteTrend = Math.round(Math.max(0, analytics.pearson) * 100) + '%';
  const libraryOverlap = Math.round(analytics.overlapProfile * 100) + '%';
  const genreVibes = Math.round(analytics.cosine * 100) + '%';

  const isLowOverlap = intersectionSize < 3;
  const isOfflineFile = !hasGenres && analytics.cosine === 0;

  return (
    <div className="fade-in pt-8 pb-24">
      <div className="max-w-2xl mx-auto px-4">

        {/* Score */}
        <div className="text-center mt-8 mb-6 flex flex-col items-center">
          <div className="flex items-center justify-center relative">
            <div className="text-7xl sm:text-8xl font-bold text-zinc-100 tracking-tight">
              {analytics.blendScore}<span className="text-5xl sm:text-6xl">%</span>
            </div>
            
            {/* Popover trigger */}
            <div 
              className="relative inline-block ml-3 align-middle"
              onMouseEnter={() => setShowBreakdown(true)}
              onMouseLeave={() => setShowBreakdown(false)}
            >
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-6 h-6 rounded-full border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 flex items-center justify-center text-xs font-serif font-bold transition-all cursor-pointer select-none"
                aria-label="Compatibility Score Breakdown"
              >
                i
              </button>

              {showBreakdown && (
                <div 
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 sm:w-80 bg-zinc-950 border border-zinc-800 rounded-lg p-5 shadow-2xl z-50 text-left fade-in flex flex-col gap-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 pb-2 border-b border-zinc-900 select-none">
                    Compatibility Breakdown
                  </h4>
                  
                  {/* Rating Agreement */}
                  <div className={`flex flex-col ${isLowOverlap ? 'opacity-35 select-none' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">Rating Agreement</span>
                      <span className="text-xs font-semibold text-zinc-100">{isLowOverlap ? '—' : ratingMatch}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      When you both watch the same thing, how close your actual scores are to each other.
                    </p>
                    {isLowOverlap && (
                      <span className="self-start mt-1 text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
                        Not enough shared titles to calculate
                      </span>
                    )}
                  </div>

                  {/* Shared Library */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">Shared Library</span>
                      <span className="text-xs font-semibold text-zinc-100">{libraryOverlap}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      How much of your total watching history overlaps with theirs.
                    </p>
                  </div>

                  {/* Taste Alignment */}
                  <div className={`flex flex-col ${isLowOverlap ? 'opacity-35 select-none' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">Taste Alignment</span>
                      <span className="text-xs font-semibold text-zinc-100">{isLowOverlap ? '—' : tasteTrend}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      How often your opinions trend in the same direction (if you love a show, they love it too).
                    </p>
                    {isLowOverlap && (
                      <span className="self-start mt-1 text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
                        Not enough shared titles to calculate
                      </span>
                    )}
                  </div>

                  {/* Genre Match */}
                  <div className={`flex flex-col ${isOfflineFile ? 'opacity-35 select-none' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">Genre Match</span>
                      <span className="text-xs font-semibold text-zinc-100">{isOfflineFile ? '—' : genreVibes}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      How closely your favorite genres and overall library vibes align.
                    </p>
                    {isOfflineFile && (
                      <span className="self-start mt-1 text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 py-0.5 rounded font-semibold uppercase tracking-wide">
                        Not available for offline file uploads
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-zinc-500 uppercase tracking-widest mt-2 select-none">
            compatibility
          </div>
        </div>

        {/* Usernames & Entry Counts */}
        <div className="flex flex-col items-center justify-center mb-16">
          <div className="flex items-center justify-center gap-3 flex-wrap text-center px-4">
            <a
              href={payloadA.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {payloadA.username}
            </a>
            <span className="text-zinc-600">×</span>
            <a
              href={payloadB.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {payloadB.username}
            </a>
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            {payloadA.entries.length} entries &middot; {payloadB.entries.length} entries
          </div>
        </div>

        {/* Shared Library */}
        <div>
          <h2 className="text-lg font-medium text-zinc-300 mb-6">
            Shared Library <span className="text-zinc-600">{analytics.overlapping.length}</span>
          </h2>

          {sortedOverlaps.length === 0 ? (
            <p className="text-center text-zinc-600 py-16">No shared titles found.</p>
          ) : (
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-zinc-900">
                  <th
                    className="text-left py-3 font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center">
                      <span>Title</span>
                      {sortIndicator('title')}
                    </div>
                  </th>
                  <th
                    className="text-right py-3 font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors w-16 md:w-20"
                    onClick={() => handleSort('ratingA')}
                  >
                    <div className="flex items-center justify-end">
                      <span className="truncate max-w-[45px] sm:max-w-none" title={payloadA.username}>
                        {payloadA.username}
                      </span>
                      {sortIndicator('ratingA')}
                    </div>
                  </th>
                  <th
                    className="text-right py-3 font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors w-16 md:w-20"
                    onClick={() => handleSort('ratingB')}
                  >
                    <div className="flex items-center justify-end">
                      <span className="truncate max-w-[45px] sm:max-w-none" title={payloadB.username}>
                        {payloadB.username}
                      </span>
                      {sortIndicator('ratingB')}
                    </div>
                  </th>
                  <th
                    className="text-right py-3 font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors w-12 md:w-16"
                    onClick={() => handleSort('gap')}
                  >
                    <div className="flex items-center justify-end">
                      <span>Gap</span>
                      {sortIndicator('gap')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedOverlaps.map(overlap => (
                  <tr
                    key={overlap.itemA.external_id}
                    className="border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="py-3 text-zinc-200 pr-4 truncate max-w-0" title={overlap.itemA.title}>
                      {overlap.itemA.title}
                    </td>
                    <td className="py-3 text-right tabular-nums text-zinc-400">
                      {overlap.itemA.raw_rating > 0 ? overlap.itemA.raw_rating : '–'}
                    </td>
                    <td className="py-3 text-right tabular-nums text-zinc-400">
                      {overlap.itemB.raw_rating > 0 ? overlap.itemB.raw_rating : '–'}
                    </td>
                    <td className="py-3 text-right tabular-nums text-zinc-400">
                      {overlap.itemA.raw_rating > 0 && overlap.itemB.raw_rating > 0
                        ? Math.abs(overlap.itemA.raw_rating - overlap.itemB.raw_rating).toFixed(1)
                        : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Reset */}
        <div className="mt-20 text-center">
          <button
            onClick={onReset}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest"
          >
            Start over
          </button>
        </div>

      </div>
    </div>
  );
};
