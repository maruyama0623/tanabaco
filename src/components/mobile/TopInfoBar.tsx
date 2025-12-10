interface Props {
  inventoryDate: string;
  department: string;
  className?: string;
}

export function TopInfoBar({ inventoryDate, department, className }: Props) {
  const month = inventoryDate.slice(0, 7);
  return (
    <div className={`flex gap-2 px-4 py-2 ${className ?? ''}`.trim()}>
      <div className="flex-1 rounded border border-border bg-muted px-3 py-2 text-sm text-gray-700">
        <div className="text-xs text-gray-500">表示月（棚卸日）</div>
        <div className="font-semibold">
          {month}（{inventoryDate}）
        </div>
      </div>
      <div className="flex-1 rounded border border-border bg-muted px-3 py-2 text-sm text-gray-700">
        <div className="text-xs text-gray-500">事業部</div>
        <div className="font-semibold">{department}</div>
      </div>
    </div>
  );
}
