import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { Product } from '../types';
import { persistence } from '../services/persistence';

interface ProductState {
  products: Product[];
  addProduct: (input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => void;
  deleteProduct: (id: string) => void;
  search: (keyword: string, supplier: string, department?: string) => Product[];
}

// ひらがな/カタカナ・全半角を揃えて検索しやすくする
const normalizeKana = (s: string) => {
  const nk = s.normalize('NFKC').toLowerCase();
  const hira = Array.from(nk)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      // Katakana to Hiragana
      if (code >= 0x30a1 && code <= 0x30f3) {
        return String.fromCharCode(code - 0x60);
      }
      return ch;
    })
    .join('');
  // 空白を除去して比較を緩和
  return hira.replace(/[\s\u3000]+/g, '');
};

const seedProducts = (): Product[] => {
  const existing = persistence.getProducts() as any[];
  if (existing.length) {
    // normalize legacy imageUrl -> imageUrls
    const master = persistence.getMasters();
    const defaultDepartments = master?.departments ?? [];
    const normalized = existing.map((p) => {
      const imageUrls = p.imageUrls ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];
      const departments: string[] = Array.isArray(p.departments) ? p.departments : defaultDepartments;
      return {
        ...p,
        imageUrls,
        departments,
        unit: p.unit ?? 'P',
        featureSummary: p.featureSummary ?? '',
        featureEmbedding: Array.isArray(p.featureEmbedding) ? p.featureEmbedding : undefined,
      };
    });
    persistence.saveProducts(normalized as Product[]);
    return normalized as Product[];
  }
  return [];
};

export const useProductStore = create<ProductState>((set, get) => ({
  products: seedProducts(),
  addProduct: (input) => {
    const product: Product = {
      ...input,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageUrls: [...(input.imageUrls ?? [])],
      departments: [...(input.departments ?? [])],
      unit: input.unit ?? 'P',
      featureSummary: input.featureSummary ?? '',
      featureEmbedding: input.featureEmbedding ?? undefined,
    };
    const next = [product, ...get().products];
    persistence.saveProducts(next);
    set({ products: next });
    return product;
  },
  updateProduct: (id, patch) => {
    const next = get().products.map((p) => {
      if (p.id !== id) return p;
      const { imageUrl: _legacy, ...rest } = p as any;
      const nextImages = patch.imageUrls ?? rest.imageUrls ?? [];
      const nextDepartments = patch.departments ?? rest.departments ?? [];
      return {
        ...rest,
        ...patch,
        imageUrls: [...nextImages],
        departments: [...nextDepartments],
        unit: patch.unit ?? rest.unit ?? 'P',
        featureSummary: patch.featureSummary ?? rest.featureSummary ?? '',
        featureEmbedding: patch.featureEmbedding ?? rest.featureEmbedding ?? undefined,
        updatedAt: new Date().toISOString(),
      } as Product;
    });
    persistence.saveProducts(next);
    set({ products: next });
  },
  deleteProduct: (id) => {
    const next = get().products.filter((p) => p.id !== id);
    persistence.saveProducts(next);
    set({ products: next });
  },
  search: (keyword, supplier, department) => {
    const kw = normalizeKana(keyword.trim());
    const sp = normalizeKana(supplier.trim());
    const hasDept = Boolean(department);
    const list = get().products
      .filter((p) => {
        const nameN = normalizeKana(p.name ?? '');
        const cdN = normalizeKana(p.productCd ?? '');
        const supN = normalizeKana(p.supplierName ?? '');
        const matchKeyword = kw ? nameN.includes(kw) || cdN.includes(kw) : true;
        const matchSupplier = sp ? supN.includes(sp) : true;
        const matchDepartment = department
          ? (p.departments ?? []).length === 0 || (p.departments ?? []).includes(department)
          : true;
        return matchKeyword && matchSupplier && matchDepartment;
      })
      .sort((a, b) => {
        if (!hasDept) return 0;
        const aMatch = (a.departments ?? []).includes(department!);
        const bMatch = (b.departments ?? []).includes(department!);
        if (aMatch === bMatch) return 0;
        return aMatch ? -1 : 1; // 部門一致を優先
      });
    return list;
  },
}));
