import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { useSessionStore } from '../../store/sessionStore';
import { fileToDataUrl } from '../../services/imageService';

export function CameraPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const addPhoto = useSessionStore((s) => s.addPhoto);
  const session = useSessionStore((s) => s.session);
  const autoOpened = useRef(false);

  useEffect(() => {
    if (!session) {
      navigate('/start');
      return;
    }
    if (session.isLocked) return;
    const immediate = (location.state as any)?.immediate;
    if (!autoOpened.current || immediate) {
      autoOpened.current = true;
      setTimeout(() => inputRef.current?.click(), 0);
    }
  }, [navigate, session, location.state]);

  const handleSelect = async (fileList: FileList | null) => {
    if (!fileList || !session || session.isLocked) return;
    const file = fileList[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const photo = addPhoto([dataUrl]);
    if (inputRef.current) inputRef.current.value = '';
    if (photo) {
      navigate(`/count/${photo.id}`, { state: { from: 'list' } });
    } else {
      navigate('/list');
    }
    // 同じファイルを再選択できるようにクリア
  };

  if (!session) {
    navigate('/start');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <div className="flex flex-col gap-4 px-4 py-4">
        {session.isLocked && (
          <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
            確定済みのため編集できません
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files)}
        />
        <Button onClick={() => inputRef.current?.click()} block disabled={session.isLocked}>
          カメラを起動する
        </Button>
      </div>
    </div>
  );
}
