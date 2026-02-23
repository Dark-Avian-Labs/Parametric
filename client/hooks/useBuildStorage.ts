import { useState, useEffect, useCallback } from 'react';

import type { StoredBuild, BuildConfig } from '../types/warframe';

const STORAGE_KEY = 'parametric_builds';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function readBuilds(): StoredBuild[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeBuilds(builds: StoredBuild[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
}

export function useBuildStorage() {
  const [builds, setBuilds] = useState<StoredBuild[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setBuilds(readBuilds());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveBuild = useCallback(
    (
      config: BuildConfig,
      equipmentName: string,
      equipmentImage?: string,
    ): StoredBuild => {
      const all = readBuilds();
      const now = new Date().toISOString();

      if (config.id) {
        const idx = all.findIndex((b) => b.id === config.id);
        if (idx >= 0) {
          all[idx] = {
            ...all[idx],
            ...config,
            equipment_name: equipmentName,
            equipment_image: equipmentImage,
            updated_at: now,
          };
          writeBuilds(all);
          setBuilds(all);
          return all[idx];
        }
      }

      const build: StoredBuild = {
        ...config,
        id: config.id || generateId(),
        equipment_name: equipmentName,
        equipment_image: equipmentImage,
        created_at: now,
        updated_at: now,
      };

      all.push(build);
      writeBuilds(all);
      setBuilds(all);
      return build;
    },
    [],
  );

  const deleteBuild = useCallback((id: string) => {
    const all = readBuilds().filter((b) => b.id !== id);
    writeBuilds(all);
    setBuilds(all);
  }, []);

  const getBuild = useCallback((id: string): StoredBuild | undefined => {
    return readBuilds().find((b) => b.id === id);
  }, []);

  return { builds, loading, saveBuild, deleteBuild, getBuild, refresh };
}
