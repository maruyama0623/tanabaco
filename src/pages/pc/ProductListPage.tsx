import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { Tag } from '../../components/common/Tag';
import { Modal } from '../../components/common/Modal';
import { useProductStore } from '../../store/productStore';
import { Product } from '../../types';
import { fileToDataUrl } from '../../services/imageService';
import { useMasterStore } from '../../store/masterStore';
import { SupplierSelector } from '../../components/common/SupplierSelector';
import { formatYen } from '../../utils/number';

type Draft = {
  productCd: string;
  name: string;
  cost: number | null;
  unit?: string;
  departments: string[];
  supplierName: string;
  supplierCd?: string;
  spec?: string;
  storageType?: Product['storageType'];
  imageUrls: string[];
};

const emptyDraft = (): Draft => ({
  productCd: '',
  name: '',
  cost: null,
  unit: '',
  departments: [],
  supplierName: '',
  supplierCd: '',
  spec: '',
  storageType: 'その他',
  imageUrls: [],
});

export function ProductListPage() {
  const navigate = useNavigate();
  const { addProduct, updateProduct, deleteProduct, search, products } = useProductStore();
  const departments = useMasterStore((s) => s.departments);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [keyword, setKeyword] = useState('');
  const [supplier, setSupplier] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const filtered = useMemo(() => search(keyword, supplier), [keyword, supplier, search, products]);

  const openNew = () => {
    setEditing(null);
    setDraft({ ...emptyDraft(), departments: [...departments] });
    setShowModal(true);
  };

  const openEdit = (prod: Product) => {
    const { id, createdAt, updatedAt, ...rest } = prod;
    setEditing(prod);
    setDraft({
      ...rest,
      unit: rest.unit ?? '',
      supplierCd: rest.supplierCd ?? '',
      spec: rest.spec ?? '',
      cost: rest.cost ?? null,
      imageUrls: [...(rest.imageUrls ?? [])],
      departments: [...(rest.departments ?? [])],
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (editing) {
      updateProduct(editing.id, {
        ...draft,
        cost: draft.cost ?? 0,
        unit: draft.unit || 'P',
        departments: draft.departments,
      });
    } else {
      addProduct({
        ...draft,
        cost: draft.cost ?? 0,
        unit: draft.unit || 'P',
        departments: draft.departments,
      });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('削除しますか？')) deleteProduct(id);
  };

  const handleFileSelect = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setDraft((d) => ({ ...d, imageUrls: [...d.imageUrls, url] }));
  };

  const handleRemoveImage = (idx: number) => {
    setDraft((d) => ({ ...d, imageUrls: d.imageUrls.filter((_, i) => i !== idx) }));
  };

  const handleCsvUpload = async (file: File) => {
    setUploadingCsv(true);
    try {
      const buf = await file.arrayBuffer();
      let text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf));
      if (!text || /�/.test(text)) {
        try {
          text = new TextDecoder('shift_jis', { fatal: false }).decode(new Uint8Array(buf));
        } catch {
          // ignore
        }
      }
      if (!text.trim()) throw new Error('empty_csv');
      const apiBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api';
      const res = await fetch(`${apiBase}/products/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      if (!res.ok) throw new Error(`upload failed ${res.status}`);
      const fresh = await fetch(`${apiBase}/products`).then((r) => r.json());
      useProductStore.setState({ products: fresh });
      alert('商品CSVを取り込みました');
    } catch (e) {
      console.error(e);
      alert('CSVアップロードに失敗しました');
    } finally {
      setUploadingCsv(false);
    }
  };

  const mobileMenu = (
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
          <div className="absolute right-0 top-10 z-40 w-40 overflow-hidden rounded border border-border bg-white shadow-lg">
            <button
              className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
              onClick={() => {
                setShowMobileMenu(false);
                openNew();
              }}
            >
              商品登録
            </button>
            <button
              className="w-full px-4 py-3 text-left text-sm font-semibold hover:bg-muted"
              onClick={() => {
                setShowMobileMenu(false);
                uploadInputRef.current?.click();
              }}
              disabled={uploadingCsv}
            >
              CSVアップロード
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleCsvUpload(f);
                e.target.value = '';
              }}
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-10">
      <AppHeader
        title="商品マスタ"
        rightSlot={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/assign')}>
              割当一覧へ
            </Button>
            <Button variant="secondary" onClick={() => uploadInputRef.current?.click()} disabled={uploadingCsv}>
              CSVアップロード
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  await handleCsvUpload(f);
                }
                e.target.value = '';
              }}
            />
            <Button onClick={openNew}>商品登録</Button>
          </div>
        }
        rightSlotMobile={mobileMenu}
      />
      <div className="px-6 py-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            placeholder="商品名で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full min-w-[240px] rounded border border-border px-3 py-2 md:w-60"
          />
          <input
            placeholder="仕入先で検索"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full min-w-[240px] rounded border border-border px-3 py-2 md:w-60"
          />
        </div>
        <div className="overflow-auto border border-border hidden md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                {['画像', '商品CD', '商品名', '規格', '仕入先', '単価', '単位', '区分', '対応事業部', '操作'].map((h) => (
                  <th key={h} className="border border-border px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((prod) => (
                <tr key={prod.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border border-border px-3 py-2">
                    {prod.imageUrls?.length ? (
                      <img src={prod.imageUrls[0]} alt={prod.name} className="h-14 w-14 rounded object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-border text-[11px] text-gray-400">
                        画像なし
                      </div>
                    )}
                  </td>
                  <td className="border border-border px-3 py-2">{prod.productCd}</td>
                  <td className="border border-border px-3 py-2">
                    <div className="font-semibold">{prod.name}</div>
                    <div className="text-xs text-gray-500">{prod.supplierCd}</div>
                  </td>
                  <td className="border border-border px-3 py-2">{prod.spec}</td>
                  <td className="border border-border px-3 py-2">{prod.supplierName}</td>
                  <td className="border border-border px-3 py-2">{formatYen(prod.cost)}</td>
                  <td className="border border-border px-3 py-2">{prod.unit ?? 'P'}</td>
                  <td className="border border-border px-3 py-2">
                    {prod.storageType && <Tag label={prod.storageType} />}
                  </td>
                  <td className="border border-border px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(prod.departments ?? []).map((d) => (
                        <Tag key={d} label={d} />
                      ))}
                    </div>
                  </td>
                  <td className="border border-border px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => openEdit(prod)}>
                        編集
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDelete(prod.id)}>
                        削除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-gray-500">
                    対象の商品がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {filtered.map((prod) => (
            <div key={prod.id} className="rounded border border-border bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                {prod.imageUrls?.length ? (
                  <img src={prod.imageUrls[0]} alt={prod.name} className="h-16 w-16 flex-shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded border border-dashed border-border text-[11px] text-gray-400">
                    画像なし
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">{prod.productCd}</div>
                    {prod.storageType && <Tag label={prod.storageType} />}
                  </div>
                  <div className="text-base font-semibold">{prod.name}</div>
                  <div className="text-sm text-gray-600">{prod.spec}</div>
                  <div className="text-sm text-gray-600">{prod.supplierName}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {formatYen(prod.cost)} / {prod.unit ?? 'P'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(prod.departments ?? []).map((d) => (
                      <Tag key={d} label={d} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => openEdit(prod)}>
                  編集
                </Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleDelete(prod.id)}>
                  削除
                </Button>
              </div>
            </div>
          ))}
          {!filtered.length && (
            <div className="rounded border border-dashed border-border p-6 text-center text-gray-500">
              対象の商品がありません
            </div>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{editing ? '商品を編集' : '商品を登録'}</h3>
          <div className="flex flex-col gap-3 rounded border border-border p-3">
            <LabeledInput
              label="商品名"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <LabeledInput
              label="自社管理商品CD"
              value={draft.productCd}
              onChange={(e) => setDraft({ ...draft, productCd: e.target.value })}
            />
            <SupplierSelector
              value={draft.supplierName}
              onChange={(value) => setDraft({ ...draft, supplierName: value })}
              className="w-full"
            />
            <LabeledCheckboxes
              label="対応事業部（複数選択可）"
              options={departments}
              values={draft.departments}
              onChange={(values) => setDraft({ ...draft, departments: values })}
            />
            <LabeledInput
              label="規格"
              value={draft.spec}
              onChange={(e) => setDraft({ ...draft, spec: e.target.value })}
            />
            <LabeledInput
              label="単位"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              placeholder="例: P, kg, 個"
            />
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-gray-700">単価</span>
              <input
                type="text"
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                value={
                  Number.isFinite(draft.cost) && draft.cost !== null
                    ? draft.cost.toLocaleString('ja-JP')
                    : ''
                }
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '');
                  if (raw === '') {
                    setDraft({ ...draft, cost: null });
                    return;
                  }
                  const num = Number(raw);
                  if (Number.isNaN(num)) return;
                  setDraft({ ...draft, cost: num });
                }}
                className="rounded border border-border px-3 py-2 text-right"
              />
            </label>
            <div className="flex flex-col gap-1">
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
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-gray-700">商品画像</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-border"
                >
                  画像ファイルを選択
                </Button>
                <div className="flex flex-wrap gap-2">
                  {draft.imageUrls.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img}
                        alt="preview"
                        className="h-12 w-16 rounded border border-border object-cover"
                      />
                      <button
                        type="button"
                        className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-500 text-xs font-bold text-white"
                        onClick={() => handleRemoveImage(idx)}
                        aria-label="画像を削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          </div>
          <Button onClick={handleSave}>{editing ? '更新する' : '登録する'}</Button>
        </div>
      </Modal>
    </div>
  );
}

function LabeledInput({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <input className="rounded border border-border px-3 py-2" {...rest} />
    </label>
  );
}

function LabeledCheckboxes({
  label,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  const toggle = (option: string) => {
    if (values.includes(option)) {
      onChange(values.filter((v) => v !== option));
    } else {
      onChange([...values, option]);
    }
  };
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <div className="flex flex-wrap gap-2 rounded border border-border px-3 py-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4"
            />
            {opt}
          </label>
        ))}
        {!options.length && <span className="text-sm text-gray-500">事業部がありません</span>}
      </div>
    </div>
  );
}
