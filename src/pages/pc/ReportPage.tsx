import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { useSessionStore } from '../../store/sessionStore';
import { useProductStore } from '../../store/productStore';
import { exportCsv } from '../../services/reportService';
import { toMonthEndDate, toMonthKey } from '../../utils/date';
import { formatNumber, formatYen } from '../../utils/number';
import { Modal } from '../../components/common/Modal';
import { Product } from '../../types';

export function ReportPage() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const history = useSessionStore((s) => s.history);
  const products = useProductStore((s) => s.products);
  const addProduct = useProductStore((s) => s.addProduct);
  const lockSession = useSessionStore((s) => s.lockSession);
  const updateUnitCost = useSessionStore((s) => s.updateUnitCost);
  const updateProduct = useProductStore((s) => s.updateProduct);
  const addManualRecord = useSessionStore((s) => s.addManualRecord);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [addQty, setAddQty] = useState<number>(1);
  const [addUnitCost, setAddUnitCost] = useState<number>(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProd, setNewProd] = useState<{
    name: string;
    productCd: string;
    supplierName: string;
    spec: string;
    storageType: Product['storageType'];
    cost: number;
    unit: string;
  }>({
    name: '',
    productCd: '',
    supplierName: '',
    spec: '',
    storageType: 'その他',
    cost: 0,
    unit: 'P',
  });

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    if (session) set.add(session.department);
    history.forEach((h) => set.add(h.department));
    return Array.from(set);
  }, [history, session]);

  const [selectedDept, setSelectedDept] = useState<string>(session?.department ?? history[0]?.department ?? '');

  useEffect(() => {
    if (!availableDepartments.includes(selectedDept) && availableDepartments.length) {
      setSelectedDept(availableDepartments[0]);
    }
  }, [availableDepartments, selectedDept]);

  const months = useMemo(() => {
    const set = new Set<string>();
    if (session && session.department === selectedDept) {
      set.add(toMonthKey(session.inventoryDate));
    }
    history
      .filter((h) => h.department === selectedDept)
      .forEach((h) => set.add(toMonthKey(h.inventoryDate)));
    return Array.from(set).sort().reverse();
  }, [history, selectedDept, session]);

  const previousMonthKey = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const initialMonth = useMemo(
    () => (months.includes(previousMonthKey) ? previousMonthKey : months[0] ?? previousMonthKey),
    [months, previousMonthKey],
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  useEffect(() => {
    if (!months.length) return;
    if (!months.includes(selectedMonth)) {
      const fallback = months.includes(previousMonthKey) ? previousMonthKey : months[0];
      if (fallback) setSelectedMonth(fallback);
    }
  }, [months, selectedMonth, previousMonthKey]);

  const findSessionByMonth = (month: string) => {
    if (
      session &&
      session.department === selectedDept &&
      toMonthKey(session.inventoryDate) === month
    ) {
      return session;
    }
    return (
      history.find(
        (h) => h.department === selectedDept && toMonthKey(h.inventoryDate) === month,
      ) || null
    );
  };

  if (!session && history.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader title="棚卸表" />
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center text-sm text-gray-600">
          <p>表示できる棚卸データがありません。棚卸開始から登録してください。</p>
          <Button onClick={() => navigate('/start')}>棚卸開始へ</Button>
        </div>
      </div>
    );
  }
  const currentSession = findSessionByMonth(selectedMonth);
  const prevMonthKey = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, (m || 1) - 2, 1);
    const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevDate.getFullYear()}-${mm}`;
  }, [selectedMonth]);
  const prevSession = findSessionByMonth(prevMonthKey);
  const isLocked = currentSession?.isLocked;

  const handleLock = async () => {
    if (!currentSession) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api'}/session/lock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSession.id, session: currentSession }),
        },
      );
      if (!res.ok) throw new Error(`lock failed: ${res.status}`);
      lockSession(currentSession.id);
      alert('確定しました');
    } catch (e) {
      console.error(e);
      alert('確定に失敗しました');
    }
  };

  const handleCostUpdate = (productId: string, cost: number) => {
    updateProduct(productId, { cost });
    updateUnitCost(productId, cost);
  };

  const aggregate = (photos: typeof session.photoRecords | undefined) => {
    const map = new Map<
      string,
      {
        product: typeof products[number] | null;
        quantity: number;
        amount: number;
        unitCost: number;
        unit: string;
        productCd?: string;
        productSupplierName?: string;
        productStorageType?: Product['storageType'];
      }
    >();
    if (!photos) return map;
    photos.forEach((photo) => {
      if (photo.status !== 'assigned' || !photo.productId || photo.quantity == null) return;
      const product = products.find((p) => p.id === photo.productId) ?? null;
      const cost = photo.unitCost ?? product?.cost ?? 0;
      const unit = photo.unit ?? product?.unit ?? 'P';
      const entry =
        map.get(photo.productId) || {
          product,
          quantity: 0,
          amount: 0,
          unitCost: cost,
          unit,
          productCd: photo.productCd,
          productSupplierName: photo.productSupplierName,
          productStorageType: photo.productStorageType,
        };
      entry.quantity += photo.quantity;
      entry.unitCost = cost;
      entry.unit = unit;
      entry.productCd = entry.productCd ?? photo.productCd;
      entry.productSupplierName = entry.productSupplierName ?? photo.productSupplierName;
      entry.productStorageType = entry.productStorageType ?? photo.productStorageType;
      entry.amount = entry.quantity * entry.unitCost;
      map.set(photo.productId, entry);
    });
    return map;
  };

  const currentMap = aggregate(currentSession?.photoRecords);
  const prevMap = aggregate(prevSession?.photoRecords);

  const rows = Array.from(new Set([...currentMap.keys(), ...prevMap.keys()]))
    .map((productId) => {
      const curr = currentMap.get(productId);
      const prev = prevMap.get(productId);
      const product = curr?.product ?? prev?.product ?? null;
      const fallbackName =
        curr?.product?.name ??
        prev?.product?.name ??
        curr?.productCd ??
        prev?.productCd ??
        '未設定';
      const fallbackUnit =
        curr?.unit ??
        prev?.unit ??
        curr?.product?.unit ??
        prev?.product?.unit ??
        'P';
      const fallbackCost = curr?.unitCost ?? prev?.unitCost ?? 0;
      const unitCost = curr?.unitCost ?? fallbackCost;
      const prevCost = prev?.unitCost ?? fallbackCost;
      const unit = fallbackUnit;
      const prevUnit = fallbackUnit;
      const quantity = curr?.quantity ?? 0;
      const amount = quantity * unitCost;
      const prevQuantity = prev?.quantity ?? 0;
      const prevAmount = prevQuantity * prevCost;
      return {
        product: product ?? {
          id: productId,
          name: fallbackName,
          productCd: curr?.productCd ?? prev?.productCd ?? '',
          supplierName: curr?.productSupplierName ?? prev?.productSupplierName ?? '',
          storageType: curr?.productStorageType ?? prev?.productStorageType,
          cost: unitCost,
          unit,
          departments: [],
          supplierCd: '',
          spec: '',
          imageUrls: [],
          createdAt: '',
          updatedAt: '',
        },
        unitCost,
        prevCost,
        unit,
        prevUnit,
        quantity,
        amount,
        prevQuantity,
        prevAmount,
        qtyDiff: quantity - prevQuantity,
        amountDiff: amount - prevAmount,
      };
    })
    .filter(Boolean) as {
      product: (typeof products)[number];
      unitCost: number;
      prevCost: number;
      unit: string;
      prevUnit: string;
      quantity: number;
      amount: number;
      prevQuantity: number;
      prevAmount: number;
      qtyDiff: number;
      amountDiff: number;
    }[];

  const total = rows.reduce((acc, r) => acc + r.amount, 0);
  const prevTotal = rows.reduce((acc, r) => acc + r.prevAmount, 0);
  const diff = total - prevTotal;

  const productChoices = useMemo(() => {
    const kw = addSearch.trim().toLowerCase();
    return products.filter((p) => {
      const deptMatch = selectedDept ? p.departments.includes(selectedDept) : true;
      const nameMatch = kw
        ? [p.name, p.productCd, p.supplierName].some((v) => v?.toLowerCase().includes(kw))
        : true;
      return deptMatch && nameMatch;
    });
  }, [addSearch, products, selectedDept]);

  useEffect(() => {
    if (productChoices.length && !selectedProductId) {
      const first = productChoices[0];
      setSelectedProductId(first.id);
      setAddUnitCost(first.cost);
    } else if (selectedProductId) {
      const prod = products.find((p) => p.id === selectedProductId);
      if (prod) {
        setAddUnitCost(prod.cost);
      }
    }
  }, [productChoices, products, selectedProductId]);

  const handleAddManual = () => {
    if (!currentSession || !selectedProductId || addQty <= 0) return;
    const selectedProd = products.find((p) => p.id === selectedProductId);
    if (selectedProd && addUnitCost !== selectedProd.cost) {
      updateProduct(selectedProd.id, { cost: addUnitCost });
    }
    addManualRecord({
      productId: selectedProductId,
      quantity: addQty,
      unitCost: addUnitCost,
      unit: selectedProd?.unit ?? 'P',
    });
    setShowAddModal(false);
  };

  const handleCreateProduct = () => {
    if (!newProd.name.trim()) {
      alert('商品名を入力してください');
      return;
    }
    const product = addProduct({
      ...newProd,
      supplierCd: '',
      departments: selectedDept ? [selectedDept] : [],
      imageUrls: [],
    });
    setShowCreateForm(false);
    setAddSearch('');
    setSelectedProductId(product.id);
    setAddUnitCost(product.cost);
    setNewProd({
      name: '',
      productCd: '',
      supplierName: '',
      spec: '',
      storageType: 'その他',
      cost: 0,
      unit: 'P',
    });
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <AppHeader
        title="棚卸表"
        rightSlot={
          <div className="relative">
            <Button
              variant="ghost"
              className="rounded-full px-3 py-2"
              onClick={() => setShowDesktopMenu((v) => !v)}
            >
              ⋮
            </Button>
            {showDesktopMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowDesktopMenu(false)} />
                <div className="absolute right-0 top-12 z-40 w-48 overflow-hidden rounded border border-border bg-white shadow-lg">
                  <button
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-muted disabled:text-gray-400"
                    disabled={!currentSession || isLocked}
                    onClick={() => {
                      setShowDesktopMenu(false);
                      setLockConfirmOpen(true);
                    }}
                  >
                    {isLocked ? '確定済み' : '棚卸を完了する'}
                  </button>
                  <button
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
                    onClick={() => {
                      setShowDesktopMenu(false);
                      exportCsv(rows);
                    }}
                  >
                    CSVを出力する
                  </button>
                </div>
              </>
            )}
          </div>
        }
        rightSlotMobile={
          <div className="relative">
            <button
              aria-label="more actions"
              className="flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none hover:bg-gray-100"
              onClick={() => setShowMobileMenu((v) => !v)}
            >
              ⋮
            </button>
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMobileMenu(false)} />
                <div className="absolute right-0 top-10 z-40 w-44 overflow-hidden rounded border border-border bg-white shadow-lg">
                  <button
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-muted disabled:text-gray-400"
                    disabled={!currentSession || isLocked}
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowAddModal(true);
                    }}
                  >
                    商品を追加する
                  </button>
                  <button
                    className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
                    disabled={!currentSession || isLocked}
                    onClick={() => {
                      setShowMobileMenu(false);
                      setLockConfirmOpen(true);
                    }}
                  >
                    {isLocked ? '確定済み' : '棚卸完了する'}
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />
      <div className="px-4 py-4 md:px-6">
        <div className="mb-4 grid grid-cols-1 items-stretch gap-3 md:grid-cols-5">
          <div className="w-full rounded border border-border bg-muted px-4 py-3">
            <div className="text-xs text-gray-500">表示月（棚卸日）</div>
            <select
              className="w-full bg-transparent text-lg font-semibold outline-none"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}（{toMonthEndDate(m)}）
                </option>
              ))}
            </select>
          </div>
          <div className="w-full rounded border border-border bg-muted px-4 py-3">
            <div className="text-xs text-gray-500">事業部</div>
            <select
              className="w-full bg-transparent text-lg font-semibold outline-none"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {availableDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <SummaryCard label="当月棚卸金額" value={formatYen(total)} full />
          <SummaryCard label="前月棚卸金額" value={formatYen(prevTotal)} full />
          <SummaryCard
            label="金額差異"
            value={formatYen(diff)}
            highlight={diff >= 0 ? 'text-primary' : 'text-red-500'}
            full
          />
        </div>
        <div className="overflow-auto border border-border hidden md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  '商品CD',
                  '商品名',
                  '規格',
                  '仕入先',
                  '当月在庫',
                  '当月棚卸金額',
                  '前月在庫',
                  '前月棚卸金額',
                  '数量差異',
                  '金額差異',
                  '操作',
                ].map((h) => (
                  <th key={h} className="border border-border px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const editable = currentSession && !isLocked && currentMap.has(row.product.id);
                return (
                  <tr key={row.product.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border border-border px-3 py-2">{row.product.productCd}</td>
                  <td className="border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.product.storageType && (
                        <span className="rounded bg-[#e6f1ff] px-2 py-0.5 text-xs text-primary">
                          {row.product.storageType}
                        </span>
                      )}
                      <span className="font-semibold">{row.product.name}</span>
                    </div>
                  </td>
                  <td className="border border-border px-3 py-2">{row.product.spec}</td>
                  <td className="border border-border px-3 py-2">{row.product.supplierName}</td>
                  <td className="border border-border px-3 py-2">
                    {formatNumber(row.quantity)}
                    {row.unit || 'P'}
                    <br />
                    {editable ? (
                      <div className="mt-1 flex items-center gap-1 text-sm text-gray-700">
                        <span>¥</span>
                        <div className="flex items-center rounded border border-border bg-white px-2 py-1">
                          <input
                            type="text"
                            className="w-24 text-right text-sm outline-none"
                            value={formatNumber(row.unitCost)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/,/g, '');
                              const num = Number(raw);
                              if (!Number.isNaN(num)) handleCostUpdate(row.product.id, num);
                            }}
                          />
                        </div>
                        <span>/ {row.unit || '単位'}</span>
                      </div>
                    ) : (
                      `${formatYen(row.unitCost)}/${row.unit || 'P'}`
                    )}
                  </td>
                  <td className="border border-border px-3 py-2">{formatYen(row.amount)}</td>
                  <td className="border border-border px-3 py-2">
                    {formatNumber(row.prevQuantity)}
                    {row.prevUnit || 'P'}
                    <br />
                    {formatYen(row.prevCost)}/PC
                  </td>
                  <td className="border border-border px-3 py-2">{formatYen(row.prevAmount)}</td>
                  <td className="border border-border px-3 py-2">{formatNumber(row.qtyDiff)}</td>
                  <td
                    className={`border border-border px-3 py-2 ${
                      row.amountDiff >= 0 ? 'text-primary' : 'text-red-500'
                    }`}
                  >
                    {formatYen(row.amountDiff)}
                  </td>
                  <td className="border border-border px-3 py-2">
                    {isLocked ? (
                      <Button variant="ghost" size="sm">
                        詳細
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate('/assign', {
                            state: {
                              tab: 'assigned',
                              productId: row.product.id,
                            },
                          })
                        }
                      >
                        変更
                      </Button>
                    )}
                  </td>
                </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-gray-500">
                    割り当て済みの商品がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div key={row.product.id} className="rounded border border-border bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500">{row.product.productCd}</div>
                {row.product.storageType && (
                  <span className="rounded bg-[#e6f1ff] px-2 py-0.5 text-xs text-primary">
                    {row.product.storageType}
                  </span>
                )}
              </div>
              <div className="text-base font-semibold">{row.product.name}</div>
              <div className="text-sm text-gray-600">{row.product.spec}</div>
              <div className="mt-1 text-sm text-gray-600">{row.product.supplierName}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">当月在庫</div>
                  <div className="font-semibold">
                    {formatNumber(row.quantity)}
                    {row.unit || 'P'}
                  </div>
                  <div className="text-xs text-gray-500">単価</div>
                  <div className="font-semibold">
                    {formatYen(row.unitCost)}/{row.unit || 'P'}
                  </div>
                  <div className="text-xs text-gray-500">当月棚卸金額</div>
                  <div className="font-semibold">{formatYen(row.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">前月在庫</div>
                  <div className="font-semibold">
                    {formatNumber(row.prevQuantity)}
                    {row.prevUnit || 'P'}
                  </div>
                  <div className="text-xs text-gray-500">前月単価</div>
                  <div className="font-semibold">
                    {formatYen(row.prevCost)}/{row.prevUnit || 'P'}
                  </div>
                  <div className="text-xs text-gray-500">前月棚卸金額</div>
                  <div className="font-semibold">{formatYen(row.prevAmount)}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <div>
                  <div className="text-xs text-gray-500">数量差異</div>
                  <div className="font-semibold">{formatNumber(row.qtyDiff)}</div>
                </div>
                <div className={row.amountDiff >= 0 ? 'text-primary' : 'text-red-500'}>
                  <div className="text-xs text-gray-500">金額差異</div>
                  <div className="font-semibold">{formatYen(row.amountDiff)}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {isLocked ? (
                  <Button variant="ghost" size="sm" className="flex-1">
                    詳細
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      navigate('/assign', {
                        state: {
                          tab: 'assigned',
                          productId: row.product.id,
                        },
                      })
                    }
                  >
                    変更
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!rows.length && (
            <div className="rounded border border-dashed border-border p-6 text-center text-gray-500">
              割り当て済みの商品がありません
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pb-4 pt-3 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.2)] hidden md:block">
        <div className="mx-auto w-full max-w-5xl">
          <Button
            variant="secondary"
            className="w-full rounded-lg px-6 py-3 text-base font-semibold"
            disabled={!currentSession || isLocked}
            onClick={() => setShowAddModal(true)}
          >
            商品を追加する
          </Button>
        </div>
      </div>
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">棚卸商品を追加</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">既存の商品を追加</span>
              <Button variant="secondary" size="sm" onClick={() => setShowCreateForm((v) => !v)}>
                {showCreateForm ? '既存から選ぶ' : '新規商品を登録'}
              </Button>
            </div>
            {!showCreateForm && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">商品検索</span>
                  <input
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                    placeholder="商品名・コード・仕入先で検索"
                    className="rounded border border-border px-3 py-2"
                  />
                </label>
                <div className="max-h-52 overflow-y-auto rounded border border-border">
                  {productChoices.map((p) => (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                        selectedProductId === p.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="add-product"
                        checked={selectedProductId === p.id}
                        onChange={() => {
                          setSelectedProductId(p.id);
                          setAddUnitCost(p.cost);
                          setAddUnit(p.unit ?? 'P');
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="text-xs text-gray-500">{p.productCd}</span>
                        <span className="text-xs text-gray-500">{p.supplierName}</span>
                      </div>
                      <div className="ml-auto text-sm text-gray-600">
                        {formatYen(p.cost)}/{p.unit ?? 'P'}
                      </div>
                    </label>
                  ))}
                  {!productChoices.length && (
                    <div className="px-3 py-4 text-sm text-gray-500">対象の商品がありません</div>
                  )}
                </div>
              </>
            )}
            {showCreateForm && (
              <div className="space-y-3 rounded border border-border p-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">商品名</span>
                  <input
                    value={newProd.name}
                    onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                    className="rounded border border-border px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">自社管理商品CD</span>
                  <input
                    value={newProd.productCd}
                    onChange={(e) => setNewProd({ ...newProd, productCd: e.target.value })}
                    className="rounded border border-border px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">仕入先</span>
                  <input
                    value={newProd.supplierName}
                    onChange={(e) => setNewProd({ ...newProd, supplierName: e.target.value })}
                    className="rounded border border-border px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">規格</span>
                  <input
                    value={newProd.spec}
                    onChange={(e) => setNewProd({ ...newProd, spec: e.target.value })}
                    className="rounded border border-border px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">単価</span>
                  <div className="flex items-center rounded border border-border px-3 py-2">
                    <span className="mr-2 text-sm text-gray-600">¥</span>
                    <input
                      value={newProd.cost.toLocaleString('ja-JP')}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/,/g, '');
                        const num = Number(raw);
                        if (!Number.isNaN(num)) setNewProd({ ...newProd, cost: num });
                      }}
                      className="w-full text-right outline-none"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">単位</span>
                  <input
                    value={newProd.unit}
                    onChange={(e) => setNewProd({ ...newProd, unit: e.target.value })}
                    className="rounded border border-border px-3 py-2"
                  />
                </label>
              <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-gray-700">保存区分</span>
                  <select
                    value={newProd.storageType}
                    onChange={(e) =>
                      setNewProd({ ...newProd, storageType: e.target.value as Product['storageType'] })
                    }
                    className="rounded border border-border px-3 py-2"
                  >
                    <option value="冷凍">冷凍</option>
                    <option value="冷蔵">冷蔵</option>
                    <option value="常温">常温</option>
                    <option value="その他">その他</option>
                  </select>
                </label>
                <Button onClick={handleCreateProduct} className="w-full">
                  商品を登録する
                </Button>
              </div>
            )}
            {!showCreateForm && (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-700">数量</span>
                    <input
                      type="number"
                      min={0}
                      value={addQty}
                      onChange={(e) => setAddQty(Number(e.target.value))}
                      className="w-full rounded border border-border px-3 py-2 h-[44px]"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-700">単価</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded border border-border px-3 py-2 h-[44px] flex-1">
                        <span className="mr-2 text-sm text-gray-600">¥</span>
                        <input
                          type="text"
                          value={addUnitCost.toLocaleString('ja-JP')}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/,/g, '');
                            const num = Number(raw);
                            if (!Number.isNaN(num)) setAddUnitCost(num);
                          }}
                          className="w-full text-right outline-none"
                        />
                      </div>
                      <span className="text-sm text-gray-600">
                        / {products.find((p) => p.id === selectedProductId)?.unit || '単位'}
                      </span>
                    </div>
                  </label>
                </div>
              </>
            )}
          </div>
          {!showCreateForm && (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddManual} disabled={!currentSession || isLocked || !selectedProductId}>
                追加する
              </Button>
            </div>
          )}
        </div>
      </Modal>
      <Modal open={lockConfirmOpen} onClose={() => setLockConfirmOpen(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">この月を確定しますか？</h3>
          <p className="text-sm text-gray-700">
            確定すると表示月（{selectedMonth}）の数量変更や写真削除、商品割り当て変更はできなくなります。
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setLockConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={async () => {
                setLockConfirmOpen(false);
                await handleLock();
              }}
            >
              確定する
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
  full,
}: {
  label: string;
  value: string;
  highlight?: string;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded border border-border bg-muted px-4 py-3 ${
        full ? 'w-full' : 'min-w-[180px]'
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${highlight ?? ''}`}>{value}</div>
    </div>
  );
}
