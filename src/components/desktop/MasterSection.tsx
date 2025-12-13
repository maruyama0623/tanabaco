import { useEffect, useState } from 'react';
import { Button } from '../common/Button';

interface Props {
  title: string;
  description: string;
  items: string[];
  inputPlaceholder: string;
  newValue: string;
  onChangeNewValue: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  onUpdate?: (oldValue: string, newValue: string) => void;
  extra?: React.ReactNode;
}

export function MasterSection({
  title,
  description,
  items,
  inputPlaceholder,
  newValue,
  onChangeNewValue,
  onAdd,
  onRemove,
  onUpdate,
  extra,
}: Props) {
  const canAdd = newValue.trim().length > 0;
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    items.forEach((i) => {
      next[i] = i;
    });
    setEdits(next);
  }, [items]);

  const updateEdit = (key: string, val: string) => {
    setEdits((prev) => ({ ...prev, [key]: val }));
  };

  const saveEdit = (key: string) => {
    const nextVal = (edits[key] ?? key).trim();
    if (!nextVal) return;
    if (nextVal === key) return;
    onUpdate?.(key, nextVal);
  };

  return (
    <section className="space-y-3 rounded border border-border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {extra}
      </div>
      <div className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-3">
        <div className="flex gap-2">
          <input
            value={newValue}
            onChange={(e) => onChangeNewValue(e.target.value)}
            placeholder={inputPlaceholder}
            className="w-full rounded border border-border px-3 py-2"
          />
          <Button type="button" onClick={onAdd} disabled={!canAdd}>
            追加
          </Button>
        </div>
        <div className="grid gap-2">
          {items.length ? (
            items.map((item) => (
              <div
                key={item}
                className="flex flex-col gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
              >
                <input
                  value={edits[item] ?? item}
                  onChange={(e) => updateEdit(item, e.target.value)}
                  className="w-full rounded border border-border px-2 py-1 font-semibold"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => saveEdit(item)} disabled={!onUpdate}>
                    保存
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => onRemove(item)}>
                    削除
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <span className="text-sm text-gray-500">まだ登録がありません。</span>
          )}
        </div>
      </div>
    </section>
  );
}
