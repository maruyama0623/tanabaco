import { useId } from 'react';
import { useMasterStore } from '../../store/masterStore';
import { Button } from './Button';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function SupplierSelector({
  value,
  onChange,
  label = '仕入先',
  placeholder,
  className,
}: Props) {
  const listId = useId();
  const suppliers = useMasterStore((s) => s.suppliers);
  const addSupplier = useMasterStore((s) => s.addSupplier);
  const trimmed = value.trim();
  const alreadyExists = trimmed ? suppliers.some((s) => s === trimmed) : false;

  const handleAdd = () => {
    if (!trimmed) return;
    addSupplier(trimmed);
  };

  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <div className="flex gap-2">
        <input
          list={listId}
          placeholder={placeholder ?? '仕入先を選択・入力'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-border px-3 py-2"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!trimmed || alreadyExists}
          onClick={handleAdd}
        >
          マスタ追加
        </Button>
      </div>
      <datalist id={listId}>
        {suppliers.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {alreadyExists && (
        <span className="text-xs text-gray-500">既に仕入先マスタに登録されています。</span>
      )}
    </label>
  );
}
