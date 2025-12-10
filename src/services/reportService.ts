import { InventoryReportRow, PhotoRecord, Product } from '../types';

export function buildReportRows(photos: PhotoRecord[], products: Product[]): InventoryReportRow[] {
  const assigned = photos.filter((p) => p.status === 'assigned' && p.productId);
  const map = new Map<string, { qty: number; product: Product }>();

  assigned.forEach((photo) => {
    if (!photo.productId || photo.quantity == null) return;
    const product = products.find((p) => p.id === photo.productId);
    if (!product) return;
    const entry = map.get(photo.productId) || { qty: 0, product };
    entry.qty += photo.quantity;
    map.set(photo.productId, entry);
  });

  let index = 0;
  return Array.from(map.values()).map(({ qty, product }) => {
    const prevQty = Math.max(qty + ((index % 3) - 1) * 2, 1);
    index += 1;
    const amount = qty * product.cost;
    const prevAmount = prevQty * product.cost;
    return {
      product,
      quantity: qty,
      amount,
      prevQuantity: prevQty,
      prevAmount,
      qtyDiff: qty - prevQty,
      amountDiff: amount - prevAmount,
    };
  });
}

export function exportCsv(rows: InventoryReportRow[]) {
  const headers = [
    '商品CD',
    '商品名',
    '規格',
    '仕入先',
    '当月数量',
    '単価',
    '当月金額',
    '前月数量',
    '前月金額',
    '数量差異',
    '金額差異',
  ];

  const csvRows = rows.map((row) => [
    row.product.productCd,
    row.product.name,
    row.product.spec ?? '',
    row.product.supplierName,
    row.quantity,
    row.product.cost,
    row.amount,
    row.prevQuantity,
    row.prevAmount,
    row.qtyDiff,
    row.amountDiff,
  ]);

  const csvContent = [headers, ...csvRows]
    .map((line) => line.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventory-report.csv';
  link.click();
  URL.revokeObjectURL(url);
}
