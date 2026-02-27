import { useState, useEffect, useCallback } from 'react';

import { apiFetch } from '../utils/api';

const LEGACY_STORAGE_KEY = 'parametric_loadouts';
const MIGRATED_KEY = 'parametric_loadouts_migrated_v1';
const MIGRATION_MAP_KEY = 'parametric_build_id_map_v1';
const MIGRATION_FAILURES_KEY = 'parametric_loadouts_migration_failures_v1';

export interface LoadoutBuild {
  build_id: string;
  slot_type: string;
}

export interface Loadout {
  id: string;
  name: string;
  builds: LoadoutBuild[];
  created_at: string;
  updated_at: string;
}

export const LOADOUT_SLOT_TYPES = [
  { key: 'warframe', label: 'Warframe' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'melee', label: 'Melee' },
  { key: 'companion', label: 'Companion' },
  { key: 'companion_weapon', label: 'Companion Weapon' },
  { key: 'archwing', label: 'Archwing' },
  { key: 'archgun', label: 'Arch-Gun' },
  { key: 'archmelee', label: 'Arch-Melee' },
] as const;

function readLegacyLoadouts(): Loadout[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function getApiErrorDetails(response: Response): Promise<string> {
  const statusText = `${response.status} ${response.statusText}`.trim();
  try {
    const body = (await response.clone().json()) as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof body.error === 'string' && body.error.length > 0) {
      return `${statusText}: ${body.error}`;
    }
    if (typeof body.message === 'string' && body.message.length > 0) {
      return `${statusText}: ${body.message}`;
    }
  } catch {
    // ignore
  }

  try {
    const text = await response.clone().text();
    if (text.trim().length > 0) {
      return `${statusText}: ${text.trim()}`;
    }
  } catch {
    // ignore
  }

  return statusText || 'Unknown API error';
}

