import { toPng } from 'html-to-image';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { EquipmentType, ModSlot } from '../../types/warframe';
import { Modal } from '../ui/Modal';

type ShareAspect = 'wide' | 'portrait';

interface ShareArcaneSlot {
  arcane?: {
    name: string;
  };
  rank: number;
}

interface ShareShardSlot {
  shard_type_id?: string | number;
  buff_id?: string | number;
  tauforged: boolean;
}

interface BuildShareModalProps {
  open: boolean;
  onClose: () => void;
  buildName: string;
  equipmentName: string;
  equipmentType: EquipmentType;
  equipmentImagePath?: string;
  slots: ModSlot[];
  arcaneSlots: ShareArcaneSlot[];
  shardSlots: ShareShardSlot[];
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

export function BuildShareModal({
  open,
  onClose,
  buildName,
  equipmentName,
  equipmentType,
  equipmentImagePath,
  slots,
  arcaneSlots,
  shardSlots,
  orokinReactor,
}: BuildShareModalProps) {
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>('');
  const [bgOpacity, setBgOpacity] = useState(36);
  const [bgScale, setBgScale] = useState(1);
  const [aspect, setAspect] = useState<ShareAspect>('wide');
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (uploadUrl) {
        URL.revokeObjectURL(uploadUrl);
      }
    };
  }, [uploadUrl]);

  const equippedMods = useMemo(
    () =>
      slots
        .filter((slot) => slot.mod)
        .map((slot) => ({
          slotType: slot.type,
          modName: slot.mod?.name ?? 'Unknown Mod',
          rank: slot.rank ?? 0,
        })),
    [slots],
  );

  const listedArcanes = useMemo(
    () =>
      arcaneSlots
        .filter((slot) => slot.arcane)
        .map((slot) => `${slot.arcane?.name ?? 'Arcane'} R${slot.rank}`),
    [arcaneSlots],
  );

  const shardSummary = useMemo(() => {
    const filled = shardSlots.filter((slot) => slot.shard_type_id != null).length;
    const tau = shardSlots.filter((slot) => slot.shard_type_id != null && slot.tauforged).length;
    return { filled, tau };
  }, [shardSlots]);

  function handleUploadChange(file: File | null): void {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (uploadUrl) {
      URL.revokeObjectURL(uploadUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setUploadUrl(nextUrl);
    setUploadName(file.name);
    setError(null);
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
      setError('Failed to export image. Try a different background image.');
    } finally {
      setIsRendering(false);
    }
  }

  if (!open) return null;

  const isWide = aspect === 'wide';
  const canvasWidth = isWide ? 1200 : 1080;
  const canvasHeight = isWide ? 628 : 1350;
  const previewAspectClass = isWide ? 'aspect-[1200/628]' : 'aspect-[1080/1350]';

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
                handleUploadChange(file);
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
            {uploadUrl ? (
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => {
                  if (uploadUrl) URL.revokeObjectURL(uploadUrl);
                  setUploadUrl(null);
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
            Preview ({canvasWidth} x {canvasHeight})
          </div>
          <div className={`mx-auto w-full max-w-[760px] ${previewAspectClass}`}>
            <div
              ref={exportRef}
              className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/15 bg-[#090d18] text-[#edf2ff]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(120,154,255,0.35),transparent_38%),radial-gradient(circle_at_85%_78%,rgba(70,214,190,0.24),transparent_45%),linear-gradient(130deg,#0a1020_0%,#12172d_45%,#090d18_100%)]" />
              {uploadUrl ? (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    clipPath: 'polygon(44% 0%, 100% 0%, 100% 100%, 17% 100%, 34% 70%)',
                    opacity: bgOpacity / 100,
                  }}
                >
                  <img
                    src={uploadUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ transform: `scale(${bgScale})` }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(9,13,24,0.88),rgba(9,13,24,0.18))]" />
                </div>
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_25%,transparent_70%,rgba(0,0,0,0.44)_100%)]" />

              <div className="relative z-10 flex h-full flex-col p-9">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-[12px] tracking-[0.22em] text-[#b7c7ff]/90 uppercase">
                      Parametric Build Export
                    </p>
                    <h4 className="mt-1 truncate text-[42px] leading-none font-semibold">
                      {buildName}
                    </h4>
                    <p className="mt-2 text-[18px] text-[#c9d6ff]">
                      {equipmentName} · {formatEquipmentType(equipmentType)}
                    </p>
                  </div>
                  <div className="glass-panel overflow-hidden rounded-2xl border border-white/18 bg-white/5 p-0">
                    <div className="h-28 w-28">
                      {equipmentImagePath ? (
                        <img
                          src={equipmentImagePath}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                          No Art
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid flex-1 grid-cols-12 gap-4">
                  <div className="glass-panel col-span-8 rounded-2xl border border-white/12 bg-black/22 p-4">
                    <p className="mb-3 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                      Equipped Mods ({equippedMods.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {equippedMods.slice(0, 12).map((entry, index) => (
                        <div
                          key={`${entry.modName}-${index}`}
                          className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-2"
                        >
                          <div className="truncate text-[13px] font-medium">{entry.modName}</div>
                          <div className="mt-0.5 text-[11px] text-[#b6c5ed]">
                            {entry.slotType.toUpperCase()} · R{entry.rank}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-4 space-y-4">
                    <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                      <p className="text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                        Build Flags
                      </p>
                      <div className="mt-3 space-y-2 text-[13px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#b6c5ed]">Reactor/Catalyst</span>
                          <span>{orokinReactor ? 'Enabled' : 'Disabled'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#b6c5ed]">Arcanes</span>
                          <span>{listedArcanes.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#b6c5ed]">Archon Shards</span>
                          <span>
                            {shardSummary.filled}
                            {shardSummary.tau > 0 ? ` (${shardSummary.tau} tau)` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {listedArcanes.length > 0 ? (
                      <div className="glass-panel rounded-2xl border border-white/12 bg-black/22 p-4">
                        <p className="mb-2 text-[11px] tracking-[0.2em] text-[#c7d5ff] uppercase">
                          Arcanes
                        </p>
                        <div className="space-y-1.5 text-[12px] text-[#d6e0ff]">
                          {listedArcanes.slice(0, 3).map((label) => (
                            <div key={label} className="truncate">
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-[#c4d2f8]">
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
