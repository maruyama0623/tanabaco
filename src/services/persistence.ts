import { InventorySession, MasterData, Product } from '../types';

const PRODUCT_KEY = 'product-master';
const SESSION_KEY = 'inventory-session';
const HISTORY_KEY = 'inventory-history';
const MASTER_KEY = 'master-data';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';

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

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('persistence read error', e);
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.error('persistence write error', e);
  }
}

const fetchJson = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
};

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

const api = {
  saveProducts: (products: Product[]) =>
    fetchJson('/products/bulk', { method: 'POST', body: JSON.stringify({ products }) }),
  saveSession: (session: InventorySession | null) =>
    fetchJson('/session', { method: 'POST', body: JSON.stringify(withSessionId(session)) }),
  saveHistory: (history: InventorySession[]) =>
    fetchJson('/history', {
      method: 'POST',
      body: JSON.stringify(withSessionIdHistory(history)),
    }),
  saveMasters: (masters: MasterData) =>
    fetchJson('/masters', { method: 'POST', body: JSON.stringify(masters) }),
  getProducts: () => fetchJson('/products'),
  getSession: () => fetchJson('/session'),
  getHistory: () => fetchJson('/history'),
  getMasters: () => fetchJson('/masters'),
};

export const localPersistence: PersistenceProvider = {
  getProducts() {
    return readJson<Product[]>(PRODUCT_KEY) ?? [];
  },
  saveProducts(products) {
    writeJson(PRODUCT_KEY, products);
    void api.saveProducts(products).catch((e) => console.warn('api saveProducts error', e));
  },
  getSession() {
    return readJson<InventorySession>(SESSION_KEY);
  },
  saveSession(session) {
    writeJson(SESSION_KEY, session);
    void api.saveSession(session).catch((e) => console.warn('api saveSession error', e));
  },
  getHistory() {
    return readJson<InventorySession[]>(HISTORY_KEY) ?? [];
  },
  saveHistory(history) {
    writeJson(HISTORY_KEY, history);
    void api.saveHistory(history).catch((e) => console.warn('api saveHistory error', e));
  },
  getMasters() {
    return readJson<MasterData>(MASTER_KEY);
  },
  saveMasters(masters) {
    writeJson(MASTER_KEY, masters);
    void api.saveMasters(masters).catch((e) => console.warn('api saveMasters error', e));
  },
};

export const persistence = localPersistence;

export async function hydratePersistence() {
  try {
    const [products, session, history, masters] = await Promise.all([
      api.getProducts().catch(() => null),
      api.getSession().catch(() => null),
      api.getHistory().catch(() => null),
      api.getMasters().catch(() => null),
    ]);

    const hasRemoteData =
      (products && (products as Product[]).length) ||
      (history && (history as InventorySession[]).length) ||
      session ||
      (masters && (masters.departments?.length || masters.staffMembers?.length || masters.suppliers?.length));

    if (hasRemoteData) {
      if (products) writeJson(PRODUCT_KEY, products);
      if (session !== undefined) writeJson(SESSION_KEY, session as InventorySession | null);
      if (history) writeJson(HISTORY_KEY, history);
      if (masters) writeJson(MASTER_KEY, masters);
      return;
    }

    // No remote data -> migrate local storage to API
    const localProducts = readJson<Product[]>(PRODUCT_KEY) ?? [];
    const localSession = readJson<InventorySession>(SESSION_KEY);
    const localHistory = readJson<InventorySession[]>(HISTORY_KEY) ?? [];
    const localMasters = readJson<MasterData>(MASTER_KEY);
    await Promise.all([
      api.saveProducts(localProducts),
      api.saveSession(localSession ?? null),
      api.saveHistory(localHistory),
      localMasters ? api.saveMasters(localMasters) : Promise.resolve(),
    ]);
  } catch (e) {
    console.warn('hydratePersistence skipped', e);
  }
}