export function useLoadoutStorage() {
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadoutError, setLoadoutError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<Loadout[]> => {
    try {
      setLoadoutError(null);
      const response = await apiFetch('/api/loadouts');
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        setLoadouts([]);
        setLoadoutError(details);
        return [];
      }
      const body = (await response.json()) as {
        loadouts?: Array<Record<string, unknown>>;
      };
      const rows = Array.isArray(body.loadouts) ? body.loadouts : [];
      const mapped = rows.map((row) => ({
        id: String(row.id ?? ''),
        name: typeof row.name === 'string' ? row.name : 'Loadout',
        builds: Array.isArray(row.builds)
          ? (row.builds as Array<Record<string, unknown>>).map((build) => ({
              build_id: String(build.build_id ?? ''),
              slot_type: String(build.slot_type ?? ''),
            }))
          : [],
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? new Date().toISOString()),
      })) as Loadout[];
      const filtered = mapped.filter((loadout) => loadout.id.length > 0);
      setLoadouts(filtered);
      return filtered;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadouts([]);
      setLoadoutError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function migrateLegacyLoadouts(): Promise<void> {
      if (localStorage.getItem(MIGRATED_KEY) === '1') {
        return;
      }
      const legacyLoadouts = readLegacyLoadouts();
      if (legacyLoadouts.length === 0) {
        localStorage.setItem(MIGRATED_KEY, '1');
        return;
      }
      const idMapRaw = localStorage.getItem(MIGRATION_MAP_KEY);
      const idMap = idMapRaw
        ? (JSON.parse(idMapRaw) as Record<string, string>)
        : {};
      const failures: Array<{
        type: 'loadout' | 'build';
        loadoutId: string;
        buildId?: string;
        slotType?: string;
        error: string;
      }> = [];
      for (const loadout of legacyLoadouts) {
        try {
          const createRes = await apiFetch('/api/loadouts', {
            method: 'POST',
            body: JSON.stringify({ name: loadout.name }),
          });
          if (!createRes.ok) {
            const details = await getApiErrorDetails(createRes);
            const error = `Failed to migrate legacy loadout ${loadout.id}: ${details}`;
            console.error(error);
            failures.push({
              type: 'loadout',
              loadoutId: loadout.id,
              error,
            });
            continue;
          }
          const createBody = (await createRes.json()) as {
            id?: string | number;
          };
          const newLoadoutId =
            createBody.id !== undefined ? String(createBody.id) : null;
          if (!newLoadoutId) {
            const error = `Failed to migrate legacy loadout ${loadout.id}: missing new loadout id`;
            console.error(error);
            failures.push({
              type: 'loadout',
              loadoutId: loadout.id,
              error,
            });
            continue;
          }
          for (const buildLink of loadout.builds) {
            const mappedBuildId = idMap[buildLink.build_id];
            if (!mappedBuildId) {
              const error = `Failed to migrate build ${buildLink.build_id} for loadout ${loadout.id}: missing build id mapping`;
              console.error(error);
              failures.push({
                type: 'build',
                loadoutId: loadout.id,
                buildId: buildLink.build_id,
                slotType: buildLink.slot_type,
                error,
              });
              continue;
            }
            const linkRes = await apiFetch(
              `/api/loadouts/${newLoadoutId}/builds`,
              {
                method: 'POST',
                body: JSON.stringify({
                  build_id: mappedBuildId,
                  slot_type: buildLink.slot_type,
                }),
              },
            );
            if (!linkRes.ok) {
              const details = await getApiErrorDetails(linkRes);
              const error = `Failed to migrate build ${buildLink.build_id} for loadout ${loadout.id}: ${details}`;
              console.error(error);
              failures.push({
                type: 'build',
                loadoutId: loadout.id,
                buildId: buildLink.build_id,
                slotType: buildLink.slot_type,
                error,
              });
            }
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const details = `Failed to migrate legacy loadout ${loadout.id}: ${message}`;
          console.error(details, error);
          failures.push({
            type: 'loadout',
            loadoutId: loadout.id,
            error: details,
          });
        }
      }
      if (failures.length > 0) {
        localStorage.setItem(MIGRATION_FAILURES_KEY, JSON.stringify(failures));
        return;
      }
      localStorage.removeItem(MIGRATION_FAILURES_KEY);
      localStorage.setItem(MIGRATED_KEY, '1');
    }

    void (async () => {
      await migrateLegacyLoadouts();
      await refresh();
    })();
  }, [refresh]);

  const createLoadout = useCallback(
    async (name: string): Promise<Loadout> => {
      const response = await apiFetch('/api/loadouts', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        throw new Error(`Failed to create loadout: ${details}`);
      }
      const body = (await response.json()) as { id?: string | number };
      if (body.id === undefined || body.id === null) {
        throw new Error(
          'API did not return loadout id; creation failed and cannot sync with server',
        );
      }
      const createdId = String(body.id);
      const loadout: Loadout = {
        id: createdId,
        name,
        builds: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const refreshedLoadouts = await refresh();
      return (
        refreshedLoadouts.find((candidate) => candidate.id === createdId) ??
        loadout
      );
    },
    [refresh],
  );

  const deleteLoadout = useCallback(
    async (id: string) => {
      const response = await apiFetch(`/api/loadouts/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        throw new Error(`Failed to delete loadout ${id}: ${details}`);
      }
      await refresh();
    },
    [refresh],
  );

  const linkBuild = useCallback(
    async (loadoutId: string, buildId: string, slotType: string) => {
      try {
        const response = await apiFetch(`/api/loadouts/${loadoutId}/builds`, {
          method: 'POST',
          body: JSON.stringify({
            build_id: buildId,
            slot_type: slotType,
          }),
        });
        if (!response.ok) {
          const details = await getApiErrorDetails(response);
          throw new Error(
            `Failed to link build ${buildId} to loadout ${loadoutId} (${slotType}): ${details}`,
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(
          `Failed to link build ${buildId} to loadout ${loadoutId} (${slotType})`,
        );
      }
      await refresh();
    },
    [refresh],
  );

  const unlinkBuild = useCallback(
    async (loadoutId: string, slotType: string) => {
      const response = await apiFetch(
        `/api/loadouts/${loadoutId}/builds/${slotType}`,
        {
          method: 'DELETE',
        },
      );
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        throw new Error(
          `Failed to unlink build from loadout ${loadoutId} (${slotType}): ${details}`,
        );
      }
      await refresh();
    },
    [refresh],
  );

  const getLoadout = useCallback(
    (id: string): Loadout | undefined => {
      return loadouts.find((loadout) => loadout.id === id);
    },
    [loadouts],
  );

  return {
    loadouts,
    loading,
    error: loadoutError,
    createLoadout,
    deleteLoadout,
    linkBuild,
    unlinkBuild,
    getLoadout,
    refresh,
  };
}
