import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../../components/common/Modal';
import { ProductCard } from '../../components/desktop/ProductCard';
import { useSessionStore } from '../../store/sessionStore';
import { useProductStore } from '../../store/productStore';
import { Button } from '../../components/common/Button';
import { Product } from '../../types';
import { SupplierSelector } from '../../components/common/SupplierSelector';
import { useMasterStore } from '../../store/masterStore';
import { requestAiSearch } from '../../services/aiSearchService';

type Tab = 'ai' | 'search' | 'register';
type LensState = { visible: boolean; x: number; y: number; width: number; height: number };

export function AssignModal() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const session = useSessionStore((s) => s.session);
  const history = useSessionStore((s) => s.history);
  const assignProduct = useSessionStore((s) => s.assignProduct);
  const { addProduct, updateProduct, products } = useProductStore();
  const departments = useMasterStore((s) => s.departments);
  const allPhotos = [
    ...(session?.photoRecords ?? []),
    ...history.flatMap((h) => h.photoRecords ?? []),
  ];
  const photo = allPhotos.find((p) => p.id === photoId) || null;
  const existingProduct = photo?.productId
    ? products.find((p) => p.id === photo.productId) ?? null
    : null;
  const [selected, setSelected] = useState<string | null>(photo?.productId ?? null);
  const [keyword, setKeyword] = useState('');
  const [supplier, setSupplier] = useState('');
  const [tab, setTab] = useState<Tab>(existingProduct ? 'register' : 'ai');
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<string[]>([]);
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>(() => {
    if (existingProduct) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existingProduct;
      return {
        ...rest,
        storageType: (rest.storageType ?? 'その他') as Product['storageType'],
        unit: rest.unit ?? 'P',
        imageUrls: [...(rest.imageUrls ?? [])],
        departments: [...(rest.departments ?? [])],
      };
    }
    return {
      productCd: '',
      name: '',
      cost: 0,
      departments: session?.department ? [session.department] : [],
      supplierName: '',
      supplierCd: '',
      spec: '',
      storageType: 'その他' as Product['storageType'],
      unit: 'P',
      imageUrls:
        photo?.imageUrls && photo.imageUrls.length
          ? [...photo.imageUrls]
          : photo
            ? [photo.imageUrl]
            : [],
    };
  });
  const photoImages = useMemo(
    () => (photo?.imageUrls?.length ? photo.imageUrls : photo ? [photo.imageUrl] : []),
    [photo],
  );
  const [currentImage, setCurrentImage] = useState(photoImages[0] ?? '');
  const [isDesktop, setIsDesktop] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  );
  const [lens, setLens] = useState<LensState>({ visible: false, x: 0, y: 0, width: 0, height: 0 });

  const searchResults = useMemo(() => {
    const normalize = (s: string) => {
      const nk = s.normalize('NFKC').toLowerCase();
      const hira = Array.from(nk)
        .map((ch) => {
          const code = ch.charCodeAt(0);
          return code >= 0x30a1 && code <= 0x30f3 ? String.fromCharCode(code - 0x60) : ch;
        })
        .join('');
      return hira.replace(/[\s\u3000]+/g, '');
    };
    const kw = normalize(keyword.trim());
    const sp = normalize(supplier.trim());
    return products.filter((p) => {
      const nameN = normalize(p.name ?? '');
      const cdN = normalize(p.productCd ?? '');
      const supN = normalize(p.supplierName ?? '');
      const matchKw = kw ? nameN.includes(kw) || cdN.includes(kw) : true;
      const matchSp = sp ? supN.includes(sp) : true;
      const matchDept = session?.department
        ? // 部門未設定の商品は全事業部で検索可とする
          ((p.departments ?? []).length === 0 || (p.departments ?? []).includes(session.department))
        : true;
      return matchKw && matchSp && matchDept;
    });
  }, [keyword, supplier, products, session?.department]);
  const aiCandidates = useMemo(
    () => aiResults.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[],
    [aiResults, products],
  );
  const primaryPhotoUrl = currentImage || photoImages[0] || '';

  useEffect(() => {
    if (photoImages.length) {
      setCurrentImage(photoImages[0]);
    }
  }, [photoImages]);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // 既存商品の編集モードではフォームを最新の値で埋める
  useEffect(() => {
    if (existingProduct && tab === 'register') {
      setDraft({
        productCd: existingProduct.productCd,
        name: existingProduct.name,
        cost: existingProduct.cost,
        departments: [...(existingProduct.departments ?? [])],
        supplierName: existingProduct.supplierName,
        supplierCd: existingProduct.supplierCd ?? '',
        spec: existingProduct.spec ?? '',
        storageType: (existingProduct.storageType ?? 'その他') as Product['storageType'],
        unit: existingProduct.unit ?? 'P',
        imageUrls: [...(existingProduct.imageUrls ?? [])],
      });
    }
  }, [existingProduct, tab]);

  const locked = session?.isLocked;

  const close = () => navigate('/assign');

  if (!photo) return null;

  const handleRegister = () => {
    if (existingProduct) {
      // 上書き更新
      useProductStore.getState().updateProduct(existingProduct.id, { ...draft, departments: draft.departments });
      setSelected(existingProduct.id);
      return existingProduct.id;
    }
    const created = addProduct({ ...draft, departments: draft.departments });
    setSelected(created.id);
    return created.id;
  };

  const handleConfirm = () => {
    if (!photoId || locked) return;
    let targetId = selected;

    // 既存商品を更新するケース
    if (tab === 'register' && existingProduct && targetId === existingProduct.id) {
      updateProduct(existingProduct.id, { ...draft, departments: draft.departments });
    } else if (!targetId && tab === 'register') {
      // 新規登録ケース
      targetId = handleRegister();
      setSelected(targetId);
    }

    const product = products.find((p) => p.id === targetId);
    if (photoId && targetId) {
      assignProduct(photoId, targetId, product?.cost, product?.unit);
      navigate('/assign');
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ai', label: 'AI検索' },
    { key: 'search', label: '商品検索' },
    { key: 'register', label: existingProduct ? '商品更新' : '商品登録' },
  ];

  const runAiSearch = async () => {
    if (!photo) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await requestAiSearch({
        query: aiQuery.trim(),
        photoUrl: primaryPhotoUrl,
        department: session?.department,
      });
      const suggestions = (res.suggestions ?? []).filter((s) => s.productId);
      setAiReasons(
        Object.fromEntries(suggestions.map((s) => [s.productId, s.reason ?? '']).filter(([id]) => !!id)),
      );
      const ids = suggestions
        .map((s) => s.productId)
        .filter((id) => !!id && products.some((p) => p.id === id));
      setAiResults(ids);
      if (!ids.length) {
        setAiError('AI検索で該当候補が見つかりませんでした');
      } else if (!selected) {
        setSelected(ids[0]);
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI検索に失敗しました');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Modal open onClose={close}>
      <div className="flex max-h-[80vh] flex-col overflow-hidden pr-1">
        <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden lg:flex-row lg:gap-6">
          <div className="hidden space-y-3 lg:block lg:w-1/2 lg:max-h-[72vh] lg:overflow-hidden">
            <h3 className="text-lg font-semibold">撮影した画像一覧</h3>
            <div
              className="relative overflow-hidden rounded-lg border border-border bg-white shadow-sm"
              onMouseEnter={(e) => {
                if (!isDesktop || !primaryPhotoUrl) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setLens({ visible: true, x: 0, y: 0, width: rect.width, height: rect.height });
              }}
              onMouseLeave={() => setLens((prev) => ({ ...prev, visible: false }))}
              onMouseMove={(e) => {
                if (!isDesktop || !primaryPhotoUrl) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setLens({ visible: true, x, y, width: rect.width, height: rect.height });
              }}
            >
              {primaryPhotoUrl ? (
                <img
                  src={primaryPhotoUrl}
                  alt="撮影画像"
                  className="h-full w-full max-h-[240px] bg-gray-50 object-contain md:max-h-[320px] lg:max-h-[360px]"
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">画像がありません</div>
              )}
              {isDesktop && lens.visible && primaryPhotoUrl && lens.width > 0 && lens.height > 0 && (
                <div
                  className="pointer-events-none absolute hidden h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary shadow-lg lg:block"
                  style={{
                    top: lens.y,
                    left: lens.x,
                    backgroundImage: `url(${primaryPhotoUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${lens.width * 2}px ${lens.height * 2}px`,
                    backgroundPosition: `${-(lens.x * 2 - 64)}px ${-(lens.y * 2 - 64)}px`,
                  }}
                />
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photoImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImage(img)}
                  className={`h-20 w-24 flex-shrink-0 overflow-hidden rounded border ${
                    currentImage === img ? 'border-primary ring-2 ring-primary/40' : 'border-border'
                  }`}
                >
                  <img src={img} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex w-full min-h-0 flex-col gap-3 lg:w-1/2 lg:max-h-[72vh] lg:overflow-hidden">
            <div className="flex gap-2 shrink-0">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => !locked && setTab(t.key)}
                  className={`rounded border px-3 py-2 text-sm font-semibold ${
                    tab === t.key ? 'border-primary bg-primary text-white' : 'border-border bg-white text-gray-700'
                  }`}
                  disabled={locked}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {locked && (
              <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                この月は確定済みのため商品割り当ては変更できません
              </div>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto pr-1 min-h-0">
              {tab === 'ai' && (
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">AI検索</h3>
                  <p className="text-sm text-gray-600">
                    商品の特徴や用途をメモすると、写真とマスタ情報を元にChatGPTが候補を提案します。
                  </p>
                  <textarea
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="例: 業務用・冷凍ポテト / 1kg / サラダバー向け など"
                    className="min-h-[92px] w-full rounded border border-border px-3 py-2 text-sm"
                    disabled={locked}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={runAiSearch} disabled={locked || aiLoading || !products.length}>
                      {aiLoading ? 'AIが検索中…' : 'AIに聞く'}
                    </Button>
                    {aiError && <span className="text-sm text-red-600">{aiError}</span>}
                    {!aiError && !aiCandidates.length && (
                      <span className="text-xs text-gray-500">
                        メモを入力して「AIに聞く」を押すと候補が表示されます
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {aiCandidates.length ? (
                      aiCandidates.map((prod) => (
                        <div key={prod.id} className="space-y-1">
                          <ProductCard
                            product={prod}
                            selected={selected === prod.id}
                            onSelect={() => setSelected(prod.id)}
                          />
                          {aiReasons[prod.id] && (
                            <div className="rounded border border-dashed border-border px-3 py-2 text-xs text-gray-600">
                              {aiReasons[prod.id]}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded border border-dashed border-border p-3 text-sm text-gray-500">
                        {aiLoading ? 'AIが候補を探しています…' : 'AI検索の結果がここに表示されます'}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {tab === 'search' && (
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">商品検索</h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input
                      placeholder="商品名"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="w-full rounded border border-border px-3 py-2"
                    />
                    <input
                      placeholder="仕入先"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      className="w-full rounded border border-border px-3 py-2"
                    />
                  </div>
                  <div className="space-y-2">
                    {searchResults.length ? (
                      searchResults.map((prod) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          selected={selected === prod.id}
                          onSelect={() => setSelected(prod.id)}
                        />
                      ))
                    ) : (
                      <div className="rounded border border-dashed border-border p-3 text-sm text-gray-500">
                        該当の商品がありません
                      </div>
                    )}
                  </div>
                </section>
              )}

              {tab === 'register' && (
                <section className="space-y-3">
                  <h3 className="text-lg font-semibold">商品を登録する</h3>
                  <div className="flex flex-col gap-3 rounded border border-border p-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">商品名</span>
                      <input
                        placeholder="商品名"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="rounded border border-border px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">自社管理商品CD</span>
                      <input
                        placeholder="自社管理商品CD"
                        value={draft.productCd}
                        onChange={(e) => setDraft({ ...draft, productCd: e.target.value })}
                        className="rounded border border-border px-3 py-2"
                      />
                    </label>
                    <SupplierSelector
                      value={draft.supplierName}
                      onChange={(value) => setDraft({ ...draft, supplierName: value })}
                      className="w-full"
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-700">対応事業部（複数選択可）</span>
                      <div className="mt-2 flex flex-wrap gap-2 rounded border border-border px-3 py-2">
                        {departments.map((dpt) => (
                          <label key={dpt} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draft.departments.includes(dpt)}
                              onChange={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  departments: prev.departments.includes(dpt)
                                    ? prev.departments.filter((v) => v !== dpt)
                                    : [...prev.departments, dpt],
                                }))
                              }
                            />
                            {dpt}
                          </label>
                        ))}
                        {!departments.length && (
                          <span className="text-sm text-gray-500">事業部がありません</span>
                        )}
                      </div>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">規格</span>
                      <input
                        placeholder="規格"
                        value={draft.spec}
                        onChange={(e) => setDraft({ ...draft, spec: e.target.value })}
                        className="rounded border border-border px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">単位</span>
                      <input
                        placeholder="例: P, 個, kg"
                        value={draft.unit ?? ''}
                        onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                        className="rounded border border-border px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">単価</span>
                      <input
                        placeholder="単価"
                        inputMode="numeric"
                        value={draft.cost ? draft.cost.toLocaleString('ja-JP') : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, '');
                          const num = Number(raw);
                          if (Number.isNaN(num)) return;
                          setDraft({ ...draft, cost: num });
                        }}
                        className="rounded border border-border px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">保存区分</span>
                      <select
                        value={draft.storageType}
                        onChange={(e) => setDraft({ ...draft, storageType: e.target.value as Product['storageType'] })}
                        className="rounded border border-border px-3 py-2"
                      >
                        <option value="冷凍">冷凍</option>
                        <option value="冷蔵">冷蔵</option>
                        <option value="常温">常温</option>
                        <option value="その他">その他</option>
                      </select>
                    </label>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-gray-700">棚卸写真</span>
                      <div className="flex flex-wrap gap-2">
                        {(draft.imageUrls ?? []).map((img, idx) => (
                          <div key={idx} className="relative">
                            <img
                              src={img}
                              alt="preview"
                              className="h-14 w-18 rounded border border-border object-cover"
                            />
                          </div>
                        ))}
                        {!(draft.imageUrls ?? []).length && (
                          <span className="text-sm text-gray-500">棚卸写真が自動で添付されます</span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-border bg-white pb-2 pt-4">
              <Button block onClick={handleConfirm} disabled={(locked ?? false) || (!selected && tab !== 'register')}>
                商品を割り当てる
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
