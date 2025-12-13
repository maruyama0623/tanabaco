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
  extra,
}: Props) {
  const canAdd = newValue.trim().length > 0;
  return (
    <section className="space-y-3 rounded border border-border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {extra}
      </div>
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
      <div className="flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className="group inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 shadow-sm transition hover:bg-gray-200"
                aria-label={`${item}を削除`}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500">まだ登録がありません。</span>
        )}
      </div>
    </section>
  );
}
