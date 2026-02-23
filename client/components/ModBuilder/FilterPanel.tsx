import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react';

import { RivenBuilder, type RivenConfig } from './RivenBuilder';
import { useApi } from '../../hooks/useApi';
import type { Mod, ModRarity, EquipmentType } from '../../types/warframe';
import { filterCompatibleMods, isModLockedOut } from '../../utils/modFiltering';
import { ModCard, CardPreview, DEFAULT_LAYOUT } from '../ModCard';

interface FilterPanelProps {
  equipmentType: EquipmentType;
  equipment?: { unique_name: string; name: string; product_category?: string };
  equippedMods: Mod[];
  onModSelect: (mod: Mod) => void;
  onModRemove?: () => void;
  onRivenAdd?: (config: RivenConfig) => void;
  targetSlotType?: 'general' | 'aura' | 'stance' | 'exilus' | 'posture';
  active?: boolean;
  searchResetKey?: number;
}

function getModTypes(eqType: EquipmentType): string {
  switch (eqType) {
    case 'warframe':
      return 'WARFRAME,AURA';
    case 'primary':
      return 'PRIMARY';
    case 'secondary':
      return 'SECONDARY';
    case 'melee':
      return 'MELEE,STANCE';
    case 'companion':
      return 'SENTINEL,KAVAT,KUBROW,HELMINTH CHARGER';
    case 'archgun':
      return 'ARCH-GUN';
    case 'archmelee':
      return 'ARCH-MELEE';
    case 'archwing':
      return 'ARCHWING';
    case 'necramech':
      return '---';
    case 'kdrive':
      return '---';
    default:
      return 'WARFRAME';
  }
}

const RARITIES: { value: ModRarity | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'COMMON', label: 'Common' },
  { value: 'UNCOMMON', label: 'Uncommon' },
  { value: 'RARE', label: 'Rare' },
  { value: 'LEGENDARY', label: 'Legendary' },
];

