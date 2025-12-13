import { create } from 'zustand';
import { MasterData, Supplier } from '../types';
import { persistence } from '../services/persistence';

interface MasterState extends MasterData {
  addDepartment: (name: string) => void;
  removeDepartment: (name: string) => void;
  addStaff: (name: string) => void;
  removeStaff: (name: string) => void;
  upsertSupplier: (supplier: Supplier) => void;
  removeSupplier: (code: string) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
}

const DEFAULT_MASTER: MasterData = {
  departments: ['産直センター', '精肉センター', '青果センター'],
  staffMembers: ['重原', '兵頭', '山田', '佐藤', '田中'],
  suppliers: [
    { code: 'SUP-001', name: '遠州中央農業協同組合' },
    { code: 'SUP-002', name: '山田商店' },
    { code: 'SUP-003', name: '鈴木食品' },
    { code: 'SUP-004', name: '東都水産' },
  ],
};

const uniqueList = (list: string[]) =>
  Array.from(new Set(list.map((v) => v.trim()).filter((v) => v.length > 0)));

const seedMasters = (): MasterData => {
  const stored = persistence.getMasters();
  if (stored) {
    return {
      departments: uniqueList(stored.departments ?? []),
      staffMembers: uniqueList(stored.staffMembers ?? []),
      suppliers:
        (stored.suppliers ?? []).map((s) =>
          typeof s === 'string' ? { code: s, name: s } : { code: s.code, name: s.name },
        ),
    };
  }
  const suppliersFromProducts = uniqueList((persistence.getProducts() ?? []).map((p) => p.supplierName ?? ''));
  return {
    departments: DEFAULT_MASTER.departments,
    staffMembers: DEFAULT_MASTER.staffMembers,
    suppliers: suppliersFromProducts.length
      ? suppliersFromProducts.map((name) => ({ code: name, name }))
      : DEFAULT_MASTER.suppliers,
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

  return {
    ...seedMasters(),
    addDepartment: (name) =>
      persist({ departments: uniqueList([...getData().departments, name.trim()].filter(Boolean)) }),
    removeDepartment: (name) => persist({ departments: getData().departments.filter((v) => v !== name) }),
    addStaff: (name) => persist({ staffMembers: uniqueList([...getData().staffMembers, name.trim()].filter(Boolean)) }),
    removeStaff: (name) => persist({ staffMembers: getData().staffMembers.filter((v) => v !== name) }),
    upsertSupplier: (supplier) => {
      const strip = (s: string) => s.trim().replace(/^["']+|["']+$/g, '');
      const trimmedName = strip(supplier.name);
      const trimmedCode = strip(supplier.code);
      if (!trimmedCode || !trimmedName) return;
      const others = getData().suppliers.filter((s) => s.code !== trimmedCode);
      persist({ suppliers: [...others, { code: trimmedCode, name: trimmedName }] });
    },
    removeSupplier: (code) => persist({ suppliers: getData().suppliers.filter((s) => s.code !== code) }),
    setSuppliers: (suppliers) => persist({ suppliers }),
  };
});
