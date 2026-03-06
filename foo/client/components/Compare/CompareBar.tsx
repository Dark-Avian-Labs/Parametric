import { useState } from 'react';

import { CompareModal } from './CompareModal';
import { useCompare } from '../../context/CompareContext';

function formatDps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function CompareBar() {
  const { snapshots, removeSnapshot, clearAll } = useCompare();
  const [showModal, setShowModal] = useState(false);

  if (snapshots.length === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[200] border-t border-glass-border bg-surface/95 backdrop-blur-md animate-slide-up">
        <div className="mx-auto flex max-w-[2000px] items-center gap-4 px-6 py-3">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">
            Compare
          </span>

          <div className="flex flex-1 items-center gap-3">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center gap-2 rounded-lg border border-glass-border bg-surface-modal px-3 py-2"
              >
                {snap.weaponImage && (
                  <img
                    src={`/images${snap.weaponImage}`}
                    alt={snap.weaponName}
                    className="h-8 w-8 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="min-w-0">
                  <div
                    className="truncate text-xs font-medium text-foreground"
                    style={{ maxWidth: 140 }}
                  >
                    {snap.label}
                  </div>
                  <div className="text-[10px] text-muted">
                    {snap.weaponName} ·{' '}
                    <span className="text-accent">
                      {formatDps(snap.calc.burstDps)} DPS
                    </span>
                  </div>
                </div>
                <button
                  className="ml-1 shrink-0 rounded p-0.5 text-muted hover:text-red-400 transition-colors"
                  onClick={() => removeSnapshot(snap.id)}
                  title="Remove from comparison"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {Array.from({ length: 3 - snapshots.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex h-[52px] w-32 items-center justify-center rounded-lg border border-dashed border-glass-border/50"
              >
                <span className="text-[10px] text-muted/40">Empty</span>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {snapshots.length >= 2 && (
              <button
                className="btn btn-accent text-sm"
                onClick={() => setShowModal(true)}
              >
                Compare {snapshots.length}
              </button>
            )}
            <button
              className="text-xs text-muted hover:text-red-400 transition-colors"
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        </div>
      </div>

      {showModal && <CompareModal onClose={() => setShowModal(false)} />}
    </>
  );
}
