import { useState, useEffect } from 'react';

import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  type EquipmentType,
} from '../../types/warframe';

interface EquipmentItem {
  unique_name: string;
  name: string;
  image_path?: string;
  mastery_req: number;
  product_category?: string;
}

interface EquipmentGridModalProps {
  onSelect: (equipmentType: string, uniqueName: string) => void;
  onClose: () => void;
}

const CATEGORY_API: Record<EquipmentType, string> = {
  warframe: '/api/warframes',
  primary: '/api/weapons?type=LongGuns',
  secondary: '/api/weapons?type=Pistols',
  melee: '/api/weapons?type=Melee',
  archgun: '/api/weapons?type=SpaceGuns',
  archmelee: '/api/weapons?type=SpaceMelee',
  companion: '/api/companions',
  archwing: '/api/warframes',
  necramech: '/api/warframes',
  kdrive: '',
};

export function EquipmentGridModal({
  onSelect,
  onClose,
}: EquipmentGridModalProps) {
  const [activeTab, setActiveTab] = useState<EquipmentType>('warframe');
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const url = CATEGORY_API[activeTab];
    if (!url) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetch(url)
      .then((r) => {
        return r.json();
      })
      .then((data) => {
        let list: EquipmentItem[] = data.items || [];

        if (activeTab === 'warframe') {
          list = list.filter((i) => {
            const cat = i.product_category;
            return !cat || cat === 'Suits';
          });
        } else if (activeTab === 'archwing') {
          list = list.filter((i) => i.product_category === 'SpaceSuits');
        } else if (activeTab === 'necramech') {
          list = list.filter((i) => i.product_category === 'MechSuits');
        }

        setItems(list);
        return undefined;
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal max-w-4xl"
        style={{ width: '90%', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Select Equipment
          </h2>
          <button
            className="text-xl text-muted hover:text-foreground"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Category tabs */}
        <div className="mb-3 flex flex-wrap gap-1">
          {EQUIPMENT_TYPE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => {
                setActiveTab(t);
                setSearch('');
              }}
              className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                activeTab === t
                  ? 'bg-accent-weak text-accent'
                  : 'text-muted hover:bg-glass-hover hover:text-foreground'
              }`}
            >
              {EQUIPMENT_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input mb-4"
          autoFocus
        />

        {/* Grid */}
        <div className="max-h-[55vh] overflow-y-auto custom-scroll">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted">Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted">
                {items.length === 0
                  ? 'No data. Import data first.'
                  : 'No results.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {filtered.map((item) => (
                <button
                  key={item.unique_name}
                  onClick={() => onSelect(activeTab, item.unique_name)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-glass-border p-2 text-center transition-all hover:border-glass-border-hover hover:bg-glass-hover"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-glass">
                    {item.image_path ? (
                      <img
                        src={`/images${item.image_path}`}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-muted/50">?</span>
                    )}
                  </div>
                  <span className="w-full truncate text-[11px] text-muted">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