export function FilterPanel({
  equipmentType,
  equipment,
  equippedMods,
  onModSelect,
  onModRemove,
  onRivenAdd,
  targetSlotType,
  active = true,
  searchResetKey = 0,
}: FilterPanelProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (searchResetKey > 0) setSearch('');
  }, [searchResetKey]);
  const [rarity, setRarity] = useState<ModRarity | 'ALL'>('ALL');
  const [expandMods, setExpandMods] = useState(false);
  const [showLockedOut, setShowLockedOut] = useState(false);
  const [showRivenBuilder, setShowRivenBuilder] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const [cardScale, setCardScale] = useState<number>(0);

  const measure = useCallback(() => {
    if (!gridRef.current) return;
    const width = gridRef.current.clientWidth;
    if (width > 0) {
      setCardScale(width / (4 * DEFAULT_LAYOUT.cardWidth));
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (!gridRef.current) return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(measure);
    }
  }, [active, measure]);

  const modTypes = getModTypes(equipmentType);
  const { data, loading } = useApi<{ items: Mod[] }>(
    `/api/mods?types=${encodeURIComponent(modTypes)}`,
  );
  const allMods = data?.items || [];

  const { compatible, lockedOut } = useMemo(() => {
    const compatMods = filterCompatibleMods(allMods, equipmentType, equipment);

    let slotFiltered = compatMods;
    if (targetSlotType === 'aura') {
      slotFiltered = compatMods.filter(
        (m) => (m.type || '').toUpperCase() === 'AURA',
      );
    } else if (targetSlotType === 'stance') {
      slotFiltered = compatMods.filter(
        (m) => (m.type || '').toUpperCase() === 'STANCE',
      );
    } else if (targetSlotType === 'exilus') {
      slotFiltered = compatMods.filter(
        (m) => m.is_utility === 1 || (m.type || '').toUpperCase() === 'AURA',
      );
    } else if (targetSlotType) {
      slotFiltered = compatMods.filter((m) => {
        const t = (m.type || '').toUpperCase();
        return t !== 'AURA' && t !== 'STANCE';
      });
    }

    const textFiltered = slotFiltered.filter((mod) => {
      if (rarity !== 'ALL' && mod.rarity !== rarity) return false;
      if (search && !mod.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });

    const available: Mod[] = [];
    const locked: Mod[] = [];
    for (const mod of textFiltered) {
      if (isModLockedOut(mod, equippedMods)) {
        locked.push(mod);
      } else {
        available.push(mod);
      }
    }

    return { compatible: available, lockedOut: locked };
  }, [
    allMods,
    equipmentType,
    equipment,
    equippedMods,
    targetSlotType,
    rarity,
    search,
  ]);

  const displayMods = showLockedOut
    ? [...compatible, ...lockedOut]
    : compatible;

  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Mods</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={showLockedOut}
              onChange={(e) => setShowLockedOut(e.target.checked)}
              className="accent-accent"
            />
            Show locked
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={expandMods}
              onChange={(e) => setExpandMods(e.target.checked)}
              className="accent-accent"
            />
            Expand
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Search mods..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input w-full pr-8"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-xs text-muted transition-colors hover:bg-glass-hover hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Rarity filter */}
      <div className="mb-3 flex flex-wrap gap-1">
        {RARITIES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRarity(r.value)}
            className={`rounded-lg px-2 py-1 text-xs transition-all ${
              rarity === r.value
                ? 'bg-accent-weak text-accent'
                : 'text-muted hover:bg-glass-hover hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Mod count */}
      <div className="mb-2 text-xs text-muted">
        {compatible.length} available
        {lockedOut.length > 0 && (
          <span className="ml-1 text-warning">
            ({lockedOut.length} locked out)
          </span>
        )}
        {(search || rarity !== 'ALL') && ' (filtered)'}
      </div>

      {/* Riven button */}
      {['primary', 'secondary', 'melee', 'archgun'].includes(equipmentType) && (
        <button
          onClick={() => setShowRivenBuilder(true)}
          className="mb-2 w-full rounded-lg border border-riven/30 bg-riven/5 px-3 py-1.5 text-xs text-riven-light transition-all hover:bg-riven/10"
        >
          + Add Riven Mod
        </button>
      )}

      {/* Slot type indicator */}
      {targetSlotType && targetSlotType !== 'general' && (
        <div className="mb-2 rounded-md bg-accent-weak/20 px-2 py-1 text-xs text-accent">
          Showing {targetSlotType} mods
        </div>
      )}

      {/* Mod grid */}
      <div className="max-h-[calc(100vh-420px)] overflow-y-auto custom-scroll">
        {loading && <p className="text-sm text-muted">Loading mods...</p>}
        {!loading && displayMods.length === 0 && (
          <p className="text-sm text-muted">
            {allMods.length === 0
              ? 'No mods in database. Import and process data first.'
              : 'No mods match the current filters.'}
          </p>
        )}
        <div ref={gridRef} className="grid grid-cols-4">
          {cardScale > 0 && !loading && displayMods.length > 0 && (
            <>
              {/* Empty / Remove option — only shown when NOT searching */}
              {!search && (
                <div
                  onClick={onModRemove}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({ __remove: true }),
                    );
                    e.dataTransfer.effectAllowed = 'move';
                    const el = e.currentTarget;
                    const clone = el.cloneNode(true) as HTMLElement;
                    clone.style.position = 'fixed';
                    clone.style.top = '-9999px';
                    clone.style.left = '-9999px';
                    clone.style.zIndex = '-1';
                    clone.style.pointerEvents = 'none';
                    document.body.appendChild(clone);
                    const rect = el.getBoundingClientRect();
                    e.dataTransfer.setDragImage(
                      clone,
                      rect.width / 2,
                      rect.height / 2,
                    );
                    requestAnimationFrame(() =>
                      document.body.removeChild(clone),
                    );
                  }}
                  className="cursor-grab"
                >
                  <CardPreview
                    layout={{ ...DEFAULT_LAYOUT, scale: cardScale }}
                    rarity="Empty"
                    polarity=""
                    modArt=""
                    modName="Remove"
                    modType=""
                    modDescription=""
                    drain={0}
                    rank={0}
                    maxRank={0}
                    collapsed={!expandMods}
                  />
                </div>
              )}
              {displayMods.map((mod) => {
                const locked = lockedOut.includes(mod);
                return (
                  <ModPickerCard
                    key={mod.unique_name}
                    mod={mod}
                    locked={locked}
                    expanded={expandMods}
                    scale={cardScale}
                    onClick={() => {
                      if (!locked) {
                        onModSelect(mod);
                        setSearch('');
                      }
                    }}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Riven Builder modal */}
      {showRivenBuilder && (
        <RivenBuilder
          availableStats={getRivenStatsForType(equipmentType)}
          onSave={(config) => {
            onRivenAdd?.(config);
            setShowRivenBuilder(false);
          }}
          onClose={() => setShowRivenBuilder(false)}
        />
      )}
    </div>
  );
}

function ModPickerCard({
  mod,
  locked,
  expanded,
  scale,
  onClick,
}: {
  mod: Mod;
  locked: boolean;
  expanded: boolean;
  scale: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <ModCard
        mod={mod}
        rank={mod.fusion_limit ?? 0}
        draggable={!locked}
        lockedOut={locked}
        scale={scale}
        collapsed={!expanded}
      />
    </div>
  );
}

function getRivenStatsForType(type: EquipmentType): string[] {
  const common = [
    'Damage',
    'Multishot',
    'Critical Chance',
    'Critical Damage',
    'Status Chance',
    'Status Duration',
    'Fire Rate',
    'Magazine Capacity',
    'Reload Speed',
    'Ammo Maximum',
  ];

  const ranged = [
    ...common,
    'Flight Speed',
    'Recoil',
    'Zoom',
    'Impact',
    'Puncture',
    'Slash',
    'Heat',
    'Cold',
    'Electricity',
    'Toxin',
  ];

  const melee = [
    'Damage',
    'Critical Chance',
    'Critical Damage',
    'Status Chance',
    'Status Duration',
    'Attack Speed',
    'Range',
    'Combo Duration',
    'Initial Combo',
    'Slide Critical Chance',
    'Finisher Damage',
    'Impact',
    'Puncture',
    'Slash',
    'Heat',
    'Cold',
    'Electricity',
    'Toxin',
  ];

  switch (type) {
    case 'melee':
      return melee;
    case 'primary':
    case 'secondary':
    case 'archgun':
    default:
      return ranged;
  }
}
