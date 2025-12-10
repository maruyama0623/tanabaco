import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { NumericPad } from '../../components/mobile/NumericPad';
import { useSessionStore } from '../../store/sessionStore';
import { fileToDataUrl } from '../../services/imageService';

export function CountPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const updateQuantity = useSessionStore((s) => s.updateQuantity);
  const deletePhoto = useSessionStore((s) => s.deletePhoto);
  const updateImages = useSessionStore((s) => s.updatePhotoImages);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const addImageInputRef = useRef<HTMLInputElement | null>(null);

  const photo = session?.photoRecords.find((p) => p.id === photoId);
  const formulaRef = useRef<string | undefined>(photo?.quantityFormula);
  const locked = session?.isLocked;
  const images =
    (photo?.imageUrls && photo.imageUrls.length ? photo.imageUrls : photo ? [photo.imageUrl] : []) ?? [];

  useEffect(() => {
    if (!session) navigate('/sp/start');
  }, [navigate, session]);

  if (!session || !photo || !photoId) return null;

  const handleConfirm = (value: number) => {
    if (locked) return;
    // 数量と計算式を保存する
    updateQuantity(photoId, Number(value.toFixed(2)), formulaRef.current);
    navigate('/sp/list');
  };

  const handleCancel = () => {
    if (locked) return;
    deletePhoto(photoId);
    navigate('/sp/list');
  };

  const handleRemoveImage = (idx: number) => {
    if (locked) return;
    const next = images.filter((_, i) => i !== idx);
    if (!next.length) {
      handleCancel();
      return;
    }
    updateImages(photoId, next);
  };

  const handleAddImage = async (fileList: FileList | null) => {
    if (locked || !photo || !fileList?.[0]) return;
    const dataUrl = await fileToDataUrl(fileList[0]);
    const next = [...images, dataUrl];
    updateImages(photoId, next);
    if (addImageInputRef.current) addImageInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <div className="px-4 py-4 md:flex md:items-start md:justify-center md:gap-6">
        {locked && (
          <div className="mb-4 w-full rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
            確定済みのため編集・削除はできません
          </div>
        )}
        <div className="mb-4 grid grid-cols-3 gap-2 md:mb-0 md:w-1/2 md:max-w-[520px]">
          {images.map((img, idx) => (
            <div key={idx} className="relative aspect-square overflow-hidden rounded border cursor-pointer">
              <img
                src={img}
                alt={`preview-${idx}`}
                className="h-full w-full object-cover"
                onClick={() => setPreviewIdx(idx)}
              />
              <button
                type="button"
                className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/70 text-lg font-bold text-white"
                onClick={
                  !locked
                    ? () => {
                        if (confirm('この写真を削除しますか？')) {
                          handleRemoveImage(idx);
                        }
                      }
                    : undefined
                }
                disabled={locked}
              >
                ×
              </button>
            </div>
          ))}
          {!locked && (
            <button
              type="button"
              onClick={() => addImageInputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded border-2 border-dashed border-border text-3xl font-bold text-gray-400 hover:border-primary hover:text-primary"
            >
              +
            </button>
          )}
          <input
            ref={addImageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleAddImage(e.target.files)}
          />
        </div>
        <div className="md:w-[380px]">
          <NumericPad
            initialValue={photo.quantity}
            initialFormula={photo.quantityFormula}
            onConfirm={(value, formula) => {
              if (locked) return;
              formulaRef.current = formula;
              handleConfirm(value);
            }}
            onCancel={() => {
              if (locked) return;
              handleCancel();
            }}
          />
        </div>
      </div>
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
            className="flex max-h-[90vh] w-full max-w-5xl flex-col items-center gap-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[previewIdx]}
              alt="preview"
              className="max-h-[70vh] w-full max-w-4xl rounded object-contain shadow-2xl"
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
