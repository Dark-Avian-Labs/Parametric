import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { AbilityBar } from './AbilityBar';
import { ArcanePickerPanel } from './ArcanePickerPanel';
import { ArcaneSlots, type ArcaneSlot, type Arcane } from './ArcaneSlots';
import {
  ArchonShardSlots,
  type ShardSlotConfig,
  type ShardType,
} from './ArchonShardSlots';
import { CapacityBar } from './CapacityBar';
import { ElementOutput } from './ElementOutput';
import { FilterPanel } from './FilterPanel';
import { HelminthPickerPanel } from './HelminthPickerPanel';
import { ModSlotGrid } from './ModSlotGrid';
import { ShardPickerPanel } from './ShardPickerPanel';
import { StatsPanel } from './StatsPanel';
import { useCompare } from '../../context/CompareContext';
import { useApi } from '../../hooks/useApi';
import { useBuildStorage } from '../../hooks/useBuildStorage';
import {
  EQUIPMENT_SLOT_CONFIGS,
  POLARITIES,
  type Mod,
  type ModSlot,
  type Weapon,
  type Warframe,
  type Companion,
  type EquipmentType,
  type SlotType,
  type BuildConfig,
  type Ability,
  type PolarityKey,
} from '../../types/warframe';
import { getMaxRank } from '../../utils/arcaneUtils';
import { calculateBuildDamage } from '../../utils/damage';
import { calculateWeaponDps } from '../../utils/damageCalc';
import { calculateTotalCapacity } from '../../utils/drain';
import {
  calculateFormaCount,
  type FormaCount,
  type SlotPolarity,
} from '../../utils/formaCounter';
import { isModLockedOut } from '../../utils/modFiltering';

type RightPanelMode = 'mods' | 'helminth' | 'arcanes' | 'shards';

function getAbilityName(warframe: Warframe | null, index: number): string {
  if (!warframe?.abilities) return `Ability ${index + 1}`;
  try {
    const parsed = JSON.parse(warframe.abilities) as Array<{
      abilityName?: string;
      name?: string;
    }>;
    const ab = parsed[index];
    return ab?.abilityName || ab?.name || `Ability ${index + 1}`;
  } catch {
    return `Ability ${index + 1}`;
  }
}

type Equipment = Warframe | Weapon | Companion;

function getEquipmentListUrl(type: EquipmentType): string {
  switch (type) {
    case 'warframe':
      return '/api/warframes';
    case 'primary':
      return '/api/weapons?type=LongGuns';
    case 'secondary':
      return '/api/weapons?type=Pistols';
    case 'melee':
      return '/api/weapons?type=Melee';
    case 'archgun':
      return '/api/weapons?type=SpaceGuns';
    case 'archmelee':
      return '/api/weapons?type=SpaceMelee';
    case 'companion':
      return '/api/companions';
    case 'archwing':
      return '/api/warframes';
    case 'necramech':
      return '/api/warframes';
    default:
      return '/api/warframes';
  }
}

