import type { ValenceBonus, ValenceDamageType } from '../../types/warframe';
import { VALENCE_DAMAGE_TYPES } from '../../types/warframe';
import { getElementColor } from '../../utils/elements';

const VALENCE_ICONS: Record<ValenceDamageType, string> = {
  Impact: '01_impact',
  Heat: '04_heat',
  Cold: '05_cold',
  Electricity: '06_electricity',
  Toxin: '07_toxin',
  Magnetic: '11_magnetic',
  Radiation: '09_radiation',
};

const DEFAULT_PERCENT = 55;
const MIN_P = 25;
const MAX_P = 60;

interface ValenceBonusPanelProps {
  value: ValenceBonus | null;
  onChange: (next: ValenceBonus | null) => void;
}

export function ValenceBonusPanel({ value, onChange }: ValenceBonusPanelProps) {
  const selectElement = (element: ValenceDamageType) => {
    onChange({
      element,
      percent: value?.percent ?? DEFAULT_PERCENT,
    });
  };

  const setPercent = (raw: number) => {
    if (!value) return;
    const percent = Math.min(MAX_P, Math.max(MIN_P, Math.round(raw)));
    onChange({ ...value, percent });
  };

  return (
    <div className="glass-panel p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-muted text-sm font-semibold tracking-wider uppercase">
            Valence bonus
          </h3>
          <p className="text-muted/80 mt-0.5 text-[10px] leading-snug">
            Progenitor damage (25–60% of base). Treated as weapon base damage for mod scaling.
          </p>
        </div>
        {value ? (
          <button
            type="button"
            className="text-muted hover:text-foreground shrink-0 text-[10px] font-medium uppercase underline-offset-2 hover:underline"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {VALENCE_DAMAGE_TYPES.map((el) => {
          const active = value?.element === el;
          const color = getElementColor(el);
          const icon = VALENCE_ICONS[el];
          return (
            <button
              key={el}
              type="button"
              title={el}
              onClick={() => selectElement(el)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                active
                  ? 'border-accent bg-accent/15 ring-accent/40 ring-1'
                  : 'border-white/10 bg-black/20 hover:border-white/25'
              }`}
            >
              {icon ? (
                <img
                  src={`/icons/elements/${icon}.png`}
                  alt=""
                  className="h-5 w-5 object-contain"
                  draggable={false}
                />
              ) : (
                <span className="text-[10px] font-bold" style={{ color }}>
                  ?
                </span>
              )}
            </button>
          );
        })}
      </div>

      {value ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase">
            <span className="text-muted">Bonus amount</span>
            <span className="text-foreground font-semibold tabular-nums">{value.percent}%</span>
          </div>
          <input
            type="range"
            min={MIN_P}
            max={MAX_P}
            step={1}
            value={value.percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="accent-accent h-2 w-full cursor-pointer"
            aria-label="Valence bonus percent"
          />
        </div>
      ) : (
        <p className="text-muted mt-2 text-center text-[10px]">
          Select an element to model bonus damage.
        </p>
      )}
    </div>
  );
}
