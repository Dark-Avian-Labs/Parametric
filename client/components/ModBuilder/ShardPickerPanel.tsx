import { useState } from 'react';

import type { ShardType, ShardSlotConfig } from './ArchonShardSlots';

interface ShardPickerPanelProps {
  shards: ShardType[];
  currentSlot: ShardSlotConfig;
  onSelect: (shardTypeId: string, buffId: number, tauforged: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function ShardPickerPanel({
  shards,
  currentSlot,
  onSelect,
  onRemove,
  onClose,
}: ShardPickerPanelProps) {
  const [selectedType, setSelectedType] = useState<string>(
    currentSlot.shard_type_id || shards[0]?.id || '',
  );
  const [tauforged, setTauforged] = useState(currentSlot.tauforged);

  const activeShard = shards.find((s) => s.id === selectedType);

  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Archon Shards</h2>
        <button
          onClick={onClose}
          className="rounded-lg border border-glass-border px-2.5 py-1 text-xs text-muted transition-all hover:bg-glass-hover hover:text-foreground"
        >
          Back to Mods
        </button>
      </div>

      {/* Shard type selection */}
      <div className="mb-3 flex flex-wrap gap-2">
        {shards.map((shard) => {
          const icon = tauforged ? shard.tauforged_icon_path : shard.icon_path;
          return (
            <button
              key={shard.id}
              onClick={() => setSelectedType(shard.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-all ${
                selectedType === shard.id
                  ? 'border-accent bg-accent-weak text-accent'
                  : 'border-glass-border text-muted hover:border-glass-border-hover'
              }`}
            >
              <img
                src={icon}
                alt=""
                className="h-5 w-5 object-contain"
                draggable={false}
              />
              {shard.name}
            </button>
          );
        })}
      </div>

      {/* Tauforged toggle */}
      <label className="mb-3 flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={tauforged}
          onChange={(e) => setTauforged(e.target.checked)}
          className="accent-warning"
        />
        Tauforged (1.5x values)
      </label>

      {/* Buff selection */}
      <div className="max-h-[calc(100vh-500px)] overflow-y-auto custom-scroll">
        <div className="space-y-1">
          {/* Remove option */}
          <button
            onClick={onRemove}
            className="flex w-full items-center justify-between rounded-lg border border-dashed border-danger/40 px-3 py-2 text-left text-sm text-danger/70 transition-all hover:border-danger hover:bg-danger/10"
          >
            <span>Remove Shard</span>
            <span className="text-xs">&times;</span>
          </button>
          {activeShard &&
            activeShard.buffs.map((buff) => {
              const value = tauforged ? buff.tauforged_value : buff.base_value;
              const formatValue = () => {
                if (buff.value_format === 'proc') return '';
                if (buff.value_format === '%') return ` +${value}%`;
                if (buff.value_format === '+flat') return ` +${value}`;
                if (buff.value_format === '/s') return ` +${value}/s`;
                return ` ${value}`;
              };
              return (
                <button
                  key={buff.id}
                  onClick={() => onSelect(selectedType, buff.id, tauforged)}
                  className="flex w-full items-center justify-between rounded-lg border border-glass-border px-3 py-2 text-left text-sm text-muted transition-all hover:border-glass-border-hover hover:bg-glass-hover hover:text-foreground"
                >
                  <span>{buff.description}</span>
                  <span className="text-xs text-accent">{formatValue()}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