export function ModBuilder() {
  const {
    buildId,
    equipmentType: routeEqType,
    equipmentId,
  } = useParams<{
    buildId?: string;
    equipmentType?: string;
    equipmentId?: string;
  }>();
  const navigate = useNavigate();
  const { saveBuild: storageSave, getBuild } = useBuildStorage();

  const [equipmentType, setEquipmentType] = useState<EquipmentType>(
    (routeEqType as EquipmentType) || 'warframe',
  );
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  );
  const [slots, setSlots] = useState<ModSlot[]>([]);
  const [orokinReactor, setOrokinReactor] = useState(false);
  const [buildName, setBuildName] = useState('New Build');
  const [currentBuildId, setCurrentBuildId] = useState<string | undefined>(
    buildId,
  );
  const [helminthConfig, setHelminthConfig] = useState<
    BuildConfig['helminth'] | undefined
  >();
  const [activeSlotType, setActiveSlotType] = useState<SlotType | undefined>();
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [arcaneSlots, setArcaneSlots] = useState<ArcaneSlot[]>([
    { rank: 0 },
    { rank: 0 },
  ]);
  const [shardSlots, setShardSlots] = useState<ShardSlotConfig[]>(
    Array.from({ length: 5 }, () => ({ tauforged: false })),
  );
  const [formaMode, setFormaMode] = useState(false);
  const [defaultPolarities, setDefaultPolarities] = useState<SlotPolarity[]>(
    [],
  );
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('mods');
  const [activeAbilityIndex, setActiveAbilityIndex] = useState<number | null>(
    null,
  );
  const [activeArcaneSlot, setActiveArcaneSlot] = useState<number | null>(null);
  const [activeShardSlot, setActiveShardSlot] = useState<number | null>(null);

  const routeKey = `${buildId ?? ''}|${routeEqType ?? ''}|${equipmentId ?? ''}`;
  const prevRouteKey = useRef(routeKey);
  useEffect(() => {
    if (prevRouteKey.current === routeKey) return;
    prevRouteKey.current = routeKey;
    setSelectedEquipment(null);
    setSlots([]);
    setOrokinReactor(false);
    setBuildName('New Build');
    setCurrentBuildId(buildId);
    setHelminthConfig(undefined);
    setActiveSlotType(undefined);
    setActiveSlotIndex(undefined);
    setLoaded(false);
    setArcaneSlots([{ rank: 0 }, { rank: 0 }]);
    setShardSlots(Array.from({ length: 5 }, () => ({ tauforged: false })));
    setFormaMode(false);
    setDefaultPolarities([]);
    setRightPanelMode('mods');
    setActiveAbilityIndex(null);
    setActiveArcaneSlot(null);
    setActiveShardSlot(null);
    if (routeEqType) setEquipmentType(routeEqType as EquipmentType);
  }, [routeKey, buildId, routeEqType]);

  const apiUrl = getEquipmentListUrl(equipmentType);
  const { data: equipmentData } = useApi<{ items: Equipment[] }>(apiUrl);

  const { data: shardData } = useApi<{ shards: ShardType[] }>(
    '/api/archon-shards',
  );
  const shardTypes = shardData?.shards || [];

  const { addSnapshot, snapshots: compareSnapshots } = useCompare();

  useEffect(() => {
    if (loaded) return;

    if (buildId) {
      const stored = getBuild(buildId);
      if (stored) {
        setEquipmentType(stored.equipment_type);
        setBuildName(stored.name);
        setCurrentBuildId(stored.id);
        setHelminthConfig(stored.helminth);
        if (stored.arcaneSlots)
          setArcaneSlots(stored.arcaneSlots as ArcaneSlot[]);
        if (stored.shardSlots)
          setShardSlots(stored.shardSlots as ShardSlotConfig[]);
        if (stored.orokinReactor !== undefined)
          setOrokinReactor(stored.orokinReactor);
      }
    } else if (routeEqType && equipmentId) {
      setEquipmentType(routeEqType as EquipmentType);
    }
  }, [buildId, routeEqType, equipmentId, getBuild, loaded]);

  useEffect(() => {
    if (!equipmentData?.items?.length) return;

    if (buildId && !loaded) {
      const stored = getBuild(buildId);
      if (stored) {
        const item = equipmentData.items.find(
          (i) => i.unique_name === stored.equipment_unique_name,
        );
        if (item) {
          setSelectedEquipment(item);
          setLoaded(true);
        }
      }
    } else if (equipmentId && !loaded) {
      const decodedId = decodeURIComponent(equipmentId);
      const item = equipmentData.items.find((i) => i.unique_name === decodedId);
      if (item) {
        setSelectedEquipment(item);
        setLoaded(true);
      }
    }
  }, [equipmentData, buildId, equipmentId, getBuild, loaded]);

  useEffect(() => {
    if (!loaded || !buildId) return;
    const stored = getBuild(buildId);
    if (stored?.slots?.length) {
      setSlots(stored.slots);
    }
  }, [loaded, buildId, getBuild]);

  const equippedMods = useMemo(
    () => slots.filter((s) => s.mod).map((s) => s.mod!),
    [slots],
  );

  useEffect(() => {
    if (!selectedEquipment) {
      setSlots([]);
      return;
    }

    if (buildId && slots.length > 0) return;
    if (buildId) return;

    const config =
      EQUIPMENT_SLOT_CONFIGS[equipmentType] || EQUIPMENT_SLOT_CONFIGS.warframe;
    const newSlots: ModSlot[] = [];
    let idx = 0;

    const artifactSlots: string[] = (() => {
      try {
        const eq = selectedEquipment as Warframe & Weapon & Companion;
        return eq.artifact_slots ? JSON.parse(eq.artifact_slots) : [];
      } catch {
        return [];
      }
    })();

    const polarityFromAP = (ap: string | undefined): string | undefined => {
      if (!ap || ap === 'AP_UNIVERSAL') return undefined;
      return (POLARITIES as Record<string, string>)[ap as PolarityKey]
        ? ap
        : undefined;
    };

    const hasArtifactSlots = artifactSlots.length > 0;

    if (config.hasAura) {
      const warframe = selectedEquipment as Warframe;
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[8])
        : warframe.aura_polarity || undefined;
      newSlots.push({ index: idx++, type: 'aura', polarity: pol });
    }
    if (config.hasStance) {
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[8])
        : undefined;
      newSlots.push({ index: idx++, type: 'stance', polarity: pol });
    }
    if (config.hasPosture) {
      newSlots.push({ index: idx++, type: 'posture' });
    }

    const generalPolarities: (string | undefined)[] = (() => {
      if (hasArtifactSlots) {
        const slotRange = artifactSlots.slice(0, config.generalSlots);
        return slotRange.reverse().map(polarityFromAP);
      }
      try {
        const wf = selectedEquipment as Warframe;
        const parsed: string[] = wf.polarities ? JSON.parse(wf.polarities) : [];
        return parsed;
      } catch {
        return [];
      }
    })();

    for (let i = 0; i < config.generalSlots; i++) {
      newSlots.push({
        index: idx++,
        type: 'general',
        polarity: generalPolarities[i] || undefined,
      });
    }

    if (config.hasExilus) {
      const warframe = selectedEquipment as Warframe;
      const pol = hasArtifactSlots
        ? polarityFromAP(artifactSlots[9])
        : warframe.exilus_polarity || undefined;
      newSlots.push({ index: idx++, type: 'exilus', polarity: pol });
    }

    setSlots(newSlots);
    setDefaultPolarities(
      newSlots.map((s) => ({ polarity: s.polarity, type: s.type })),
    );
    setHelminthConfig(undefined);
  }, [selectedEquipment, equipmentType, buildId, slots.length]);

  const canPlaceModInSlot = (mod: Mod, slotType: ModSlot['type']): boolean => {
    const modType = (mod.type || '').toUpperCase();
    if (slotType === 'aura' && modType !== 'AURA') return false;
    if (slotType === 'stance' && modType !== 'STANCE') return false;
    if (slotType === 'exilus' && mod.is_utility !== 1) return false;
    if (slotType === 'general' || slotType === 'posture') {
      if (modType === 'AURA' || modType === 'STANCE') return false;
    }
    return true;
  };

  const [searchResetKey, setSearchResetKey] = useState(0);

  const handleModDrop = useCallback((slotIndex: number, mod: Mod) => {
    setSlots((prev) => {
      const targetSlot = prev.find((s) => s.index === slotIndex);
      if (!targetSlot) return prev;

      if (!canPlaceModInSlot(mod, targetSlot.type)) return prev;

      const currentMods = prev
        .filter((s) => s.mod && s.index !== slotIndex)
        .map((s) => s.mod!);

      if (isModLockedOut(mod, currentMods)) {
        return prev;
      }

      return prev.map((s) =>
        s.index === slotIndex
          ? {
              ...s,
              mod,
              rank: mod.fusion_limit ?? 0,
              setRank: mod.set_stats ? 1 : undefined,
            }
          : s,
      );
    });
    setSearchResetKey((k) => k + 1);
  }, []);

  const handleSetRankChange = useCallback(
    (slotIndex: number, setRank: number) => {
      setSlots((prev) =>
        prev.map((s) => (s.index === slotIndex ? { ...s, setRank } : s)),
      );
    },
    [],
  );

  const handleModSwap = useCallback(
    (sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex) return;

      setSlots((prev) => {
        const source = prev.find((s) => s.index === sourceIndex);
        const target = prev.find((s) => s.index === targetIndex);
        if (!source || !target || !source.mod) return prev;

        const sourceMod = source.mod;
        const sourceRank = source.rank;
        const sourceSetRank = source.setRank;
        const targetMod = target.mod;
        const targetRank = target.rank;
        const targetSetRank = target.setRank;

        if (!canPlaceModInSlot(sourceMod, target.type)) return prev;

        if (targetMod && !canPlaceModInSlot(targetMod, source.type))
          return prev;

        const otherMods = prev
          .filter(
            (s) => s.mod && s.index !== sourceIndex && s.index !== targetIndex,
          )
          .map((s) => s.mod!);

        if (
          isModLockedOut(sourceMod, [
            ...otherMods,
            ...(targetMod ? [targetMod] : []),
          ])
        )
          return prev;

        if (targetMod && isModLockedOut(targetMod, [...otherMods, sourceMod]))
          return prev;

        return prev.map((s) => {
          if (s.index === targetIndex)
            return {
              ...s,
              mod: sourceMod,
              rank: sourceRank,
              setRank: sourceSetRank,
            };
          if (s.index === sourceIndex)
            return {
              ...s,
              mod: targetMod,
              rank: targetRank,
              setRank: targetSetRank,
            };
          return s;
        });
      });
    },
    [],
  );

  const handleModRemove = useCallback((slotIndex: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.index === slotIndex
          ? { ...s, mod: undefined, rank: undefined, setRank: undefined }
          : s,
      ),
    );
  }, []);

  const handleRankChange = useCallback((slotIndex: number, rank: number) => {
    setSlots((prev) =>
      prev.map((s) => (s.index === slotIndex ? { ...s, rank } : s)),
    );
  }, []);

  const capacity = useMemo(
    () => calculateTotalCapacity(slots, 30, orokinReactor),
    [slots, orokinReactor],
  );

  const formaCost = useMemo<FormaCount>(
    () =>
      calculateFormaCount(
        defaultPolarities,
        slots.map((s) => ({ polarity: s.polarity, type: s.type })),
      ),
    [defaultPolarities, slots],
  );

  const handlePolarityChange = useCallback(
    (slotIndex: number, polarity: string | undefined) => {
      setSlots((prev) =>
        prev.map((s) => (s.index === slotIndex ? { ...s, polarity } : s)),
      );
    },
    [],
  );

  const handleArcaneSlotClick = useCallback(
    (slotIndex: number) => {
      if (activeArcaneSlot === slotIndex && rightPanelMode === 'arcanes') {
        setActiveArcaneSlot(null);
        setRightPanelMode('mods');
      } else {
        setActiveArcaneSlot(slotIndex);
        setActiveShardSlot(null);
        setActiveAbilityIndex(null);
        setActiveSlotIndex(undefined);
        setActiveSlotType(undefined);
        setRightPanelMode('arcanes');
      }
    },
    [activeArcaneSlot, rightPanelMode],
  );

  const handleArcaneSelect = useCallback(
    (arcane: Arcane) => {
      if (activeArcaneSlot === null) return;
      setArcaneSlots((prev) => {
        const next = [...prev];
        next[activeArcaneSlot] = { arcane, rank: getMaxRank(arcane) };
        return next;
      });
      setActiveArcaneSlot(null);
      setRightPanelMode('mods');
    },
    [activeArcaneSlot],
  );

  const handleArcaneRemove = useCallback((slotIndex: number) => {
    setArcaneSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { rank: 0 };
      return next;
    });
  }, []);

  const handleArcaneRankChange = useCallback(
    (slotIndex: number, rank: number) => {
      setArcaneSlots((prev) => {
        const next = [...prev];
        if (next[slotIndex]) {
          next[slotIndex] = { ...next[slotIndex], rank };
        }
        return next;
      });
    },
    [],
  );

  const handleShardSlotClick = useCallback(
    (slotIndex: number) => {
      if (activeShardSlot === slotIndex && rightPanelMode === 'shards') {
        setActiveShardSlot(null);
        setRightPanelMode('mods');
      } else {
        setActiveShardSlot(slotIndex);
        setActiveArcaneSlot(null);
        setActiveAbilityIndex(null);
        setActiveSlotIndex(undefined);
        setActiveSlotType(undefined);
        setRightPanelMode('shards');
      }
    },
    [activeShardSlot, rightPanelMode],
  );

  const handleShardSelect = useCallback(
    (shardTypeId: string, buffId: number, tauforged: boolean) => {
      if (activeShardSlot === null) return;
      setShardSlots((prev) => {
        const next = [...prev];
        next[activeShardSlot] = {
          shard_type_id: shardTypeId,
          buff_id: buffId,
          tauforged,
        };
        return next;
      });
      setActiveShardSlot(null);
      setRightPanelMode('mods');
    },
    [activeShardSlot],
  );

  const handleShardRemove = useCallback((slotIndex: number) => {
    setShardSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { tauforged: false };
      return next;
    });
  }, []);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  const [saveToast, setSaveToast] = useState(false);

  const openSaveModal = () => {
    if (!selectedEquipment) return;
    setSaveModalName(buildName);
    setShowSaveModal(true);
  };

  const [compareToast, setCompareToast] = useState(false);
  const addToCompare = () => {
    if (!selectedEquipment || equipmentType === 'warframe') return;
    const weapon = selectedEquipment as Weapon;
    const calc = calculateWeaponDps(weapon, slots);
    const { totalDamage, damageBreakdown } = calculateBuildDamage(
      weapon,
      slots,
    );
    addSnapshot({
      id: crypto.randomUUID(),
      label: buildName,
      weaponName: weapon.name,
      weaponImage: weapon.image_path,
      equipmentType,
      calc,
      elementBreakdown: damageBreakdown,
      totalElementDamage: totalDamage,
      timestamp: Date.now(),
    });
    setCompareToast(true);
    setTimeout(() => setCompareToast(false), 1500);
  };

  const confirmSave = () => {
    if (!selectedEquipment) return;

    const finalName = saveModalName.trim() || buildName;
    setBuildName(finalName);

    const config: BuildConfig = {
      id: currentBuildId,
      name: finalName,
      equipment_type: equipmentType,
      equipment_unique_name: selectedEquipment.unique_name,
      slots,
      helminth: helminthConfig,
      arcaneSlots,
      shardSlots,
      orokinReactor,
    };

    const imagePath = selectedEquipment.image_path
      ? `/images${selectedEquipment.image_path}`
      : undefined;

    const saved = storageSave(config, selectedEquipment.name, imagePath);
    setCurrentBuildId(saved.id);
    setShowSaveModal(false);

    if (!buildId) {
      navigate(`/builder/${saved.id}`, { replace: true });
    }

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const arcaneSlotCount = equipmentType === 'warframe' ? 2 : 1;

  const hasSelection =
    activeSlotIndex !== undefined ||
    activeArcaneSlot !== null ||
    activeShardSlot !== null ||
    activeAbilityIndex !== null;

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.glass-panel, button, input, [role="button"], [draggable="true"]',
      )
    )
      return;
    setActiveSlotIndex(undefined);
    setActiveSlotType(undefined);
    setActiveArcaneSlot(null);
    setActiveShardSlot(null);
    setActiveAbilityIndex(null);
    setRightPanelMode('mods');
  }, []);

  return (
    <div
      className="mx-auto flex max-w-[2000px] gap-6"
      onClick={hasSelection ? handleBackgroundClick : undefined}
    >
      {/* Left panel: stats + damage output */}
      <div className="w-72 shrink-0 space-y-4">
        {selectedEquipment && (
          <StatsPanel
            equipment={selectedEquipment as Warframe | Weapon}
            type={equipmentType}
            slots={equipmentType !== 'warframe' ? slots : undefined}
            abilities={
              equipmentType === 'warframe' ? (
                <AbilityBar
                  warframe={selectedEquipment as Warframe}
                  helminthConfig={helminthConfig}
                  onHelminthChange={setHelminthConfig}
                  activeAbilityIndex={activeAbilityIndex}
                  onAbilityClick={(index) => {
                    if (
                      activeAbilityIndex === index &&
                      rightPanelMode === 'helminth'
                    ) {
                      setActiveAbilityIndex(null);
                      setRightPanelMode('mods');
                    } else {
                      setActiveAbilityIndex(index);
                      setActiveArcaneSlot(null);
                      setActiveShardSlot(null);
                      setActiveSlotIndex(undefined);
                      setActiveSlotType(undefined);
                      setRightPanelMode('helminth');
                    }
                  }}
                />
              ) : undefined
            }
          />
        )}
        {selectedEquipment && equipmentType !== 'warframe' && (
          <ElementOutput weapon={selectedEquipment as Weapon} slots={slots} />
        )}
      </div>

      {/* Center: mod grid — fixed width to fit 4-col slot grid */}
      <div className="w-[820px] shrink-0 space-y-4">
        {/* Build header */}
        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-foreground">
              {buildName}
            </span>
            {selectedEquipment && (
              <span className="text-sm text-muted">
                {selectedEquipment.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={orokinReactor}
                onChange={(e) => setOrokinReactor(e.target.checked)}
                className="accent-accent"
              />
              Orokin Reactor
            </label>
            {equipmentType !== 'warframe' && (
              <button
                className="btn border border-glass-border text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-40"
                onClick={addToCompare}
                disabled={compareSnapshots.length >= 3}
                title={
                  compareSnapshots.length >= 3
                    ? 'Max 3 snapshots'
                    : 'Add current build to comparison'
                }
              >
                Compare
              </button>
            )}
            <button className="btn btn-accent" onClick={openSaveModal}>
              Save
            </button>
          </div>
        </div>

        {/* Capacity bar */}
        <CapacityBar
          capacity={capacity}
          formaCost={formaCost}
          formaMode={formaMode}
          onFormaToggle={() => setFormaMode((p) => !p)}
        />

        {/* Mod slots */}
        {selectedEquipment ? (
          <ModSlotGrid
            slots={slots}
            onDrop={handleModDrop}
            onSwap={handleModSwap}
            onRemove={handleModRemove}
            onRankChange={handleRankChange}
            onSetRankChange={handleSetRankChange}
            activeSlotIndex={activeSlotIndex}
            onSlotClick={(slotIndex, slotType) => {
              if (activeSlotIndex === slotIndex) {
                setActiveSlotType(undefined);
                setActiveSlotIndex(undefined);
              } else {
                setActiveSlotType(slotType);
                setActiveSlotIndex(slotIndex);
              }
              setRightPanelMode('mods');
              setActiveAbilityIndex(null);
              setActiveArcaneSlot(null);
              setActiveShardSlot(null);
            }}
            formaMode={formaMode}
            onPolarityChange={handlePolarityChange}
            equipmentType={equipmentType}
          />
        ) : (
          <div className="glass-panel flex h-64 items-center justify-center">
            <p className="text-muted">Loading equipment...</p>
          </div>
        )}

        {/* Arcane slots + Archon Shards in one panel, side by side */}
        {selectedEquipment && (
          <div className="glass-panel flex items-start justify-between overflow-visible p-3">
            <ArcaneSlots
              slotCount={arcaneSlotCount}
              slots={arcaneSlots}
              activeSlot={activeArcaneSlot}
              onSlotClick={handleArcaneSlotClick}
              onRankChange={handleArcaneRankChange}
              onRemove={handleArcaneRemove}
              onDrop={(slotIndex, arcane) => {
                setArcaneSlots((prev) => {
                  const next = [...prev];
                  next[slotIndex] = { arcane, rank: getMaxRank(arcane) };
                  return next;
                });
              }}
            />
            {equipmentType === 'warframe' && (
              <ArchonShardSlots
                slots={shardSlots}
                shards={shardTypes}
                activeSlot={activeShardSlot}
                onSlotClick={handleShardSlotClick}
                onRemove={handleShardRemove}
              />
            )}
          </div>
        )}
      </div>

      {/* Right panel: mod filter, helminth, arcane, or shard picker — expands to fill */}
      <div className="min-w-[440px] flex-1">
        {/* FilterPanel stays mounted, hidden when other panels are active */}
        <div className={rightPanelMode !== 'mods' ? 'hidden' : ''}>
          <FilterPanel
            active={rightPanelMode === 'mods'}
            searchResetKey={searchResetKey}
            equipmentType={equipmentType}
            equipment={
              selectedEquipment
                ? {
                    unique_name: selectedEquipment.unique_name,
                    name: selectedEquipment.name,
                    product_category: (selectedEquipment as Weapon)
                      .product_category,
                  }
                : undefined
            }
            equippedMods={equippedMods}
            targetSlotType={activeSlotType}
            onModRemove={() => {
              if (activeSlotIndex !== undefined) {
                handleModRemove(activeSlotIndex);
              }
            }}
            onModSelect={(mod) => {
              const modType = (mod.type || '').toUpperCase();
              let emptySlot;

              if (activeSlotType) {
                emptySlot = slots.find(
                  (s) => !s.mod && s.type === activeSlotType,
                );
              } else if (modType === 'AURA') {
                emptySlot = slots.find((s) => !s.mod && s.type === 'aura');
              } else if (modType === 'STANCE') {
                emptySlot = slots.find((s) => !s.mod && s.type === 'stance');
              } else if (mod.is_utility === 1) {
                emptySlot = slots.find((s) => !s.mod && s.type === 'exilus');
                if (!emptySlot) {
                  emptySlot = slots.find((s) => !s.mod && s.type === 'general');
                }
              } else {
                emptySlot = slots.find((s) => !s.mod && s.type === 'general');
              }

              if (emptySlot) {
                handleModDrop(emptySlot.index, mod);
              }
            }}
          />
        </div>

        {rightPanelMode === 'helminth' && activeAbilityIndex !== null && (
          <HelminthPickerPanel
            replacingAbilityName={getAbilityName(
              selectedEquipment as Warframe,
              activeAbilityIndex,
            )}
            onSelect={(ability: Ability) => {
              setHelminthConfig({
                replaced_ability_index: activeAbilityIndex,
                replacement_ability_unique_name: ability.unique_name,
              });
              setActiveAbilityIndex(null);
              setRightPanelMode('mods');
            }}
            onRestore={() => {
              setHelminthConfig(undefined);
              setActiveAbilityIndex(null);
              setRightPanelMode('mods');
            }}
            onClose={() => {
              setActiveAbilityIndex(null);
              setRightPanelMode('mods');
            }}
          />
        )}

        {rightPanelMode === 'arcanes' && activeArcaneSlot !== null && (
          <ArcanePickerPanel
            currentArcaneName={arcaneSlots[activeArcaneSlot]?.arcane?.name}
            onSelect={handleArcaneSelect}
            onRemove={() => {
              handleArcaneRemove(activeArcaneSlot);
              setActiveArcaneSlot(null);
              setRightPanelMode('mods');
            }}
            onClose={() => {
              setActiveArcaneSlot(null);
              setRightPanelMode('mods');
            }}
          />
        )}

        {rightPanelMode === 'shards' && activeShardSlot !== null && (
          <ShardPickerPanel
            shards={shardTypes}
            currentSlot={shardSlots[activeShardSlot] || { tauforged: false }}
            onSelect={handleShardSelect}
            onRemove={() => {
              handleShardRemove(activeShardSlot);
              setActiveShardSlot(null);
              setRightPanelMode('mods');
            }}
            onClose={() => {
              setActiveShardSlot(null);
              setRightPanelMode('mods');
            }}
          />
        )}
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="w-96 rounded-xl border border-glass-border bg-surface-modal p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Save Build
            </h3>
            <label className="mb-1 block text-xs text-muted">Build Name</label>
            <input
              type="text"
              value={saveModalName}
              onChange={(e) => setSaveModalName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
              className="form-input mb-4 w-full"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button className="btn btn-accent" onClick={confirmSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save toast */}
      {saveToast && (
        <div
          className={`fixed left-1/2 z-[9999] -translate-x-1/2 rounded-lg border border-accent/30 bg-accent-weak/90 px-5 py-2.5 text-sm font-medium text-accent shadow-lg backdrop-blur transition-all ${compareSnapshots.length > 0 ? 'bottom-24' : 'bottom-6'}`}
        >
          Build saved successfully
        </div>
      )}
      {compareToast && (
        <div
          className={`fixed left-1/2 z-[9999] -translate-x-1/2 rounded-lg border border-accent/30 bg-accent-weak/90 px-5 py-2.5 text-sm font-medium text-accent shadow-lg backdrop-blur transition-all ${compareSnapshots.length > 0 ? 'bottom-24' : 'bottom-6'}`}
        >
          Added to comparison ({compareSnapshots.length}/3)
        </div>
      )}
    </div>
  );
}
