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

type Draft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

const emptyDraft = (): Draft => ({
  productCd: '',
  name: '',
  cost: 0,
  unit: 'P',
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
  const [keyword, setKeyword] = useState('');
  const [supplier, setSupplier] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const filtered = useMemo(() => search(keyword, supplier), [keyword, supplier, search, products]);

  const openNew = () => {
    setEditing(null);
    setDraft({ ...emptyDraft(), departments: [...departments] });
    setShowModal(true);
  };

  const openEdit = (prod: Product) => {
    const { id, createdAt, updatedAt, ...rest } = prod;
    setEditing(prod);
    setDraft({ ...rest, imageUrls: [...(rest.imageUrls ?? [])], departments: [...(rest.departments ?? [])] });
    setShowModal(true);
  };

  const handleSave = () => {
    const departmentsToSave = draft.departments.length ? draft.departments : departments;
    if (editing) {
      updateProduct(editing.id, { ...draft, departments: departmentsToSave });
    } else {
      addProduct({ ...draft, departments: departmentsToSave });
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

  return (
    <div className="min-h-screen bg-white pb-10">
      <AppHeader
        title="商品マスタ"
        rightSlot={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/pc/assign')}>
              割当一覧へ
            </Button>
            <Button onClick={openNew}>商品登録</Button>
          </div>
        }
      />
      <div className="px-6 py-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            placeholder="商品名で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-60 rounded border border-border px-3 py-2"
          />
          <input
            placeholder="仕入先で検索"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-60 rounded border border-border px-3 py-2"
          />
        </div>
        <div className="overflow-auto border border-border hidden md:block">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-muted">
              <tr>
                {['商品CD', '商品名', '規格', '仕入先', '単価', '単位', '区分', '対応事業部', '操作'].map((h) => (
                  <th key={h} className="border border-border px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((prod) => (
                <tr key={prod.id} className="odd:bg-white even:bg-gray-50">
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
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LabeledInput
              label="商品CD"
              value={draft.productCd}
              onChange={(e) => setDraft({ ...draft, productCd: e.target.value })}
            />
            <LabeledInput
              label="商品名"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
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
              className="md:col-span-2"
            />
            <LabeledInput
              label="規格"
              value={draft.spec}
              onChange={(e) => setDraft({ ...draft, spec: e.target.value })}
            />
            <LabeledInput
              label="単価"
              type="number"
              value={draft.cost}
              onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })}
            />
            <LabeledInput
              label="単位"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              placeholder="例: P, kg, 個"
            />
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
            <div className="flex flex-col gap-1 md:col-span-2">
              <span className="text-sm font-semibold text-gray-700">画像ファイル</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-border"
                >
                  ファイルを選択
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
