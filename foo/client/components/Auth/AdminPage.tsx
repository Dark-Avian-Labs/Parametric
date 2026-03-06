import { useState } from 'react';

import { useApi } from '../../hooks/useApi';
import { apiFetch } from '../../utils/api';

interface ShardBuff {
  id: number;
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
}

interface ShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  buffs: ShardBuff[];
}

export function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass-shell p-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="mt-1 text-sm text-muted">
          Archon Shard configuration for Parametric.
        </p>
      </div>
      <ArchonShardAdmin />
    </div>
  );
}

function ArchonShardAdmin() {
  const { data, loading, error, refetch } = useApi<{ shards: ShardType[] }>(
    '/api/archon-shards',
  );
  const shards = data?.shards || [];
  const [editingBuff, setEditingBuff] = useState<ShardBuff | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApiCall = async (
    apiCall: () => Promise<Response>,
    successMessage: string,
    failureMessage: string,
  ) => {
    try {
      const response = await apiCall();
      if (!response.ok) {
        throw new Error(failureMessage);
      }
      setStatusMessage(successMessage);
      setErrorMessage(null);
      refetch();
      return true;
    } catch {
      setStatusMessage(null);
      setErrorMessage(failureMessage);
      return false;
    }
  };

  const handleSaveBuff = async () => {
    if (!editingBuff) return;
    const didSave = await handleApiCall(
      () =>
        apiFetch(`/api/archon-shards/buffs/${editingBuff.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingBuff),
        }),
      'Shard buff saved.',
      'Failed to save shard buff.',
    );
    if (didSave) {
      setEditingBuff(null);
    }
  };

  const handleDeleteBuff = async (id: number) => {
    if (!confirm('Delete this buff?')) return;
    await handleApiCall(
      () =>
        apiFetch(`/api/archon-shards/buffs/${id}`, {
          method: 'DELETE',
        }),
      'Shard buff deleted.',
      'Failed to delete shard buff.',
    );
  };

  const handleAddBuff = async (shardTypeId: string) => {
    await handleApiCall(
      () =>
        apiFetch('/api/archon-shards/buffs', {
          method: 'POST',
          body: JSON.stringify({
            shard_type_id: shardTypeId,
            description: 'New Buff',
            base_value: 0,
            tauforged_value: 0,
            value_format: '%',
            sort_order: 99,
          }),
        }),
      'Shard buff added.',
      'Failed to add shard buff.',
    );
  };

  return (
    <div className="glass-surface p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Archon Shards
      </h2>
      <p className="mb-3 text-xs text-muted">
        Edit shard types and their buff values.
      </p>
      {statusMessage ? (
        <p
          className="mb-3 text-sm text-success"
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
      {errorMessage || error ? (
        <p
          className="mb-3 text-sm text-danger"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage || error}
        </p>
      ) : null}
      {loading ? (
        <p className="mb-3 text-sm text-muted" role="status" aria-live="polite">
          Loading archon shard configuration...
        </p>
      ) : null}

      <div className="space-y-4">
        {shards.map((shard) => (
          <div key={shard.id} className="glass-surface rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2">
              <img
                src={shard.icon_path}
                alt=""
                className="h-5 w-5 object-contain"
              />
              <span className="text-sm font-semibold text-foreground">
                {shard.name}
              </span>
            </div>
            <div className="space-y-1">
              {shard.buffs.map((buff) => (
                <div key={buff.id} className="flex items-center gap-2 text-xs">
                  {editingBuff?.id === buff.id ? (
                    <>
                      <input
                        type="text"
                        aria-label={`Description for ${shard.name} buff`}
                        value={editingBuff.description}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            description: e.target.value,
                          })
                        }
                        className="form-input flex-1 text-xs"
                      />
                      <input
                        type="number"
                        aria-label={`Base value for ${shard.name} buff`}
                        value={editingBuff.base_value}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            base_value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="form-input w-16 text-xs"
                        step="0.1"
                      />
                      <input
                        type="number"
                        aria-label={`Tauforged value for ${shard.name} buff`}
                        value={editingBuff.tauforged_value}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            tauforged_value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="form-input w-16 text-xs"
                        step="0.1"
                      />
                      <select
                        aria-label={`Value format for ${shard.name} buff`}
                        value={editingBuff.value_format}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            value_format: e.target.value,
                          })
                        }
                        className="form-input w-16 text-xs"
                      >
                        <option value="%">%</option>
                        <option value="+flat">+flat</option>
                        <option value="/s">/s</option>
                        <option value="proc">proc</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleSaveBuff}
                        className="text-success hover:text-success/80"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBuff(null)}
                        className="text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-muted">
                        {buff.description}
                      </span>
                      <span className="w-16 text-center text-foreground">
                        {buff.base_value}
                      </span>
                      <span className="w-16 text-center text-warning">
                        {buff.tauforged_value}
                      </span>
                      <span className="w-10 text-center text-muted/50">
                        {buff.value_format}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingBuff({ ...buff })}
                        className="text-accent hover:text-accent/80"
                        aria-label={`Edit buff ${buff.description}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBuff(buff.id)}
                        className="text-danger hover:text-danger/80"
                        aria-label={`Delete buff ${buff.description}`}
                      >
                        &times;
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddBuff(shard.id)}
                className="mt-1 text-xs text-accent hover:text-accent/80"
                aria-label={`Add buff for ${shard.name}`}
              >
                + Add buff
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
