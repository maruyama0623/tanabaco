import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { PhotoTile } from '../../components/mobile/PhotoTile';
import { TopInfoBar } from '../../components/mobile/TopInfoBar';
import { useSessionStore } from '../../store/sessionStore';
import { fileToDataUrl } from '../../services/imageService';

export function PhotoListPage() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const addPhoto = useSessionStore((s) => s.addPhoto);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!session) navigate('/start');
  }, [navigate, session]);

  if (!session) return null;
  const locked = session.isLocked;

  const handleSelect = async (fileList: FileList | null) => {
    if (!fileList || !session || session.isLocked) return;
    const file = fileList[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (inputRef.current) inputRef.current.value = '';
    const photo = addPhoto([dataUrl]);
    if (photo) {
      navigate(`/count/${photo.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <AppHeader />
      <div className="w-full px-3 md:px-6">
        <TopInfoBar
          inventoryDate={session.inventoryDate}
          department={session.department}
          className="flex flex-col gap-2 px-0 py-2 md:flex-row"
        />
        {locked && (
          <div className="mb-3 rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
            確定済みのため編集はできません
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 md:grid-cols-5 md:gap-3">
          {session.photoRecords.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              disabled={locked}
              onClick={() => navigate(`/count/${photo.id}`)}
            />
          ))}
          {!session.photoRecords.length && (
            <div className="col-span-full rounded border border-dashed border-border p-6 text-center text-gray-500">
              写真がありません
            </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pb-6 pt-2 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.2)]">
        <div className="w-full px-3 md:px-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleSelect(e.target.files)}
          />
          <Button
            block
            onClick={() => inputRef.current?.click()}
            disabled={locked}
          >
            写真を撮る
          </Button>
        </div>
      </div>
    </div>
  );
}
