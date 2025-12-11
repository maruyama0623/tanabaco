import { PhotoRecord } from '../../types';
import { formatNumber } from '../../utils/number';

interface Props {
  photo: PhotoRecord;
  onClick?: () => void;
  disabled?: boolean;
}

export function PhotoTile({ photo, onClick, disabled }: Props) {
  const src = photo.imageUrls?.[0] ?? photo.imageUrl;
  const hasImage = Boolean(src);
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className="relative aspect-square overflow-hidden rounded border border-border bg-white shadow-sm"
      disabled={disabled}
    >
      {hasImage ? (
        <img src={src} alt="photo" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-500 px-2 text-center">
          棚卸表で追加（画像なし）
        </div>
      )}
      {photo.quantity != null && (
        <span className="absolute bottom-1 right-1 rounded-full bg-primary px-3 py-1 text-lg font-bold text-white shadow-md">
          {formatNumber(photo.quantity)}
        </span>
      )}
    </button>
  );
}
