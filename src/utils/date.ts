const pad = (value: number) => String(value).padStart(2, '0');

export const toMonthKey = (isoDate: string) => (isoDate ?? '').slice(0, 7);

export const defaultDisplayMonthKey = () => {
  const now = new Date();
  const day = now.getDate();
  const target = day <= 15 ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const y = target.getFullYear();
  const m = pad(target.getMonth() + 1);
  return `${y}-${m}`;
};

export const toMonthEndDate = (monthKey: string) => {
  if (!monthKey) return '';
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return '';
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearStr}-${pad(month)}-${pad(lastDay)}`;
};

export const normalizeInventoryDate = (isoDate: string) =>
  toMonthEndDate(toMonthKey(isoDate)) || isoDate;

export const formatMonthWithInventoryDate = (inventoryDate: string) => {
  const month = toMonthKey(inventoryDate);
  const date = normalizeInventoryDate(inventoryDate);
  return `${month}（${date}）`;
};
