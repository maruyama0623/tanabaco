import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { InventorySession, PhotoRecord } from '../types';
import { persistence } from '../services/persistence';
import { normalizeInventoryDate, toMonthKey } from '../utils/date';
import { useProductStore } from './productStore';

interface SessionState {
  session: InventorySession | null;
  history: InventorySession[];
  startSession: (payload: Omit<InventorySession, 'id' | 'photoRecords'>) => InventorySession;
  addPhoto: (imageUrls: string[]) => PhotoRecord | null;
  addManualRecord: (payload: {
    productId: string;
    quantity: number;
    unitCost?: number;
    unit?: string;
  }) => PhotoRecord | null;
  updateQuantity: (photoId: string, quantity: number, formula?: string) => void;
  updatePhotoImages: (photoId: string, imageUrls: string[]) => void;
  deletePhoto: (photoId: string) => void;
  assignProduct: (photoId: string, productId: string, unitCost?: number, unit?: string) => void;
  updateUnitCost: (productId: string, unitCost: number) => void;
  resetSession: () => void;
  setCurrentSession: (sessionId: string) => void;
  lockSession: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: (() => {
    const session = persistence.getSession();
    if (!session) return null;
    const normalized = {
      ...session,
      inventoryDate: normalizeInventoryDate(session.inventoryDate),
      monthKey: session.monthKey ?? toMonthKey(session.inventoryDate),
      isLocked: session.isLocked ?? false,
      photoRecords: (session.photoRecords ?? []).map((p) => ({
        ...p,
        department: p.department ?? session.department,
        inventoryDate: p.inventoryDate ?? session.inventoryDate,
      })),
    };
    if (normalized.inventoryDate !== session.inventoryDate) {
      persistence.saveSession(normalized);
    }
    return normalized;
  })(),
  history: (() => {
    const history = persistence.getHistory();
    const normalized = history.map((h) => ({
      ...h,
      inventoryDate: normalizeInventoryDate(h.inventoryDate),
      monthKey: h.monthKey ?? toMonthKey(h.inventoryDate),
      isLocked: h.isLocked ?? false,
      photoRecords: (h.photoRecords ?? []).map((p) => ({
        ...p,
        department: p.department ?? h.department,
        inventoryDate: p.inventoryDate ?? h.inventoryDate,
      })),
    }));
    if (JSON.stringify(history) !== JSON.stringify(normalized)) {
      persistence.saveHistory(normalized);
    }
    return normalized;
  })(),
  startSession: (payload) => {
    const prev = get().session;
    const history = get().history;
    const normalizedDate = normalizeInventoryDate(payload.inventoryDate);
    const mk = toMonthKey(normalizedDate);
    const targetKey = `${payload.department}-${mk}`;
    const currentKey =
      prev && `${prev.department}-${toMonthKey(normalizeInventoryDate(prev.inventoryDate))}`;

    // 既存の同じ事業部・同月のセッションがあれば再利用（写真を保持）
    if (prev && currentKey === targetKey) {
      const updated = { ...prev, ...payload, inventoryDate: normalizedDate, monthKey: mk };
      persistence.saveSession(updated);
      set({ session: updated, history });
      return updated;
    }

    let historyList = history;
    if (prev) {
      historyList = [...history.filter((h) => h.id !== prev.id), prev];
    }

    const matched = historyList.find(
      (h) => `${h.department}-${toMonthKey(h.inventoryDate)}` === targetKey,
    );
    if (matched) {
      const newHistory = historyList.filter((h) => h.id !== matched.id);
      const updated = { ...matched, ...payload, inventoryDate: normalizedDate, monthKey: mk };
      persistence.saveHistory(newHistory);
      persistence.saveSession(updated);
      set({ session: updated, history: newHistory });
      return updated;
    }

    const newSession: InventorySession = {
      ...payload,
      inventoryDate: normalizedDate,
      monthKey: mk,
      id: nanoid(),
      photoRecords: [],
    };
    persistence.saveHistory(historyList);
    persistence.saveSession(newSession);
    set({ session: newSession, history: historyList });
    return newSession;
  },
  addPhoto: (imageUrls) => {
    const current = get().session;
    if (!current || current.isLocked) return null;
    const first = imageUrls[0];
    if (!first) return null;
    const photo: PhotoRecord = {
      id: nanoid(),
      imageUrl: first,
      imageUrls: [...imageUrls],
      quantity: null,
      status: 'uncounted',
      productId: null,
      takenAt: new Date().toISOString(),
      department: current.department,
      inventoryDate: current.inventoryDate,
    };
    const updated: InventorySession = {
      ...current,
      photoRecords: [photo, ...current.photoRecords],
    };
    persistence.saveSession(updated);
    set({ session: updated });
    return photo;
  },
  addManualRecord: ({ productId, quantity, unitCost, unit }) => {
    const current = get().session;
    if (!current || current.isLocked) return null;
    const prod = useProductStore.getState().products.find((p) => p.id === productId);
    const photo: PhotoRecord = {
      id: nanoid(),
      imageUrl: '',
      imageUrls: [],
      quantity,
      status: 'assigned',
      productId,
      unitCost: unitCost ?? prod?.cost ?? null,
      unit: unit ?? prod?.unit,
      productName: prod?.name,
      productCd: prod?.productCd,
      productSupplierName: prod?.supplierName,
      productStorageType: prod?.storageType,
      takenAt: new Date().toISOString(),
      department: current.department,
      inventoryDate: current.inventoryDate,
    };
    const updated: InventorySession = {
      ...current,
      photoRecords: [photo, ...current.photoRecords],
    };
    persistence.saveSession(updated);
    set({ session: updated });
    return photo;
  },
  updateQuantity: (photoId, quantity, formula) => {
    const current = get().session;
    if (!current || current.isLocked) return;
    const photoRecords = current.photoRecords.map((p) =>
      p.id === photoId
        ? { ...p, quantity, quantityFormula: formula, status: 'counted' as const }
        : p,
    );
    const updated = { ...current, photoRecords };
    persistence.saveSession(updated);
    set({ session: updated });
  },
  deletePhoto: (photoId) => {
    const current = get().session;
    if (!current || current.isLocked) return;
    const updated = {
      ...current,
      photoRecords: current.photoRecords.filter((p) => p.id !== photoId),
    };
    persistence.saveSession(updated);
    set({ session: updated });
  },
  updatePhotoImages: (photoId, imageUrls) => {
    const current = get().session;
    if (!current || current.isLocked) return;
    const sanitized = imageUrls.filter((u) => u);
    const updated = {
      ...current,
      photoRecords: current.photoRecords.map((p) =>
        p.id === photoId
          ? {
              ...p,
              imageUrls: sanitized,
              imageUrl: sanitized[0] ?? p.imageUrl,
            }
          : p,
      ),
    };
    persistence.saveSession(updated);
    set({ session: updated });
  },
  assignProduct: (photoId, productId, unitCost, unit) => {
    const current = get().session;
    if (!current || current.isLocked) return;
    const prod = useProductStore.getState().products.find((p) => p.id === productId);
    const photoRecords = current.photoRecords.map((p) =>
      p.id === photoId
        ? {
            ...p,
            productId,
            status: 'assigned' as const,
            unitCost: unitCost ?? p.unitCost ?? prod?.cost ?? undefined,
            unit: unit ?? p.unit ?? prod?.unit ?? undefined,
            productName: prod?.name ?? p.productName,
            productCd: prod?.productCd ?? p.productCd,
            productSupplierName: prod?.supplierName ?? p.productSupplierName,
            productStorageType: prod?.storageType ?? p.productStorageType,
          }
        : p,
    );
    const updated = { ...current, photoRecords };
    persistence.saveSession(updated);
    set({ session: updated });
  },
  updateUnitCost: (productId, unitCost) => {
    const current = get().session;
    if (!current || current.isLocked) return;
    const photoRecords = current.photoRecords.map((p) =>
      p.productId === productId ? { ...p, unitCost } : p,
    );
    const updated = { ...current, photoRecords };
    persistence.saveSession(updated);
    set({ session: updated });
  },
  resetSession: () => {
    persistence.saveSession(null);
    set({ session: null });
  },
  setCurrentSession: (sessionId: string) => {
    const current = get().session;
    const history = get().history;
    if (current?.id === sessionId) return;
    const target = history.find((h) => h.id === sessionId);
    if (!target) return;
    const newHistory = current
      ? [current, ...history.filter((h) => h.id !== sessionId)]
      : history.filter((h) => h.id !== sessionId);
    persistence.saveSession(target);
    persistence.saveHistory(newHistory);
    set({ session: target, history: newHistory });
  },
  lockSession: (sessionId: string) => {
    const current = get().session;
    const history = get().history;
    const updateSession = (s: InventorySession) => ({ ...s, isLocked: true });
    const newCurrent = current && current.id === sessionId ? updateSession(current) : current;
    const newHistory = history.map((h) => (h.id === sessionId ? updateSession(h) : h));
    if (newCurrent) persistence.saveSession(newCurrent);
    persistence.saveHistory(newHistory);
    set({ session: newCurrent, history: newHistory });
  },
}));
