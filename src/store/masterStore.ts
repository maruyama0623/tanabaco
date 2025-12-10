import { create } from 'zustand';
import { MasterData } from '../types';
import { persistence } from '../services/persistence';

interface MasterState extends MasterData {
  addDepartment: (name: string) => void;
  removeDepartment: (name: string) => void;
  addStaff: (name: string) => void;
  removeStaff: (name: string) => void;
  addSupplier: (name: string) => void;
  removeSupplier: (name: string) => void;
}

const DEFAULT_MASTER: MasterData = {
  departments: ['産直センター', '精肉センター', '青果センター'],
  staffMembers: ['重原', '兵頭', '山田', '佐藤', '田中'],
  suppliers: ['遠州中央農業協同組合', '山田商店', '鈴木食品', '東都水産'],
};

const uniqueList = (list: string[]) =>
  Array.from(new Set(list.map((v) => v.trim()).filter((v) => v.length > 0)));

const seedMasters = (): MasterData => {
  const stored = persistence.getMasters();
  if (stored) {
    return {
      departments: uniqueList(stored.departments ?? []),
      staffMembers: uniqueList(stored.staffMembers ?? []),
      suppliers: uniqueList(stored.suppliers ?? []),
    };
  }
  const suppliersFromProducts = uniqueList(
    (persistence.getProducts() ?? []).map((p) => p.supplierName ?? ''),
  );
  return {
    departments: DEFAULT_MASTER.departments,
    staffMembers: DEFAULT_MASTER.staffMembers,
    suppliers: suppliersFromProducts.length ? suppliersFromProducts : DEFAULT_MASTER.suppliers,
  };
};

export const useMasterStore = create<MasterState>((set, get) => {
  const getData = (): MasterData => ({
    departments: get().departments,
    staffMembers: get().staffMembers,
    suppliers: get().suppliers,
  });

  const persist = (partial: Partial<MasterData>) => {
    const next = { ...getData(), ...partial };
    persistence.saveMasters(next);
    set(next);
  };

  const addItem = (key: keyof MasterData, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = getData()[key];
    if (current.some((v) => v === trimmed)) return;
    persist({ [key]: uniqueList([...current, trimmed]) } as Partial<MasterData>);
  };

  const removeItem = (key: keyof MasterData, name: string) => {
    const trimmed = name.trim();
    persist({ [key]: getData()[key].filter((v) => v !== trimmed) } as Partial<MasterData>);
  };

  return {
    ...seedMasters(),
    addDepartment: (name) => addItem('departments', name),
    removeDepartment: (name) => removeItem('departments', name),
    addStaff: (name) => addItem('staffMembers', name),
    removeStaff: (name) => removeItem('staffMembers', name),
    addSupplier: (name) => addItem('suppliers', name),
    removeSupplier: (name) => removeItem('suppliers', name),
  };
});
