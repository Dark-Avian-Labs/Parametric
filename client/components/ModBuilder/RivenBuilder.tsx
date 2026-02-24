import { useState } from 'react';

export interface RivenStat {
  stat: string;
  value: number;
  isNegative: boolean;
}

export interface RivenConfig {
  positive: RivenStat[];
  negative?: RivenStat;
}

interface RivenBuilderProps {
  availableStats: string[];
  config?: RivenConfig;
  onSave: (config: RivenConfig) => void;
  onClose: () => void;
}

export function RivenBuilder({
  availableStats,
  config,
  onSave,
  onClose,
}: RivenBuilderProps) {
  const [positive, setPositive] = useState<RivenStat[]>(
    config?.positive?.length
      ? config.positive
      : [{ stat: '', value: 0, isNegative: false }],
  );
  const [negative, setNegative] = useState<RivenStat | undefined>(
    config?.negative,
  );
  const [hasNegative, setHasNegative] = useState(!!config?.negative);

  const selectedStats = [
    ...positive.map((p) => p.stat),
    ...(negative ? [negative.stat] : []),
  ].filter(Boolean);

  const getFilteredStats = (currentStat: string) => {
    return availableStats.filter(
      (s) => s === currentStat || !selectedStats.includes(s),
    );
  };

  const addPositive = () => {
    if (positive.length < 4) {
      setPositive([...positive, { stat: '', value: 0, isNegative: false }]);
    }
  };

  const removePositive = (idx: number) => {
    if (positive.length > 1) {
      setPositive(positive.filter((_, i) => i !== idx));
    }
  };

  const updatePositive = (
    idx: number,
    key: keyof RivenStat,
    value: string | number,
  ) => {
    const next = [...positive];
    if (key === 'stat') next[idx] = { ...next[idx], stat: value as string };
    else if (key === 'value')
      next[idx] = { ...next[idx], value: value as number };
    setPositive(next);
  };

  const handleSave = () => {
    const validPositive = positive.filter((p) => p.stat);
    if (validPositive.length === 0) return;

    onSave({
      positive: validPositive,
      negative: hasNegative && negative?.stat ? negative : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal max-w-lg"
        style={{ width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Riven Builder
          </h3>
          <button
            className="text-lg text-muted hover:text-foreground"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-riven bg-glass p-4">
          <div className="mb-2 text-center text-sm font-semibold text-riven-light">
            Riven Mod
          </div>
          <div className="space-y-1 text-xs">
            {positive
              .filter((p) => p.stat)
              .map((p, i) => (
                <div key={i} className="text-success">
                  +{p.value} {p.stat}
                </div>
              ))}
            {hasNegative && negative?.stat && (
              <div className="text-danger">
                -{negative.value} {negative.stat}
              </div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold text-muted">
              Positive Stats ({positive.length}/4)
            </label>
            {positive.length < 4 && (
              <button
                onClick={addPositive}
                className="text-xs text-accent hover:text-accent/80"
              >
                + Add
              </button>
            )}
          </div>
          <div className="space-y-2">
            {positive.map((stat, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={stat.stat}
                  onChange={(e) => updatePositive(i, 'stat', e.target.value)}
                  className="form-input flex-1 text-xs"
                >
                  <option value="">Select stat...</option>
                  {getFilteredStats(stat.stat).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={stat.value}
                  onChange={(e) =>
                    updatePositive(i, 'value', parseFloat(e.target.value) || 0)
                  }
                  className="form-input w-20 text-xs"
                  step="0.1"
                />
                {positive.length > 1 && (
                  <button
                    onClick={() => removePositive(i)}
                    className="text-xs text-danger hover:text-danger/80"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={hasNegative}
              onChange={(e) => {
                setHasNegative(e.target.checked);
                if (!e.target.checked) setNegative(undefined);
                else setNegative({ stat: '', value: 0, isNegative: true });
              }}
              className="accent-danger"
            />
            <span className="font-semibold">Negative Stat</span>
          </label>
          {hasNegative && (
            <div className="flex items-center gap-2">
              <select
                value={negative?.stat || ''}
                onChange={(e) =>
                  setNegative({
                    stat: e.target.value,
                    value: negative?.value || 0,
                    isNegative: true,
                  })
                }
                className="form-input flex-1 text-xs"
              >
                <option value="">Select stat...</option>
                {getFilteredStats(negative?.stat || '').map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={negative?.value || 0}
                onChange={(e) =>
                  setNegative({
                    stat: negative?.stat || '',
                    value: parseFloat(e.target.value) || 0,
                    isNegative: true,
                  })
                }
                className="form-input w-20 text-xs"
                step="0.1"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary text-xs" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent text-xs"
            onClick={handleSave}
            disabled={positive.every((p) => !p.stat)}
          >
            Apply Riven
          </button>
        </div>
      </div>
    </div>
  );
}
