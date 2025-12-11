import { useState } from 'react';
import { PhotoRecord, Product } from '../../types';
import { Tag } from '../common/Tag';
import { Button } from '../common/Button';

interface Props {
  photo: PhotoRecord;
  product?: Product;
  onAssign: () => void;
  onDelete: () => void;
  onEditQuantity?: () => void;
  disabled?: boolean;
}

export function PhotoCardDesktop({
  photo,
  product,
  onAssign,
  onDelete,
  onEditQuantity,
  disabled,
}: Props) {
  const confirmDelete = () => {
    if (confirm('この写真を削除しますか？')) {
      onDelete();
    }
  };
  const images = photo.imageUrls && photo.imageUrls.length ? photo.imageUrls : [photo.imageUrl];
  const hasImage = Boolean(images[0]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  return (
    <div className="flex min-w-[240px] flex-col gap-2 rounded border border-border bg-white p-3 shadow-sm">
      <div
        className="relative aspect-[4/3] overflow-hidden rounded cursor-pointer"
        onClick={() => hasImage && setPreviewIdx(0)}
      >
        {hasImage ? (
          <img src={images[0]} alt="photo" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
            棚卸表で追加（画像なし）
          </div>
        )}
      </div>
      {product && (
        <div className="flex flex-col gap-1">
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
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={photo.quantity ?? ''}
          onClick={() => !disabled && onEditQuantity?.()}
          className="w-full rounded border border-border px-2 py-2 text-right text-lg font-semibold"
          readOnly
          disabled={disabled}
        />
        <button
          className="text-primary underline underline-offset-4"
          type="button"
          onClick={!disabled ? onEditQuantity : undefined}
          disabled={disabled}
        >
          ✎
        </button>
      </div>
      <Button onClick={!disabled ? onAssign : undefined} block disabled={disabled}>
        {photo.status === 'assigned' ? '変更する' : '商品割り当て'}
      </Button>
      <Button
        variant="secondary"
        onClick={!disabled ? confirmDelete : undefined}
        block
        disabled={disabled}
      >
        削除する
      </Button>
      {disabled && (
        <div className="text-center text-xs text-gray-500">確定済みのため編集できません</div>
      )}
      {previewIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          onClick={() => setPreviewIdx(null)}
        >
          <button
            className="absolute right-4 top-4 text-3xl font-bold text-white"
            onClick={() => setPreviewIdx(null)}
            aria-label="close preview"
          >
            ×
          </button>
          <div
            className="flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[previewIdx]}
              alt="preview"
              className="max-h-[80vh] w-full max-w-4xl rounded object-contain shadow-2xl"
            />
            {images.length > 1 && (
              <div className="flex flex-wrap justify-center gap-2">
                {images.map((thumb, i) => (
                  <button
                    key={thumb + i}
                    onClick={() => setPreviewIdx(i)}
                    className={`h-16 w-20 overflow-hidden rounded border ${
                      i === previewIdx ? 'border-primary ring-2 ring-primary/60' : 'border-white/40'
                    }`}
                  >
                    <img src={thumb} alt={`thumb-${i}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
