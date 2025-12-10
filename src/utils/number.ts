const formatter = new Intl.NumberFormat('ja-JP');

export const formatNumber = (value: number | null | undefined, fallback = '0') => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return formatter.format(value);
};

export const formatYen = (value: number | null | undefined, fallback = '¥0') =>
  `¥${formatNumber(value, fallback.replace(/^¥/, ''))}`;
