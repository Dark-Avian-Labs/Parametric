import { toPng } from 'html-to-image';
import { useMemo, useRef, useState } from 'react';

import type { EquipmentType, ModSlot, Warframe, Weapon } from '../../types/warframe';
import { getMaxRank } from '../../utils/arcaneUtils';
import { extractArchonShardBonuses } from '../../utils/archonShardBonuses';
import { formatPercent } from '../../utils/damage';
import { calculateWeaponDps } from '../../utils/damageCalc';
import { formatShardBuffDescription } from '../../utils/shardBuffFormat';
import { calculateWarframeStats } from '../../utils/warframeCalc';
import type { ArcaneSlot } from '../ModBuilder/ArcaneSlots';
import type { ShardSlotConfig, ShardType } from '../ModBuilder/ArchonShardSlots';
import { ArcaneCardPreview } from '../ModCard/ArcaneCardPreview';
import { DEFAULT_ARCANE_LAYOUT, normalizeArcaneRarity } from '../ModCard/cardLayout';
import { ModCard } from '../ModCard/ModCard';
import { Modal } from '../ui/Modal';

type ShareAspect = 'wide' | 'portrait';

interface BuildShareModalProps {
  open: boolean;
  onClose: () => void;
  buildName: string;
  equipment: Warframe | Weapon;
  equipmentName: string;
  equipmentType: EquipmentType;
  equipmentImagePath?: string;
  slots: ModSlot[];
  arcaneSlots: ArcaneSlot[];
  shardSlots: ShardSlotConfig[];
  shardTypes: ShardType[];
  orokinReactor: boolean;
}

