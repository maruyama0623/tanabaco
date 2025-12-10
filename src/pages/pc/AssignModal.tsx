import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from '../../components/common/Modal';
import { ProductCard } from '../../components/desktop/ProductCard';
import { useSessionStore } from '../../store/sessionStore';
import { useProductStore } from '../../store/productStore';
import { Button } from '../../components/common/Button';
import { Product } from '../../types';
import { SupplierSelector } from '../../components/common/SupplierSelector';
import { useMasterStore } from '../../store/masterStore';

type Tab = 'ai' | 'search' | 'register';

export function AssignModal() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const session = useSessionStore((s) => s.session);
  const assignProduct = useSessionStore((s) => s.assignProduct);
  const { addProduct, search, products } = useProductStore();
  const departments = useMasterStore((s) => s.departments);
  const photo = session?.photoRecords.find((p) => p.id === photoId) || null;
  const [selected, setSelected] = useState<string | null>(photo?.productId ?? null);
  const [keyword, setKeyword] = useState('');
  const [supplier, setSupplier] = useState('');
  const [tab, setTab] = useState<Tab>('ai');
  const [draft, setDraft] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    productCd: '',
    name: '',
    cost: 0,
    departments: session?.department ? [session.department] : [],
    supplierName: '',
    supplierCd: '',
    spec: '',
    storageType: 'その他',
    unit: 'P',
    imageUrls:
      photo?.imageUrls && photo.imageUrls.length
        ? [...photo.imageUrls]
        : photo
          ? [photo.imageUrl]
          : [],
  });

  const filtered = useMemo(
    () => search(keyword, supplier, session?.department),
    [keyword, supplier, search, products, session?.department],
  );

  const locked = session?.isLocked;

  const close = () => navigate('/assign');

  if (!photo) return null;

  const handleRegister = () => {
    const departmentsToSave =
      draft.departments.length || !session?.department
        ? draft.departments
        : [session.department];
    const created = addProduct({ ...draft, departments: departmentsToSave });
    setSelected(created.id);
    return created.id;
  };

  const handleConfirm = () => {
    if (!photoId || locked) return;
    let targetId = selected;
    if (!targetId && tab === 'register') {
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
    { key: 'register', label: '商品登録' },
  ];

  return (
    <Modal open onClose={close}>
      <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-3">
        <div className="flex gap-2">
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

        {tab === 'ai' && (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">こちらの商品ではありませんか？</h3>
            <div className="space-y-2">
              {filtered.length ? (
                filtered.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    selected={selected === prod.id}
                    onSelect={() => setSelected(prod.id)}
                  />
                ))
              ) : (
                <div className="rounded border border-dashed border-border p-3 text-sm text-gray-500">
                  候補がありません
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
              {filtered.length ? (
                filtered.map((prod) => (
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
      <div className="mt-4 border-t border-border pt-4">
        <Button block onClick={handleConfirm} disabled={(locked ?? false) || (!selected && tab !== 'register')}>
          商品を割り当てる
        </Button>
      </div>
    </Modal>
  );
}
