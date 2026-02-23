import { useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

import { EquipmentGridModal } from './EquipmentGridModal';
import { SearchBar } from './SearchBar';
import bgArt from '../../assets/background.txt?raw';
import { useCompare } from '../../context/CompareContext';
import { CompareBar } from '../Compare/CompareBar';

export function Layout() {
  const [showAddBuild, setShowAddBuild] = useState(false);
  const navigate = useNavigate();
  const { snapshots } = useCompare();
  const compareBarVisible = snapshots.length > 0;

  const handleEquipmentSelect = useCallback(
    (equipmentType: string, uniqueName: string) => {
      setShowAddBuild(false);
      navigate(
        `/builder/new/${equipmentType}/${encodeURIComponent(uniqueName)}`,
      );
    },
    [navigate],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-art" aria-hidden="true">
        {bgArt}
      </div>
      <header className="relative z-10 px-6 py-4">
        <div className="mx-auto flex max-w-[2000px] items-center justify-between gap-4">
          <h1 className="shrink-0 text-xl font-bold text-foreground">
            Parametric
          </h1>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              className="btn btn-accent text-sm"
              onClick={() => setShowAddBuild(true)}
            >
              + Add Build
            </button>

            <SearchBar />

            <nav className="flex gap-2">
              <NavLink
                to="/builder"
                end
                className={({ isActive }) =>
                  `inline-flex items-center rounded-2xl border px-4 py-2 text-sm transition-all ${
                    isActive
                      ? 'border-accent bg-accent-weak text-accent'
                      : 'border-glass-border text-muted hover:border-glass-border-hover hover:text-foreground'
                  }`
                }
              >
                Builds
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `inline-flex items-center rounded-2xl border px-4 py-2 text-sm transition-all ${
                    isActive
                      ? 'border-accent bg-accent-weak text-accent'
                      : 'border-glass-border text-muted hover:border-glass-border-hover hover:text-foreground'
                  }`
                }
              >
                Admin
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main
        className={`relative z-10 flex-1 px-6 pb-6 ${compareBarVisible ? 'pb-24' : ''}`}
      >
        <Outlet />
      </main>

      <CompareBar />

      {showAddBuild && (
        <EquipmentGridModal
          onSelect={handleEquipmentSelect}
          onClose={() => setShowAddBuild(false)}
        />
      )}
    </div>
  );
}
