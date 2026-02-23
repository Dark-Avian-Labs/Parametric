import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
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

  const search = useCallback(
    debounce(async (term: string) => {
      if (!term || term.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      try {
        const [wfRes, wpRes, compRes] = await Promise.all([
          fetch(`/api/warframes`).then((r) => r.json()),
          fetch(`/api/weapons`).then((r) => r.json()),
          fetch(`/api/companions`).then((r) => r.json()),
        ]);

        const lowerTerm = term.toLowerCase();
        const all: SearchResult[] = [];

        for (const item of (wfRes.items || []) as Array<{
          name: string;
          unique_name: string;
          image_path?: string;
          product_category?: string;
        }>) {
          if (item.name.toLowerCase().includes(lowerTerm)) {
            const cat = item.product_category || 'Warframes';
            let eqType = 'warframe';
            if (cat === 'Archwings') eqType = 'archwing';
            else if (cat === 'Necramechs') eqType = 'necramech';
            all.push({
              category: cat,
              name: item.name,
              unique_name: item.unique_name,
              image_path: item.image_path,
              equipment_type: eqType,
            });
          }
        }

        for (const item of (wpRes.items || []) as Array<{
          name: string;
          unique_name: string;
          image_path?: string;
          product_category?: string;
          slot?: number;
        }>) {
          if (item.name.toLowerCase().includes(lowerTerm)) {
            let eqType = 'primary';
            const cat = item.product_category || '';
            if (cat === 'Pistols') eqType = 'secondary';
            else if (cat === 'Melee') eqType = 'melee';
            else if (cat === 'SpaceGuns') eqType = 'archgun';
            else if (cat === 'SpaceMelee') eqType = 'archmelee';
            all.push({
              category: cat || 'Weapons',
              name: item.name,
              unique_name: item.unique_name,
              image_path: item.image_path,
              equipment_type: eqType,
            });
          }
        }

        for (const item of (compRes.items || []) as Array<{
          name: string;
          unique_name: string;
          image_path?: string;
        }>) {
          if (item.name.toLowerCase().includes(lowerTerm)) {
            all.push({
              category: 'Companions',
              name: item.name,
              unique_name: item.unique_name,
              image_path: item.image_path,
              equipment_type: 'companion',
            });
          }
        }

        setResults(all.slice(0, 20));
        setOpen(all.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [],
  );

  const handleSelect = (result: SearchResult) => {
    if (result.equipment_type) {
      navigate(
        `/builder/new/${result.equipment_type}/${encodeURIComponent(result.unique_name)}`,
      );
    }
    setQuery('');
    setOpen(false);
  };

  // Group results by category
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
          placeholder="Search..."
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
            onClick={() => {
              setQuery('');
              setResults([]);
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
            <div className="p-3 text-center text-sm text-muted">
              Searching...
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
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted transition-all hover:bg-glass-hover hover:text-foreground"
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
