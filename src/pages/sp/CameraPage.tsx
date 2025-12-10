import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { useSessionStore } from '../../store/sessionStore';
import { fileToDataUrl } from '../../services/imageService';

export function CameraPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const addPhoto = useSessionStore((s) => s.addPhoto);
  const session = useSessionStore((s) => s.session);
  const [captures, setCaptures] = useState<string[]>([]);
  const autoOpened = useRef(false);

  useEffect(() => {
    if (!session) {
      navigate('/sp/start');
      return;
    }
    if (session.isLocked) return;
    // セッション更新で再度カメラが起動しないよう一度だけ
    if (!autoOpened.current) {
      autoOpened.current = true;
      setTimeout(() => inputRef.current?.click(), 0);
    }
  }, [navigate, session]);

  const handleSelect = async (fileList: FileList | null) => {
    if (!fileList || !session || session.isLocked) return;
    const file = fileList[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCaptures((prev) => [...prev, dataUrl]);
    // 同じファイルを再選択できるようにクリア
    if (inputRef.current) inputRef.current.value = '';
  };

  if (!session) {
    navigate('/sp/start');
    return null;
  }

  const handleRetake = () => {
    setCaptures((prev) => prev.slice(0, -1));
    if (!session?.isLocked) inputRef.current?.click();
  };

  const handleAddMore = () => {
    if (!session?.isLocked) inputRef.current?.click();
  };

  const handleConfirm = async () => {
    if (!captures.length || session?.isLocked) return;
    const photo = addPhoto(captures);
    setCaptures([]);
    if (photo) {
      navigate(`/sp/count/${photo.id}`);
    } else {
      navigate('/sp/list');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <div className="flex flex-col gap-4 px-4 py-4">
        {captures.length > 0 && (
          <div className="text-lg font-semibold text-center">撮影した写真を確認してください</div>
        )}
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
        {captures.length > 0 && (
          <>
            <div className="relative w-full overflow-hidden rounded border border-border bg-black">
              <button
                type="button"
                className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full bg-black/70 text-2xl font-bold text-white shadow"
                onClick={() => navigate('/sp/list')}
                aria-label="閉じる"
              >
                ×
              </button>
              <div className="grid grid-cols-3 gap-2 bg-black p-2">
                {captures.map((src, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded border border-white/30">
                    <img src={src} alt={`cap-${idx}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/70 text-lg font-bold text-white"
                      onClick={() => {
                        if (confirm('この写真を削除しますか？')) {
                          setCaptures((prev) => prev.filter((_, i) => i !== idx));
                        }
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {captures.length > 1 && (
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  {captures.length} 枚
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <Button variant="secondary" onClick={handleAddMore} className="flex-1">
                もう1枚撮影
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-primary text-lg font-bold hover:bg-primary/90"
                disabled={session.isLocked}
              >
                写真を使用
              </Button>
            </div>
          </>
        )}
        {captures.length === 0 && (
          <Button onClick={() => inputRef.current?.click()} block disabled={session.isLocked}>
            カメラを起動する
          </Button>
        )}
      </div>
    </div>
  );
}
