import { useState, useEffect } from 'react';

import { Modal } from '../../components/ui/Modal';
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  type EquipmentType,
} from '../../types/warframe';
import { apiFetch } from '../../utils/api';

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
    void apiFetch(url)
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
    <Modal
      open
      onClose={onClose}
      className="glass-modal-surface max-w-4xl p-6 shadow-2xl"
      ariaLabelledBy="equipment-grid-title"
    >
      <div
        style={{ width: '100%', maxWidth: '90vw', maxHeight: '85vh' }}
        className="overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="equipment-grid-title"
            className="text-lg font-semibold text-foreground"
          >
            Select Equipment
          </h2>
          <button
            type="button"
            className="text-xl text-muted hover:text-foreground"
            onClick={onClose}
            aria-label="Close equipment picker"
          >
            &times;
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {EQUIPMENT_TYPE_ORDER.map((t) => (
            <button
              key={t}
              type="button"
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

        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input mb-4"
          autoFocus
        />

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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((item) => (
                <button
                  key={item.unique_name}
                  type="button"
                  onClick={() => onSelect(activeTab, item.unique_name)}
                  className="group relative overflow-hidden rounded-lg border border-glass-border p-0 text-center transition-all hover:border-glass-border-hover hover:bg-glass-hover"
                  aria-label={`Select ${item.name}`}
                >
                  <div className="relative flex h-20 w-full items-center justify-center overflow-hidden bg-glass">
                    {item.image_path ? (
                      <img
                        src={`/images${item.image_path}`}
                        alt=""
                        className="h-full w-full object-contain p-1 transition-transform duration-200 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-muted/50">?</span>
                    )}
                    <span className="text-shadow-soft absolute inset-x-0 bottom-0 truncate bg-black/25 px-2 py-1 text-[11px] text-white">
                      {item.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
