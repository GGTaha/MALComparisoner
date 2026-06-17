import { useState } from 'react';
import { LandingPage } from './views/LandingPage';
import { LoadingPage } from './views/LoadingPage';
import { ResultsPage } from './views/ResultsPage';
import type { PlatformPayload, NormalizedItem } from './core/types';
import { getCached, setCached, saveToHistory } from './core/cache';
import { runAnalytics } from './core/analytics';
import type { AnalyticsResult } from './core/analytics';
import { parseMALXML, parseLetterboxdCSV, parseTraktJSON } from './core/parsers';

type AppState = 'landing' | 'loading' | 'results' | 'error';

function App() {
  const [view, setView] = useState<AppState>('landing');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [errorText, setErrorText] = useState('');
  
  const [payloadA, setPayloadA] = useState<PlatformPayload | null>(null);
  const [payloadB, setPayloadB] = useState<PlatformPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);

  const fetchUser = async (platform: string, username: string): Promise<PlatformPayload> => {
    // Check cache first
    const cached = await getCached(platform, username);
    if (cached) return cached;

    // Fetch from backend
    // Uses relative path to support both local Vite proxy and Vercel production deployment
    const res = await fetch(`/api/fetch/${platform}/${username}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail?.message || 'Failed to fetch user data');
    }
    const data: PlatformPayload = await res.json();
    await setCached(platform, username, data);
    return data;
  };

  const resolveInput = async (
    platform: 'mal' | 'letterboxd' | 'trakt',
    input: string | File
  ): Promise<PlatformPayload> => {
    if (typeof input === 'string') {
      return fetchUser(platform, input);
    } else {
      let entries: NormalizedItem[] = [];
      if (platform === 'mal') {
        entries = await parseMALXML(input);
      } else if (platform === 'letterboxd') {
        entries = await parseLetterboxdCSV(input);
      } else if (platform === 'trakt') {
        entries = await parseTraktJSON(input);
      }
      return {
        username: input.name.split('.')[0] || 'Local File',
        platform: platform,
        domain: platform === 'mal' ? 'anime' : platform === 'letterboxd' ? 'movie' : 'tv',
        profile_url: '#',
        entries: entries
      };
    }
  };

  const handleCheck = async (platform: 'mal' | 'letterboxd' | 'trakt', userA: string | File, userB: string | File) => {
    setView('loading');
    setLoadingProgress(10);
    setLoadingText('Initializing fetch...');
    setErrorText('');

    try {
      const nameA = typeof userA === 'string' ? userA : userA.name;
      const nameB = typeof userB === 'string' ? userB : userB.name;

      setLoadingText(`Resolving data for ${nameA} and ${nameB}...`);
      
      const [dataA, dataB] = await Promise.all([
        resolveInput(platform, userA).then(res => {
          setLoadingProgress(p => Math.max(p, 45));
          return res;
        }),
        resolveInput(platform, userB).then(res => {
          setLoadingProgress(p => Math.max(p, 80));
          return res;
        })
      ]);

      setLoadingText('Calculating compatibility...');
      // Allow UI to update before blocking math
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = runAnalytics(dataA, dataB);
      
      setPayloadA(dataA);
      setPayloadB(dataB);
      setAnalytics(result);
      setLoadingProgress(100);

      if (typeof userA === 'string' && typeof userB === 'string') {
        saveToHistory(platform, userA, userB);
      }
      
      setTimeout(() => setView('results'), 300); // small delay for full bar
    } catch (error: any) {
      setErrorText(error.message);
      setView('error');
    }
  };

  const handleReset = () => {
    setView('landing');
    setPayloadA(null);
    setPayloadB(null);
    setAnalytics(null);
  };

  return (
    <>
      {/* ── Header ── */}
      {view !== 'landing' && (
        <header className="w-full max-w-2xl mx-auto px-4 pt-8">
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-100 tracking-widest uppercase transition-colors duration-200"
            >
              Watch Overlap
            </button>
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
            >
              New Search
            </button>
          </div>
        </header>
      )}

      {/* ── Page content ── */}
      <main>
        {view === 'landing' && <LandingPage onCheck={handleCheck} />}
        {view === 'loading' && <LoadingPage progress={loadingProgress} statusText={loadingText} />}
        {view === 'error' && (
          <div className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
            <p className="text-sm text-zinc-500 mb-4">{errorText}</p>
            <button
              onClick={handleReset}
              className="text-sm text-zinc-400 hover:text-zinc-100 underline underline-offset-4 transition-colors duration-200"
            >
              Try again
            </button>
          </div>
        )}
        {view === 'results' && payloadA && payloadB && analytics && (
          <ResultsPage 
            payloadA={payloadA} 
            payloadB={payloadB} 
            analytics={analytics} 
            onReset={handleReset} 
          />
        )}
      </main>
    </>
  );
}

export default App;
