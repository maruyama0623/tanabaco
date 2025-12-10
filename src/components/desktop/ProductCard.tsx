import clsx from 'clsx';
import { Product } from '../../types';
import { Tag } from '../common/Tag';

interface Props {
  product: Product;
  selected?: boolean;
  onSelect: () => void;
}

export function ProductCard({ product, selected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'flex w-full gap-4 rounded border bg-white p-3 text-left shadow-sm',
        selected ? 'border-primary ring-2 ring-primary/60' : 'border-border hover:border-primary',
      )}
    >
      <div className="h-20 w-24 overflow-hidden rounded bg-gray-100">
        <img
          src={product.imageUrls?.[0] || 'https://placehold.co/200x140?text=No+Image'}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-500">{product.productCd}</div>
        <div className="text-base font-semibold">{product.name}</div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{product.supplierName}</span>
          {product.storageType && <Tag label={product.storageType} />}
        </div>
        <div className="text-sm text-gray-600">
          {product.spec}
          {product.unit ? ` / ${product.unit}` : ''}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {(product.departments ?? []).map((d) => (
            <Tag key={d} label={d} />
          ))}
        </div>
      </div>
    </button>
  );
}
