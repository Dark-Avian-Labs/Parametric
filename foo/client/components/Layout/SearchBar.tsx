import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { buildNewPath } from '../../app/paths';
import { apiFetch } from '../../utils/api';

interface SearchResult {
  category: string;
  name: string;
  unique_name: string;
  image_path?: string;
  equipment_type?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const search = useCallback(
    debounce(async (term: string) => {
      abortControllerRef.current?.abort();

      if (!term || term.length < 2) {
        setLoading(false);
        setResults([]);
        setSearchError(null);
        setOpen(false);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setSearchError(null);
      try {
        const response = await apiFetch(
          `/api/search?q=${encodeURIComponent(term)}&limit=20`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { items?: SearchResult[] };
        const items = Array.isArray(body.items) ? body.items : [];
        if (controller.signal.aborted) return;
        setResults(items);
        setOpen(items.length > 0);
      } catch (e) {
        if (
          controller.signal.aborted ||
          (e instanceof DOMException && e.name === 'AbortError')
        ) {
          return;
        }
        console.error('Search request failed', e);
        setSearchError('Search failed');
        setResults([]);
        setOpen(true);
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    }, 300),
    [],
  );

  const handleSelect = (result: SearchResult) => {
    if (result.equipment_type) {
      navigate(buildNewPath(result.equipment_type, result.unique_name));
    }
    setQuery('');
    setOpen(false);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div ref={wrapperRef} className="relative">
      <div className="search-wrapper relative">
        <input
          type="text"
          className="search-box w-52"
          placeholder="Search…"
          aria-label="Search equipment"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg text-muted hover:text-foreground"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setResults([]);
              setSearchError(null);
              setOpen(false);
            }}
          >
            &times;
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-xl border border-glass-border bg-surface-modal shadow-lg backdrop-blur-xl">
          {loading ? (
            <div className="p-3 text-center text-sm text-muted">Searching…</div>
          ) : searchError ? (
            <div className="p-3 text-center text-sm text-muted">
              {searchError}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto custom-scroll">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-surface-modal/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60 backdrop-blur">
                    {category}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.unique_name}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-glass-hover hover:text-foreground"
                      onClick={() => handleSelect(item)}
                    >
                      {item.image_path && (
                        <img
                          src={`/images${item.image_path}`}
                          alt=""
                          className="h-7 w-7 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      )}
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
