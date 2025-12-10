import { PhotoRecord } from '../../types';
import { formatNumber } from '../../utils/number';

interface Props {
  photo: PhotoRecord;
  onClick?: () => void;
  disabled?: boolean;
}

export function PhotoTile({ photo, onClick, disabled }: Props) {
  const src = photo.imageUrls?.[0] ?? photo.imageUrl;
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className="relative aspect-square overflow-hidden rounded border border-border bg-white shadow-sm"
      disabled={disabled}
    >
      <img src={src} alt="photo" className="h-full w-full object-cover" />
      {photo.quantity != null && (
        <span className="absolute bottom-1 right-1 rounded-full bg-primary px-3 py-1 text-lg font-bold text-white shadow-md">
          {formatNumber(photo.quantity)}
        </span>
      )}
    </button>
  );
}
