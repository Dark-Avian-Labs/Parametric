import { useMemo, useState } from 'react';

import {
  AP_ATTACK,
  AP_DEFENSE,
  AP_TACTIC,
  POLARITIES,
  type RivenConfig,
  type RivenStat,
  type RivenWeaponType,
} from '../../types/warframe';
import {
  buildRivenDescription,
  normalizeRivenValue,
  validateRivenConfig,
} from '../../utils/riven';

interface RivenBuilderProps {
  availableStats: string[];
  weaponType: RivenWeaponType;
  config?: RivenConfig;
  onSave: (config: RivenConfig) => void;
  onClose: () => void;
}

export function RivenBuilder({
  availableStats,
  weaponType,
  config,
  onSave,
  onClose,
}: RivenBuilderProps) {
  const initialRows = useMemo<RivenStat[]>(() => {
    const p = config?.positive ?? [];
    const n = config?.negative;
    return [
      { stat: p[0]?.stat ?? '', value: p[0]?.value ?? 0, isNegative: false },
      { stat: p[1]?.stat ?? '', value: p[1]?.value ?? 0, isNegative: false },
      { stat: p[2]?.stat ?? '', value: p[2]?.value ?? 0, isNegative: false },
      { stat: n?.stat ?? '', value: n?.value ?? 0, isNegative: true },
    ];
  }, [config]);

  const [rows, setRows] = useState<RivenStat[]>(initialRows);
  const [polarity, setPolarity] = useState<RivenConfig['polarity']>(
    config?.polarity ?? AP_ATTACK,
  );
  const [error, setError] = useState<string>('');

  const selectedStats = rows.map((r) => r.stat).filter(Boolean);

  const getFilteredStats = (currentStat: string) =>
    availableStats.filter(
      (s) => s === currentStat || !selectedStats.includes(s),
    );

  const updateRow = (
    idx: number,
    key: keyof RivenStat,
    value: string | number,
  ) => {
    const next = [...rows];
    if (key === 'stat') next[idx] = { ...next[idx], stat: value as string };
    else if (key === 'value')
      next[idx] = { ...next[idx], value: value as number };
    setRows(next);
  };

  const normalizeRowValue = (idx: number) => {
    const row = rows[idx];
    if (!row || !row.stat) return;
    const normalized = normalizeRivenValue(
      row.value,
      row.stat,
      weaponType,
      row.isNegative,
    );
    const next = [...rows];
    next[idx] = { ...row, value: normalized };
    setRows(next);
  };

  const handleSave = () => {
    const normalized = rows.map((row) => {
      if (!row.stat) return row;
      return {
        ...row,
        value: normalizeRivenValue(
          row.value,
          row.stat,
          weaponType,
          row.isNegative,
        ),
      };
    });
    setRows(normalized);

    const configToSave: RivenConfig = {
      polarity,
      positive: normalized
        .slice(0, 3)
        .filter((r) => r.stat)
        .map((r) => ({ ...r, isNegative: false })),
      negative: normalized[3]?.stat
        ? { ...normalized[3], isNegative: true }
        : undefined,
    };

    const validationError = validateRivenConfig(configToSave);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    onSave(configToSave);
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted">Polarity</span>
            <div className="flex items-center gap-1.5">
              {[
                {
                  key: AP_ATTACK,
                  icon: 'madurai',
                  label: POLARITIES.AP_ATTACK,
                },
                {
                  key: AP_TACTIC,
                  icon: 'naramon',
                  label: POLARITIES.AP_TACTIC,
                },
                {
                  key: AP_DEFENSE,
                  icon: 'vazarin',
                  label: POLARITIES.AP_DEFENSE,
                },
              ].map((p) => {
                const active = polarity === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPolarity(p.key)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-all ${
                      active
                        ? 'border-accent bg-accent-weak'
                        : 'border-glass-border bg-glass-hover hover:border-glass-border-hover'
                    }`}
                    title={p.label}
                    aria-label={p.label}
                    aria-pressed={active}
                  >
                    <img
                      src={`/icons/polarity/${p.icon}.svg`}
                      alt={p.label}
                      className="h-4 w-4"
                      style={{
                        filter: active
                          ? 'brightness(0) invert(0.5) sepia(1) saturate(5) hue-rotate(85deg)'
                          : 'brightness(0) invert(1)',
                      }}
                      draggable={false}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1 text-xs whitespace-pre-line">
            {buildRivenDescription({
              positive: rows
                .slice(0, 3)
                .filter((r) => r.stat)
                .map((r) => ({ ...r, isNegative: false })),
              negative: rows[3]?.stat
                ? { ...rows[3], isNegative: true }
                : undefined,
            }) || 'Select at least two positive stats'}
          </div>
        </div>

        <div className="mb-4">
          <div className="space-y-2">
            {rows.map((stat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`w-16 text-xs font-semibold ${
                    stat.isNegative ? 'text-danger' : 'text-success'
                  }`}
                >
                  {stat.isNegative ? 'Negative' : `Positive ${i + 1}`}
                </span>
                <select
                  value={stat.stat}
                  onChange={(e) => updateRow(i, 'stat', e.target.value)}
                  className="form-input riven-select flex-1 text-xs"
                >
                  <option value="">None</option>
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
                    updateRow(i, 'value', parseFloat(e.target.value) || 0)
                  }
                  onBlur={() => normalizeRowValue(i)}
                  className="form-input w-20 text-xs"
                  step="0.1"
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary text-xs" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent text-xs"
            onClick={handleSave}
            disabled={rows.slice(0, 3).every((p) => !p.stat)}
          >
            Apply Riven
          </button>
        </div>
      </div>
    </div>
  );
}
