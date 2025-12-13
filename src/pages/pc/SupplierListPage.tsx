import { useState, useRef } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';
import { useMasterStore } from '../../store/masterStore';
import { Button } from '../../components/common/Button';

export function SupplierListPage() {
  const { suppliers, upsertSupplier, removeSupplier, setSuppliers } = useMasterStore();
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [uploading, setUploading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf));
      let text = utf8;
      // Shift-JIS fallback
      if (!utf8 || /�/.test(utf8)) {
        try {
          text = new TextDecoder('shift_jis', { fatal: false }).decode(new Uint8Array(buf));
        } catch {
          // ignore
        }
      }
      const res = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api'}/suppliers/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      if (!res.ok) throw new Error(`upload failed ${res.status}`);
      // 最新マスタを取得して反映
      const masters = await fetch(`${import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/api'}/masters`).then((r) =>
        r.json(),
      );
      setSuppliers((masters.suppliers ?? []).map((s: any) => ({ code: s.code, name: s.name })));
      alert('CSVアップロードが完了しました');
    } catch (e) {
      console.error(e);
      alert('CSVアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="仕入先一覧" />
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">仕入先マスタ</h2>
            <p className="text-sm text-gray-600">商品登録時の仕入先選択に表示されます。</p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-xl font-bold text-gray-700 hover:bg-gray-100"
              aria-label="その他メニュー"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded border border-border bg-white shadow-lg z-10">
                <button
                  type="button"
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  onClick={() => {
                    setMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                >
                  CSVアップロード
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded border border-border p-4 shadow-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="自社管理番号（code）"
              className="w-full rounded border border-border px-3 py-2"
            />
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="仕入先名"
                className="w-full rounded border border-border px-3 py-2"
              />
              <Button
                type="button"
                onClick={() => {
                  const c = newCode.trim();
                  const n = newName.trim();
                  if (!c || !n) return;
                  upsertSupplier({ code: c, name: n });
                  setNewCode('');
                  setNewName('');
                }}
                disabled={!newCode.trim() || !newName.trim()}
              >
                追加
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {suppliers.length ? (
              suppliers
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((s) => (
                  <div
                    key={s.code}
                    className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-xs text-gray-500">code: {s.code}</span>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeSupplier(s.code)}
                    >
                      削除
                    </Button>
                  </div>
                ))
            ) : (
              <span className="text-sm text-gray-500">まだ登録がありません。</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
