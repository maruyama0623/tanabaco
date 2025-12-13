import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { useSessionStore } from '../../store/sessionStore';
import { useProductStore } from '../../store/productStore';
import { PhotoCardDesktop } from '../../components/desktop/PhotoCardDesktop';
import { PhotoRecord, Product } from '../../types';
import {
  defaultDisplayMonthKey,
  toMonthEndDate,
  toMonthKey,
} from '../../utils/date';

export interface AssignContext {
  photo: PhotoRecord | null;
  products: Product[];
}

export function AssignListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSessionStore((s) => s.session);
  const history = useSessionStore((s) => s.history);
  const deletePhoto = useSessionStore((s) => s.deletePhoto);
  const products = useProductStore((s) => s.products);
  const [tab, setTab] = useState<'unassigned' | 'assigned'>('unassigned');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchSupplier, setSearchSupplier] = useState('');
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession);
  const sessions = useMemo(
    () => [...(session ? [session] : []), ...history],
    [history, session],
  );
  const sessionsWithPhotos = useMemo(
    () => sessions.filter((s) => (s.photoRecords ?? []).length > 0),
    [sessions],
  );

  const allMonths = useMemo(() => {
    const set = new Set<string>();
    sessionsWithPhotos.forEach((s) => set.add(toMonthKey(s.inventoryDate)));
    return Array.from(set).sort().reverse();
  }, [sessionsWithPhotos]);
  const defaultMonthKey = defaultDisplayMonthKey();
  const initialMonth = useMemo(
    () =>
      allMonths.includes(defaultMonthKey)
        ? defaultMonthKey
        : allMonths[0] ?? defaultMonthKey,
    [allMonths, defaultMonthKey],
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  useEffect(() => {
    if (!allMonths.length) {
      setSelectedMonth('');
      return;
    }
    if (!allMonths.includes(selectedMonth)) {
      const fallback = allMonths.includes(defaultMonthKey) ? defaultMonthKey : allMonths[0];
      if (fallback) setSelectedMonth(fallback);
    }
  }, [allMonths, selectedMonth, defaultMonthKey]);

  const monthDepts = useMemo(() => {
    const set = new Set<string>();
    sessionsWithPhotos
      .filter((s) => toMonthKey(s.inventoryDate) === selectedMonth)
      .forEach((s) => set.add(s.department));
    return Array.from(set);
  }, [sessionsWithPhotos, selectedMonth]);

  const [selectedDept, setSelectedDept] = useState<string>(monthDepts[0] ?? '');

  useEffect(() => {
    if (monthDepts.length && !monthDepts.includes(selectedDept)) {
      setSelectedDept(monthDepts[0]);
    }
  }, [monthDepts, selectedDept]);

  const deptSessions = useMemo(
    () => sessionsWithPhotos.filter((s) => s.department === selectedDept),
    [sessionsWithPhotos, selectedDept],
  );

  const activeSession = useMemo(() => {
    if (!selectedMonth) return deptSessions[0] ?? null;
    return (
      deptSessions.find((s) => toMonthKey(s.inventoryDate) === selectedMonth) ??
      deptSessions[0] ??
      null
    );
  }, [deptSessions, selectedMonth]);

  useEffect(() => {
    if (activeSession && activeSession.id !== session?.id) {
      setCurrentSession(activeSession.id);
    }
  }, [activeSession, session?.id, setCurrentSession]);

  const hasAnyPhoto = sessionsWithPhotos.length > 0;

  // handle deep link from report or external navigation
  useEffect(() => {
    const state = location.state as any;
    if (!state) return;
    if (state.tab === 'assigned') setTab('assigned');
    if (state.productId) {
      const prod = products.find((p) => p.id === state.productId);
      if (prod) {
        setSearchKeyword(prod.name);
        setSearchSupplier(prod.supplierName ?? '');
      }
    } else {
      if (state.keyword) setSearchKeyword(state.keyword);
      if (state.supplier) setSearchSupplier(state.supplier);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, products]);

  if (!session && !activeSession) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader title="商品割り当て" />
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-sm text-gray-600">
          <p>棚卸開始からセッションを作成してください。</p>
          <Button onClick={() => navigate('/start')}>棚卸開始へ</Button>
        </div>
      </div>
    );
  }

  const filtered =
    tab === 'unassigned'
      ? (activeSession?.photoRecords ?? []).filter((p) => !p.productId && p.status !== 'assigned')
      : (activeSession?.photoRecords ?? [])
          .filter((p) => p.status === 'assigned')
          .filter((p) => {
            const prod = products.find((prod) => prod.id === p.productId);
            if (!prod) return false;
            const normalize = (s: string) => {
              const nk = s.normalize('NFKC').toLowerCase();
              return Array.from(nk)
                .map((ch) => {
                  const code = ch.charCodeAt(0);
                  return code >= 0x30a1 && code <= 0x30f3 ? String.fromCharCode(code - 0x60) : ch;
                })
                .join('');
            };
            const kw = normalize(searchKeyword.trim());
            const sp = normalize(searchSupplier.trim());
            const nameN = normalize(prod?.name ?? '');
            const cdN = normalize(prod?.productCd ?? '');
            const supN = normalize(prod?.supplierName ?? '');
            const matchKeyword = kw ? nameN.includes(kw) || cdN.includes(kw) : true;
            const matchSupplier = sp ? supN.includes(sp) : true;
            return matchKeyword && matchSupplier;
          });

  const openModal = (id: string) => navigate(`modal/${id}`);
  const goReport = () => navigate('/report');
  const goProducts = () => navigate('/products');
  const locked = activeSession?.isLocked;

  if (!hasAnyPhoto) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader title="商品割り当て" />
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
          <p className="text-sm text-gray-600">まだ棚卸データがありません。棚卸開始を実行してください。</p>
          <Button onClick={() => navigate('/start')}>棚卸開始へ</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <AppHeader
        title="商品割り当て"
        rightSlot={
          <div className="hidden gap-2 md:flex">
            <Button variant="ghost" onClick={goProducts}>
              商品マスタ
            </Button>
            <Button variant="ghost" onClick={goReport}>
              棚卸表
            </Button>
          </div>
        }
      />
      <div className="px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-stretch gap-3 md:items-center">
          <div className="w-full rounded border border-border bg-muted px-3 py-2 text-sm md:w-auto md:min-w-[180px]">
            <div className="text-xs text-gray-500">表示月（棚卸日）</div>
            <select
              className="w-full bg-transparent text-base font-semibold outline-none"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {m}（{toMonthEndDate(m)}）
                </option>
              ))}
            </select>
          </div>
          <div className="w-full rounded border border-border bg-muted px-3 py-2 text-sm md:w-auto md:min-w-[180px]">
            <div className="text-xs text-gray-500">事業部</div>
            <select
              className="w-full bg-transparent text-base font-semibold outline-none"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {monthDepts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 md:ml-auto">
            <TabButton active={tab === 'unassigned'} onClick={() => setTab('unassigned')}>
              未割り当て
            </TabButton>
            <TabButton active={tab === 'assigned'} onClick={() => setTab('assigned')}>
              割り当て済み
            </TabButton>
          </div>
        </div>
        {tab === 'assigned' && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded border border-border bg-muted px-4 py-3">
            <div className="flex w-full flex-col md:w-auto">
              <label className="text-xs text-gray-500">商品名</label>
              <input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="商品名を入力"
                className="w-full min-w-[240px] rounded border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex w-full flex-col md:w-auto">
              <label className="text-xs text-gray-500">仕入先</label>
              <input
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
                placeholder="仕入先を入力"
                className="w-full min-w-[240px] rounded border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setSearchKeyword('');
                setSearchSupplier('');
              }}
            >
              リセット
            </Button>
          </div>
        )}
        {locked && (
          <div className="mt-4 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
            この月は確定済みのため編集できません
          </div>
        )}
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {filtered.map((photo) => (
            <PhotoCardDesktop
              key={photo.id}
              photo={photo}
              product={products.find((p) => p.id === photo.productId)}
              onAssign={() => openModal(photo.id)}
              onDelete={() => deletePhoto(photo.id)}
              onEditQuantity={() => navigate(`/count/${photo.id}`, { state: { from: 'assign' } })}
              disabled={locked}
            />
          ))}
          {!filtered.length && (
            <div className="col-span-full rounded border border-dashed border-border p-6 text-center text-gray-500">
              {tab === 'unassigned' ? '未割り当ての写真はありません' : '割り当て済みの写真はありません'}
            </div>
          )}
        </div>
      </div>
      <Outlet />
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-4 py-2 text-sm font-semibold ${
        active ? 'border-primary bg-primary text-white' : 'border-border bg-white text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}