function formatEquipmentType(type: EquipmentType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function sanitizeFileBaseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

function abilityBarPct(modded: number): number {
  return Math.min(100, Math.max(4, (modded / 280) * 100));
}

function ratioBarPct(base: number, modded: number): number {
  if (!Number.isFinite(base) || base <= 0) return Math.min(100, Math.max(4, modded > 0 ? 60 : 4));
  const r = modded / base;
  return Math.min(100, Math.max(4, (r / 2.5) * 100));
}

function ShareStatBar({
  label,
  display,
  fillPct,
}: {
  label: string;
  display: string;
  fillPct: number;
}) {
  const w = Math.round(Math.min(100, Math.max(0, fillPct)));
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-[11px]">
        <span className="text-[#a8b8e8]">{label}</span>
        <span className="shrink-0 font-medium text-[#f0f4ff]">{display}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#5b7cff] to-[#46d6be]"
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

function ShareShardStrip({ slots, shards }: { slots: ShardSlotConfig[]; shards: ShardType[] }) {
  const V_OFFSETS = [0, 10, 20, 10, 0];

  const buffLines: { key: string; name: string; tau: boolean; buff: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const slot = slots[i] ?? { tauforged: false };
    if (!slot.shard_type_id) continue;
    const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
    if (!shard) continue;
    const buff = shard.buffs.find((b) => String(b.id) === String(slot.buff_id));
    const buffText = formatShardBuffDescription(buff, slot.tauforged === true);
    buffLines.push({
      key: `shard-${i}-${String(slot.shard_type_id)}`,
      name: shard.name,
      tau: slot.tauforged === true,
      buff: buffText,
    });
  }

  return (
    <div>
      <div className="flex items-start justify-end gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const slot = slots[i] ?? { tauforged: false };
          const vOffset = V_OFFSETS[i];
          if (!slot.shard_type_id) {
            return (
              <div
                key={i}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={{ marginTop: vOffset }}
              >
                <img
                  src="/icons/shards/emptyBackground.png"
                  alt=""
                  className="invert-on-light absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            );
          }
          const shard = shards.find((s) => String(s.id) === String(slot.shard_type_id));
          if (!shard) {
            return (
              <div
                key={i}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10"
                style={{ marginTop: vOffset }}
              />
            );
          }
          const iconPath = slot.tauforged ? shard.tauforged_icon_path : shard.icon_path;
          return (
            <div
              key={i}
              className="relative flex h-11 w-11 shrink-0 flex-col items-center"
              style={{ marginTop: vOffset }}
            >
              <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg">
                <img
                  src="/icons/shards/filledBackground.png"
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover ${slot.tauforged ? 'archon-shard-filled-bg--tau' : 'invert-on-light'}`}
                  draggable={false}
                />
                <img
                  src={iconPath}
                  alt=""
                  className="invert-on-light absolute inset-0 h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            </div>
          );
        })}
      </div>
      {buffLines.length > 0 ? (
        <ul className="mt-2.5 space-y-1 border-t border-white/10 pt-2.5 text-left">
          {buffLines.map((line) => (
            <li key={line.key} className="text-[10px] leading-snug text-[#d6e0ff]">
              <span className="font-semibold text-[#f0f4ff]">{line.name}</span>
              {line.tau ? (
                <span className="ml-1 text-[9px] tracking-wide text-cyan-200/90 uppercase">
                  Tau
                </span>
              ) : null}
              {line.buff ? <span className="text-[#b6c5ed]"> — {line.buff}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BuildShareModal({
  open,
  onClose,
  buildName,
  equipment,
  equipmentName,
  equipmentType,
  equipmentImagePath,
  slots,
  arcaneSlots,
  shardSlots,
  shardTypes,
  orokinReactor,
}: BuildShareModalProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>('');
  const [bgOpacity, setBgOpacity] = useState(36);
  const [bgScale, setBgScale] = useState(1);
  const [aspect, setAspect] = useState<ShareAspect>('wide');
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWarframe = equipmentType === 'warframe';
  const warframeCalc = useMemo(() => {
    if (!isWarframe) return null;
    const bonuses = extractArchonShardBonuses(shardSlots, shardTypes);
    return calculateWarframeStats(equipment as Warframe, slots, bonuses);
  }, [equipment, isWarframe, shardSlots, shardTypes, slots]);

  const weaponCalc = useMemo(() => {
    if (isWarframe) return null;
    try {
      return calculateWeaponDps(equipment as Weapon, slots);
    } catch {
      return null;
    }
  }, [equipment, isWarframe, slots]);

  const equippedSlots = useMemo(() => slots.filter((s) => s.mod), [slots]);
  const filledArcanes = useMemo(() => arcaneSlots.filter((s) => s.arcane), [arcaneSlots]);

  async function handleUploadChange(file: File | null): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setBgDataUrl(dataUrl);
      setUploadName(file.name);
    } catch {
      setError('Could not read that image file.');
    }
  }

  async function handleExport(): Promise<void> {
    if (!exportRef.current) return;
    setIsRendering(true);
    setError(null);
    try {
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        canvasWidth,
        canvasHeight,
        backgroundColor: '#090d18',
      });
      const a = document.createElement('a');
      const fileBase = sanitizeFileBaseName(`${equipmentName}-${buildName || 'build'}-${aspect}`);
      a.href = dataUrl;
      a.download = `${fileBase || 'parametric-build-share'}.png`;
      a.click();
    } catch (renderError) {
      console.error('[BuildShareModal] Failed to render share image', renderError);
      setError('Failed to export image. If this persists, try removing the background image.');
    } finally {
      setIsRendering(false);
    }
  }

  if (!open) return null;

  const isWide = aspect === 'wide';
  const canvasWidth = isWide ? 1600 : 1080;
  const canvasHeight = isWide ? 900 : 1350;
  const modScale = isWide ? 0.36 : 0.42;
  const arcaneScale = isWide ? 0.42 : 0.48;

  const shardSummary = {
    filled: shardSlots.filter((s) => s.shard_type_id != null).length,
    tau: shardSlots.filter((s) => s.shard_type_id != null && s.tauforged).length,
  };

  return (
    <Modal open onClose={onClose} ariaLabelledBy="share-build-title" className="max-w-[1120px]">
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <section className="space-y-4">
          <h3 id="share-build-title" className="text-foreground text-lg font-semibold">
            Export Share Image
          </h3>
          <p className="text-muted text-sm">
            Your uploaded image stays local in the browser and is only used for this rendered
            export.
          </p>

          <div className="glass-panel space-y-3 p-3">
            <p className="text-muted text-xs tracking-[0.16em] uppercase">Frame Preset</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn ${aspect === 'wide' ? 'btn-accent' : 'btn-secondary'} flex-1`}
                onClick={() => setAspect('wide')}
              >
                Wide
              </button>
              <button
                type="button"
                className={`btn ${aspect === 'portrait' ? 'btn-accent' : 'btn-secondary'} flex-1`}
                onClick={() => setAspect('portrait')}
              >
                Portrait
              </button>
            </div>
          </div>

          <div className="glass-panel space-y-3 p-3">
            <p className="text-muted text-xs tracking-[0.16em] uppercase">Partial Background</p>
            <input
              type="file"
              accept="image/*"
              className="form-input"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                void handleUploadChange(file);
              }}
            />
            {uploadName ? (
              <p className="text-muted text-xs">Using: {uploadName}</p>
            ) : (
              <p className="text-muted text-xs">Optional image behind build details.</p>
            )}
            <label className="text-muted block text-xs">
              Opacity: {bgOpacity}%
              <input
                type="range"
                min={10}
                max={85}
                value={bgOpacity}
                onChange={(event) => setBgOpacity(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-muted block text-xs">
              Scale: {bgScale.toFixed(2)}x
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.01}
                value={bgScale}
                onChange={(event) => setBgScale(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            {bgDataUrl ? (
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => {
                  setBgDataUrl(null);
                  setUploadName('');
                }}
              >
                Remove Background Image
              </button>
            ) : null}
          </div>

          {error ? <p className="error-msg">{error}</p> : null}

          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-accent flex-1"
              onClick={() => {
                void handleExport();
              }}
              disabled={isRendering}
            >
              {isRendering ? 'Rendering...' : 'Export PNG'}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-muted text-xs tracking-[0.16em] uppercase">
            Preview ({canvasWidth} × {canvasHeight}) — scroll if clipped
          </div>
          <div className="max-h-[min(720px,82vh)] w-full overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
            <div
              ref={exportRef}
              style={{ width: canvasWidth, height: canvasHeight }}
              className="relative flex shrink-0 flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#090d18] text-[#edf2ff]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(120,154,255,0.35),transparent_38%),radial-gradient(circle_at_85%_78%,rgba(70,214,190,0.24),transparent_45%),linear-gradient(130deg,#0a1020_0%,#12172d_45%,#090d18_100%)]" />
              {bgDataUrl ? (
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                  style={{ opacity: bgOpacity / 100 }}
                >
                  <img
                    src={bgDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ transform: `scale(${bgScale})` }}
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(9,13,24,0.82),rgba(9,13,24,0.35),rgba(9,13,24,0.55))]" />
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_25%,transparent_70%,rgba(0,0,0,0.44)_100%)]" />

              <div className="relative z-10 flex min-h-0 flex-1 flex-col px-8 pt-8 pb-5">
                <div className="flex shrink-0 items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] tracking-[0.22em] text-[#b7c7ff]/90 uppercase">
                      Parametric Build Export
                    </p>
                    <h4 className="mt-1 text-[40px] leading-[1.05] font-semibold tracking-tight">
                      {buildName}
                    </h4>
                    <p className="mt-2 text-[17px] text-[#c9d6ff]">
                      {equipmentName} · {formatEquipmentType(equipmentType)}
                    </p>
                  </div>
                  <div className="glass-panel shrink-0 overflow-hidden rounded-2xl border border-white/18 bg-white/5 p-1">
                    <div
                      className={`flex items-center justify-center overflow-hidden rounded-xl bg-black/30 ${isWide ? 'h-36 w-36' : 'h-40 w-40'}`}
                    >
                      {equipmentImagePath ? (
                        <img
                          src={equipmentImagePath}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-white/60">
                          No Art
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isWide ? (
                  <div className="mt-6 grid min-h-0 flex-1 grid-cols-12 gap-5">
                    <div className="glass-panel col-span-7 flex min-h-0 flex-col rounded-2xl border border-white/12 bg-black/22 p-4">
                      <p className="mb-3 shrink-0 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                        Equipped Mods ({equippedSlots.length})
                      </p>
                      <div className="flex min-h-0 flex-wrap content-start gap-x-2 gap-y-2">
                        {equippedSlots.map((slot) => (
                          <ModCard
                            key={`${slot.index}-${slot.mod?.unique_name ?? 'm'}`}
                            mod={slot.mod!}
                            rank={slot.rank ?? 0}
                            setRank={slot.setRank}
                            slotType={slot.type}
                            slotPolarity={slot.polarity}
                            collapsed
                            scale={modScale}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="col-span-5 flex min-h-0 flex-col gap-4">
                      <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                        <p className="mb-3 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                          {isWarframe ? 'Frame & ability stats' : 'Weapon stats'}
                        </p>
                        <div className="space-y-2.5">
                          {isWarframe && warframeCalc ? (
                            <>
                              <ShareStatBar
                                label="Health"
                                display={`${warframeCalc.health.modded.toFixed(0)}`}
                                fillPct={ratioBarPct(
                                  warframeCalc.health.base,
                                  warframeCalc.health.modded,
                                )}
                              />
                              <ShareStatBar
                                label="Armor"
                                display={`${warframeCalc.armor.modded.toFixed(0)}`}
                                fillPct={ratioBarPct(
                                  warframeCalc.armor.base,
                                  warframeCalc.armor.modded,
                                )}
                              />
                              <ShareStatBar
                                label="Energy"
                                display={`${warframeCalc.energy.modded.toFixed(0)}`}
                                fillPct={ratioBarPct(
                                  warframeCalc.energy.base,
                                  warframeCalc.energy.modded,
                                )}
                              />
                              <ShareStatBar
                                label="Strength"
                                display={`${warframeCalc.abilityStrength.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityStrength.modded)}
                              />
                              <ShareStatBar
                                label="Duration"
                                display={`${warframeCalc.abilityDuration.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityDuration.modded)}
                              />
                              <ShareStatBar
                                label="Efficiency"
                                display={`${warframeCalc.abilityEfficiency.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityEfficiency.modded)}
                              />
                              <ShareStatBar
                                label="Range"
                                display={`${warframeCalc.abilityRange.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityRange.modded)}
                              />
                            </>
                          ) : null}
                          {!isWarframe && weaponCalc ? (
                            <>
                              <ShareStatBar
                                label="Damage"
                                display={weaponCalc.modded.totalDamage.toFixed(1)}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.totalDamage,
                                  weaponCalc.modded.totalDamage,
                                )}
                              />
                              <ShareStatBar
                                label="Crit chance"
                                display={formatPercent(weaponCalc.modded.critChance)}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.critChance,
                                  weaponCalc.modded.critChance,
                                )}
                              />
                              <ShareStatBar
                                label="Crit mult"
                                display={`${weaponCalc.modded.critMultiplier.toFixed(2)}×`}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.critMultiplier,
                                  weaponCalc.modded.critMultiplier,
                                )}
                              />
                              <ShareStatBar
                                label="Status"
                                display={formatPercent(weaponCalc.modded.statusChance)}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.statusChance,
                                  weaponCalc.modded.statusChance,
                                )}
                              />
                              <ShareStatBar
                                label={weaponCalc.isMelee ? 'Attack speed' : 'Fire rate'}
                                display={weaponCalc.modded.fireRate.toFixed(2)}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.fireRate,
                                  weaponCalc.modded.fireRate,
                                )}
                              />
                              <ShareStatBar
                                label="Sustained DPS"
                                display={formatCompactNumber(weaponCalc.sustainedDps)}
                                fillPct={Math.min(
                                  100,
                                  Math.max(8, (weaponCalc.sustainedDps / 50000) * 100),
                                )}
                              />
                            </>
                          ) : null}
                          {!isWarframe && !weaponCalc ? (
                            <p className="text-[12px] text-[#b6c5ed]">Stats unavailable.</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                        <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                          Build Summary
                        </p>
                        <div className="space-y-1.5 text-[12px]">
                          <div className="flex justify-between gap-2">
                            <span className="text-[#b6c5ed]">Reactor/Catalyst</span>
                            <span>{orokinReactor ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-[#b6c5ed]">Arcanes</span>
                            <span>{filledArcanes.length}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-[#b6c5ed]">Archon Shards</span>
                            <span>
                              {shardSummary.filled}
                              {shardSummary.tau > 0 ? ` (${shardSummary.tau} tau)` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isWarframe && (filledArcanes.length > 0 || shardSummary.filled > 0) ? (
                        <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                          {filledArcanes.length > 0 ? (
                            <>
                              <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                                Arcanes
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {filledArcanes.map((slot, i) => {
                                  const a = slot.arcane!;
                                  const maxRank = getMaxRank(a);
                                  const art = a.image_path ? `/images${a.image_path}` : '';
                                  return (
                                    <ArcaneCardPreview
                                      key={`${a.unique_name}-${i}`}
                                      layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale }}
                                      rarity={normalizeArcaneRarity(a.rarity)}
                                      arcaneArt={art}
                                      arcaneName={a.name}
                                      rank={slot.rank}
                                      maxRank={maxRank}
                                    />
                                  );
                                })}
                              </div>
                            </>
                          ) : null}
                          {shardSummary.filled > 0 ? (
                            <div className={filledArcanes.length > 0 ? 'mt-4' : ''}>
                              <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                                Archon Shards
                              </p>
                              <ShareShardStrip slots={shardSlots} shards={shardTypes} />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {!isWarframe && filledArcanes.length > 0 ? (
                        <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                          <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                            Arcanes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {filledArcanes.map((slot, i) => {
                              const a = slot.arcane!;
                              const maxRank = getMaxRank(a);
                              const art = a.image_path ? `/images${a.image_path}` : '';
                              return (
                                <ArcaneCardPreview
                                  key={`${a.unique_name}-${i}`}
                                  layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale }}
                                  rarity={normalizeArcaneRarity(a.rarity)}
                                  arcaneArt={art}
                                  arcaneName={a.name}
                                  rank={slot.rank}
                                  maxRank={maxRank}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
                    <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                      <p className="mb-3 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                        Equipped Mods ({equippedSlots.length})
                      </p>
                      <div className="flex flex-wrap content-start gap-x-2 gap-y-2">
                        {equippedSlots.map((slot) => (
                          <ModCard
                            key={`${slot.index}-${slot.mod?.unique_name ?? 'm'}`}
                            mod={slot.mod!}
                            rank={slot.rank ?? 0}
                            setRank={slot.setRank}
                            slotType={slot.type}
                            slotPolarity={slot.polarity}
                            collapsed
                            scale={modScale}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid flex-1 grid-cols-2 gap-4">
                      <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                        <p className="mb-3 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                          {isWarframe ? 'Stats' : 'Weapon Stats'}
                        </p>
                        <div className="space-y-2">
                          {isWarframe && warframeCalc ? (
                            <>
                              <ShareStatBar
                                label="Strength"
                                display={`${warframeCalc.abilityStrength.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityStrength.modded)}
                              />
                              <ShareStatBar
                                label="Duration"
                                display={`${warframeCalc.abilityDuration.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityDuration.modded)}
                              />
                              <ShareStatBar
                                label="Efficiency"
                                display={`${warframeCalc.abilityEfficiency.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityEfficiency.modded)}
                              />
                              <ShareStatBar
                                label="Range"
                                display={`${warframeCalc.abilityRange.modded.toFixed(0)}%`}
                                fillPct={abilityBarPct(warframeCalc.abilityRange.modded)}
                              />
                              <ShareStatBar
                                label="Health"
                                display={`${warframeCalc.health.modded.toFixed(0)}`}
                                fillPct={ratioBarPct(
                                  warframeCalc.health.base,
                                  warframeCalc.health.modded,
                                )}
                              />
                              <ShareStatBar
                                label="Energy"
                                display={`${warframeCalc.energy.modded.toFixed(0)}`}
                                fillPct={ratioBarPct(
                                  warframeCalc.energy.base,
                                  warframeCalc.energy.modded,
                                )}
                              />
                            </>
                          ) : null}
                          {!isWarframe && weaponCalc ? (
                            <>
                              <ShareStatBar
                                label="Damage"
                                display={weaponCalc.modded.totalDamage.toFixed(1)}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.totalDamage,
                                  weaponCalc.modded.totalDamage,
                                )}
                              />
                              <ShareStatBar
                                label="Crit"
                                display={formatPercent(weaponCalc.modded.critChance)}
                                fillPct={ratioBarPct(
                                  weaponCalc.base.critChance,
                                  weaponCalc.modded.critChance,
                                )}
                              />
                              <ShareStatBar
                                label="DPS"
                                display={formatCompactNumber(weaponCalc.sustainedDps)}
                                fillPct={Math.min(
                                  100,
                                  Math.max(8, (weaponCalc.sustainedDps / 50000) * 100),
                                )}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                          <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                            Build Summary
                          </p>
                          <div className="space-y-1.5 text-[12px]">
                            <div className="flex justify-between">
                              <span className="text-[#b6c5ed]">Reactor</span>
                              <span>{orokinReactor ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#b6c5ed]">Arcanes</span>
                              <span>{filledArcanes.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#b6c5ed]">Shards</span>
                              <span>{shardSummary.filled}</span>
                            </div>
                          </div>
                        </div>

                        {filledArcanes.length > 0 ? (
                          <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                            <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                              Arcanes
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {filledArcanes.map((slot, i) => {
                                const a = slot.arcane!;
                                const maxRank = getMaxRank(a);
                                const art = a.image_path ? `/images${a.image_path}` : '';
                                return (
                                  <ArcaneCardPreview
                                    key={`${a.unique_name}-${i}`}
                                    layout={{ ...DEFAULT_ARCANE_LAYOUT, scale: arcaneScale }}
                                    rarity={normalizeArcaneRarity(a.rarity)}
                                    arcaneArt={art}
                                    arcaneName={a.name}
                                    rank={slot.rank}
                                    maxRank={maxRank}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {isWarframe && shardSummary.filled > 0 ? (
                          <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                            <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                              Archon Shards
                            </p>
                            <ShareShardStrip slots={shardSlots} shards={shardTypes} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-auto flex shrink-0 items-center justify-between border-t border-white/10 pt-3 text-[11px] text-[#c4d2f8]">
                  <span>darkavianlabs.com/parametric</span>
                  <span>Generated in Parametric</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
