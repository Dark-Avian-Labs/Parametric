import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'parametric_loadouts';

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

function generateId(): string {
  return `loadout-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function readLoadouts(): Loadout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLoadouts(loadouts: Loadout[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadouts));
}

export function useLoadoutStorage() {
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoadouts(readLoadouts());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createLoadout = useCallback((name: string): Loadout => {
    const all = readLoadouts();
    const now = new Date().toISOString();
    const loadout: Loadout = {
      id: generateId(),
      name,
      builds: [],
      created_at: now,
      updated_at: now,
    };
    all.push(loadout);
    writeLoadouts(all);
    setLoadouts(all);
    return loadout;
  }, []);

  const deleteLoadout = useCallback((id: string) => {
    const all = readLoadouts().filter((l) => l.id !== id);
    writeLoadouts(all);
    setLoadouts(all);
  }, []);

  const linkBuild = useCallback(
    (loadoutId: string, buildId: string, slotType: string) => {
      const all = readLoadouts();
      const loadout = all.find((l) => l.id === loadoutId);
      if (!loadout) return;

      // Replace existing build in same slot
      loadout.builds = loadout.builds.filter((b) => b.slot_type !== slotType);
      loadout.builds.push({ build_id: buildId, slot_type: slotType });
      loadout.updated_at = new Date().toISOString();

      writeLoadouts(all);
      setLoadouts(all);
    },
    [],
  );

  const unlinkBuild = useCallback((loadoutId: string, slotType: string) => {
    const all = readLoadouts();
    const loadout = all.find((l) => l.id === loadoutId);
    if (!loadout) return;

    loadout.builds = loadout.builds.filter((b) => b.slot_type !== slotType);
    loadout.updated_at = new Date().toISOString();

    writeLoadouts(all);
    setLoadouts(all);
  }, []);

  const getLoadout = useCallback((id: string): Loadout | undefined => {
    return readLoadouts().find((l) => l.id === id);
  }, []);

  return {
    loadouts,
    loading,
    createLoadout,
    deleteLoadout,
    linkBuild,
    unlinkBuild,
    getLoadout,
    refresh,
  };
}
