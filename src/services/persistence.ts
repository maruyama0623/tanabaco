import { InventorySession, MasterData, Product } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';
const LS_PRODUCTS = 'tanabaco_products';
const LS_SESSION = 'tanabaco_session';
const LS_HISTORY = 'tanabaco_history';
const LS_MASTERS = 'tanabaco_masters';

export interface PersistenceProvider {
  getProducts(): Product[];
  saveProducts(products: Product[]): void;
  getSession(): InventorySession | null;
  saveSession(session: InventorySession | null): void;
  getHistory(): InventorySession[];
  saveHistory(history: InventorySession[]): void;
  getMasters(): MasterData | null;
  saveMasters(masters: MasterData): void;
}

const fetchJson = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
};

const api = {
  saveProducts: (products: Product[]) => {
    // 0件で送るとDBを全削除してしまうためガード
    if (!products || products.length === 0) {
      console.warn('skip saveProducts because payload is empty');
      return Promise.resolve();
    }
    return fetchJson('/products/bulk', { method: 'POST', body: JSON.stringify({ products }) });
  },
  saveSession: (session: InventorySession | null) =>
    fetchJson('/session', { method: 'POST', body: JSON.stringify(withSessionId(session)) }),
  saveHistory: (history: InventorySession[]) =>
    fetchJson('/history', {
      method: 'POST',
      body: JSON.stringify(withSessionIdHistory(history)),
    }),
  saveMasters: (masters: MasterData) => {
    const total =
      (masters?.departments?.length ?? 0) +
      (masters?.staffMembers?.length ?? 0) +
      (masters?.suppliers?.length ?? 0);
    if (!total) {
      console.warn('skip saveMasters because payload is empty');
      return Promise.resolve();
    }
    return fetchJson('/masters', { method: 'POST', body: JSON.stringify(masters) });
  },
  getProducts: () => fetchJson('/products'),
  getSession: () => fetchJson('/session'),
  getHistory: () => fetchJson('/history'),
  getMasters: () => fetchJson('/masters'),
};

let cacheProducts: Product[] = [];
let cacheSession: InventorySession | null = null;
let cacheHistory: InventorySession[] = [];
let cacheMasters: MasterData | null = null;

const withSessionId = (session: InventorySession | null) => {
  if (!session) return null;
  return {
    ...session,
    photoRecords: (session.photoRecords ?? []).map((p) => ({
      ...p,
      sessionId: session.id,
      department: p.department ?? session.department,
      inventoryDate: p.inventoryDate ?? session.inventoryDate,
    })),
  };
};

const withSessionIdHistory = (history: InventorySession[]) =>
  history.map((s) => ({
    ...s,
    photoRecords: (s.photoRecords ?? []).map((p) => ({
      ...p,
      sessionId: s.id,
      department: p.department ?? s.department,
      inventoryDate: p.inventoryDate ?? s.inventoryDate,
    })),
  }));

export const apiPersistence: PersistenceProvider = {
  getProducts() {
    return cacheProducts;
  },
  saveProducts(products) {
    cacheProducts = products;
    try {
      localStorage.setItem(LS_PRODUCTS, JSON.stringify(products));
    } catch {}
    void api.saveProducts(products).catch((e) => console.warn('api saveProducts error', e));
  },
  getSession() {
    return cacheSession;
  },
  saveSession(session) {
    cacheSession = session;
    try {
      localStorage.setItem(LS_SESSION, JSON.stringify(session));
    } catch {}
    void api.saveSession(session).catch((e) => console.warn('api saveSession error', e));
  },
  getHistory() {
    return cacheHistory;
  },
  saveHistory(history) {
    cacheHistory = history;
    try {
      localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    } catch {}
    void api.saveHistory(history).catch((e) => console.warn('api saveHistory error', e));
  },
  getMasters() {
    return cacheMasters;
  },
  saveMasters(masters) {
    cacheMasters = masters;
    try {
      localStorage.setItem(LS_MASTERS, JSON.stringify(masters));
    } catch {}
    void api.saveMasters(masters).catch((e) => console.warn('api saveMasters error', e));
  },
};

export const persistence = apiPersistence;

export async function hydratePersistence() {
  try {
    const [apiProducts, apiSession, apiHistory, apiMasters] = await Promise.all([
      api.getProducts().catch(() => null),
      api.getSession().catch(() => null),
      api.getHistory().catch(() => null),
      api.getMasters().catch(() => null),
    ]);

    // local fallback
    let lsProducts: Product[] | null = null;
    let lsSession: InventorySession | null = null;
    let lsHistory: InventorySession[] | null = null;
    let lsMasters: MasterData | null = null;
    try {
      lsProducts = JSON.parse(localStorage.getItem(LS_PRODUCTS) ?? 'null');
      lsSession = JSON.parse(localStorage.getItem(LS_SESSION) ?? 'null');
      lsHistory = JSON.parse(localStorage.getItem(LS_HISTORY) ?? 'null');
      lsMasters = JSON.parse(localStorage.getItem(LS_MASTERS) ?? 'null');
    } catch {
      // ignore parse errors
    }

    cacheProducts = (apiProducts as Product[]) ?? lsProducts ?? [];
    cacheSession = (apiSession as InventorySession | null) ?? lsSession ?? null;
    cacheHistory = (apiHistory as InventorySession[]) ?? lsHistory ?? [];
    cacheMasters = (apiMasters as MasterData | null) ?? lsMasters ?? null;

    // hydrate zustand stores directly
    const { useProductStore } = await import('../store/productStore');
    const { useSessionStore } = await import('../store/sessionStore');
    const { useMasterStore } = await import('../store/masterStore');

    useProductStore.setState({ products: cacheProducts });
    useSessionStore.setState({
      session: cacheSession,
      history: cacheHistory,
    });
    if (cacheMasters) {
      useMasterStore.setState({
        departments: cacheMasters.departments ?? [],
        staffMembers: cacheMasters.staffMembers ?? [],
        suppliers: (cacheMasters.suppliers ?? []).map((s: any) =>
          typeof s === 'string' ? { code: s, name: s } : { code: s.code, name: s.name },
        ),
      });
    }
  } catch (e) {
    console.warn('hydratePersistence skipped', e);
  }
}
