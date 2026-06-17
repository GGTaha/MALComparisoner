import { useState, useRef, useEffect } from 'react';
import { purgeCachedUsers } from '../core/cache';
import type { HistoryItem } from '../core/cache';

interface LandingPageProps {
  onCheck: (platform: 'mal' | 'letterboxd' | 'trakt', userA: string | File, userB: string | File) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onCheck }) => {
  const [platform, setPlatform] = useState<'mal' | 'letterboxd' | 'trakt' | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('watch_overlap_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [userA, setUserA] = useState('');
  const [isFileA, setIsFileA] = useState(false);
  const [fileA, setFileA] = useState<File | null>(null);

  const [userB, setUserB] = useState('');
  const [isFileB, setIsFileB] = useState(false);
  const [fileB, setFileB] = useState<File | null>(null);

  const [isDragOverA, setIsDragOverA] = useState(false);
  const [isDragOverB, setIsDragOverB] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter.current++;
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setIsWindowDragging(false);
        }
      }
    };

    const handleDrop = () => {
      dragCounter.current = 0;
      setIsWindowDragging(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', preventDefault);
    };
  }, []);

  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  useEffect(() => {
    if (!platform) return;
    
    let accepted = '';
    if (platform === 'mal') accepted = '.xml';
    else if (platform === 'letterboxd') accepted = '.csv';
    else if (platform === 'trakt') accepted = '.json,.zip';
    
    if (fileA) {
      const extA = `.${fileA.name.split('.').pop()?.toLowerCase()}`;
      if (!accepted.split(',').includes(extA)) {
        setFileA(null);
        setErrorA(`File type doesn't match ${platform === 'mal' ? 'MyAnimeList' : platform === 'letterboxd' ? 'Letterboxd' : 'Trakt.tv'}`);
      }
    }
    
    if (fileB) {
      const extB = `.${fileB.name.split('.').pop()?.toLowerCase()}`;
      if (!accepted.split(',').includes(extB)) {
        setFileB(null);
        setErrorB(`File type doesn't match ${platform === 'mal' ? 'MyAnimeList' : platform === 'letterboxd' ? 'Letterboxd' : 'Trakt.tv'}`);
      }
    }
  }, [platform, fileA, fileB]);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (platform && isReady) {
      const inputA = isFileA ? fileA! : userA.trim();
      const inputB = isFileB ? fileB! : userB.trim();
      onCheck(platform, inputA, inputB);
    }
  };

  const handlePillClick = (item: HistoryItem) => {
    setUserA(item.userA);
    setIsFileA(false);
    setFileA(null);
    setUserB(item.userB);
    setIsFileB(false);
    setFileB(null);
    setPlatform(item.platform);
    setErrorA(null);
    setErrorB(null);
    onCheck(item.platform, item.userA, item.userB);
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    await purgeCachedUsers(item.platform, item.userA, item.userB);
    const updated = history.filter(h => h.id !== item.id);
    setHistory(updated);
    localStorage.setItem('watch_overlap_history', JSON.stringify(updated));
  };

  const getAcceptExtensions = () => {
    if (platform === 'mal') return '.xml';
    if (platform === 'letterboxd') return '.csv';
    if (platform === 'trakt') return '.json,.zip';
    return '';
  };

  const isReadyA = isFileA ? fileA !== null : userA.trim() !== '';
  const isReadyB = isFileB ? fileB !== null : userB.trim() !== '';
  const isReady = platform !== null && isReadyA && isReadyB;

  const handleFileSelected = (
    file: File, 
    setFileVal: (file: File | null) => void, 
    setIsFileMode: (val: boolean) => void,
    setErrorVal: (val: string | null) => void
  ) => {
    setErrorVal(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    let detectedPlatform: 'mal' | 'letterboxd' | 'trakt' | null = null;
    if (ext === 'xml') {
      detectedPlatform = 'mal';
    } else if (ext === 'csv') {
      detectedPlatform = 'letterboxd';
    } else if (ext === 'json' || ext === 'zip') {
      detectedPlatform = 'trakt';
    }

    if (detectedPlatform) {
      setPlatform(detectedPlatform);
      setFileVal(file);
      setIsFileMode(true);
    } else if (platform) {
      const accepted = getAcceptExtensions();
      const fileExt = `.${ext}`;
      if (accepted.split(',').includes(fileExt)) {
        setFileVal(file);
        setIsFileMode(true);
        return;
      }
      setErrorVal(`Invalid file: .${ext}. Must be ${accepted} for ${platform === 'mal' ? 'MyAnimeList' : platform === 'letterboxd' ? 'Letterboxd' : 'Trakt'}.`);
    } else {
      setErrorVal(`Unsupported file type: .${ext}. Drag a .xml, .csv, or .json/.zip file.`);
    }
  };

  const renderInputSide = (
    label: string,
    usernameVal: string,
    setUsername: (val: string) => void,
    isFileMode: boolean,
    setIsFileMode: (val: boolean) => void,
    fileVal: File | null,
    setFileVal: (file: File | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
    isDragOver: boolean,
    setIsDragOver: (val: boolean) => void,
    errorVal: string | null,
    setErrorVal: (val: string | null) => void
  ) => {
    return (
      <div className="flex-1 flex flex-col gap-2">
        {isFileMode ? (
          <div 
            className={`flex-1 flex flex-col items-center justify-center border border-dashed rounded cursor-pointer transition-all duration-300 relative px-4 text-center
              ${isDragOver 
                ? 'border-zinc-300 bg-zinc-800/80 scale-[1.02] min-h-[140px] shadow-lg shadow-black/40' 
                : isWindowDragging 
                  ? 'border-zinc-500 bg-zinc-900/80 min-h-[120px]' 
                  : 'border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50 min-h-[46px]'
              }`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
              setIsWindowDragging(false);
              dragCounter.current = 0;
              const file = e.dataTransfer.files?.[0];
              if (file) {
                handleFileSelected(file, setFileVal, setIsFileMode, setErrorVal);
              }
            }}
          >
            {isDragOver ? (
              <span className="text-sm font-medium text-zinc-200">Drop to upload</span>
            ) : fileVal ? (
              <span className="text-sm text-zinc-300 truncate px-2">{fileVal.name}</span>
            ) : (
              <div className="flex flex-col items-center gap-1 py-2">
                <span className="text-sm text-zinc-500 font-medium">
                  {isWindowDragging ? 'Drop file here' : 'Click or drag file here'}
                </span>
                {isWindowDragging && (
                  <span className="text-[10px] text-zinc-600">
                    Supports MAL XML, Letterboxd CSV, or Trakt JSON/ZIP
                  </span>
                )}
              </div>
            )}
            <input 
              type="file" 
              className="hidden" 
              ref={inputRef as React.RefObject<HTMLInputElement>}
              accept={getAcceptExtensions()}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f, setFileVal, setIsFileMode, setErrorVal);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <input
            type="text"
            placeholder={label}
            value={usernameVal}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrorVal(null);
            }}
            className="w-full bg-transparent border-b border-zinc-800 focus:border-zinc-500 
                       px-1 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 
                       outline-none transition-colors duration-200"
          />
        )}
        <div className="flex justify-between items-center px-1">
          <button 
            type="button" 
            onClick={() => {
              setIsFileMode(!isFileMode);
              setFileVal(null);
              setErrorVal(null);
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase tracking-wide transition-colors"
          >
            {isFileMode ? 'Use Username Instead' : 'Upload File Instead'}
          </button>
          {isFileMode && fileVal && (
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                setFileVal(null);
                setErrorVal(null);
              }}
              className="text-[10px] text-red-500 hover:text-red-400 uppercase tracking-wide transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {errorVal && (
          <div className="text-[10px] text-red-400 px-1 mt-1 leading-tight">{errorVal}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
      <div className="w-full max-w-md">
        {/* Title */}
        <h1 className="text-3xl font-semibold text-zinc-100 text-center">
          Watch Overlap
        </h1>
        <p className="text-sm text-zinc-500 text-center mt-2">
          Compare your libraries with your friends.
        </p>

        <form onSubmit={handleCheck} className="mt-12">
          {/* Platform selector */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <button
              type="button"
              onClick={() => setPlatform('mal')}
              className={`pb-2 text-sm font-medium transition-all duration-200 border-b-2 ${
                platform === 'mal'
                  ? 'text-zinc-100 border-zinc-100'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              MyAnimeList
            </button>
            <button
              type="button"
              onClick={() => setPlatform('letterboxd')}
              className={`pb-2 text-sm font-medium transition-all duration-200 border-b-2 ${
                platform === 'letterboxd'
                  ? 'text-zinc-100 border-zinc-100'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              Letterboxd
            </button>
            <button
              type="button"
              onClick={() => setPlatform('trakt')}
              className={`pb-2 text-sm font-medium transition-all duration-200 border-b-2 ${
                platform === 'trakt'
                  ? 'text-zinc-100 border-zinc-100'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              Trakt.tv
            </button>
          </div>

          {/* Inputs section */}
          <div className="flex flex-col md:flex-row md:items-start gap-4 mt-6">
            {renderInputSide(
              "First username", 
              userA, setUserA, 
              isFileA || isWindowDragging, setIsFileA, 
              fileA, setFileA, 
              fileInputARef,
              isDragOverA, setIsDragOverA,
              errorA, setErrorA
            )}
            
            <span className="text-xs text-zinc-600 self-center md:mt-4 select-none">vs</span>
            
            {renderInputSide(
              "Second username", 
              userB, setUserB, 
              isFileB || isWindowDragging, setIsFileB, 
              fileB, setFileB, 
              fileInputBRef,
              isDragOverB, setIsDragOverB,
              errorB, setErrorB
            )}
          </div>

          {/* Compare button */}
          <button
            type="submit"
            disabled={!isReady}
            className={`w-full mt-10 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              isReady
                ? 'bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.98]'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            Compare
          </button>
        </form>

        {history.length > 0 && (
          <div className="mt-10 w-full fade-in">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4 select-none text-center">
              Recent Comparisons
            </h3>
            <div className="flex flex-col gap-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePillClick(item)}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-900/60 hover:border-zinc-800 transition-all duration-200 cursor-pointer group"
                >
                  <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    <span className="text-zinc-500 font-semibold uppercase mr-1">
                      {item.platform === 'mal' ? 'MAL' : item.platform === 'letterboxd' ? 'Letterboxd' : 'Trakt'}
                    </span>
                    : {item.userA} <span className="text-zinc-600 px-1">×</span> {item.userB}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteHistoryItem(e, item)}
                    className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors duration-150 rounded"
                    title="Delete comparison"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
