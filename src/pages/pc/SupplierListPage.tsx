import { useState } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';
import { MasterSection } from '../../components/desktop/MasterSection';
import { useMasterStore } from '../../store/masterStore';

export function SupplierListPage() {
  const { suppliers, addSupplier, removeSupplier } = useMasterStore();
  const [newSupplier, setNewSupplier] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="仕入先一覧" />
      <div className="px-6 py-4">
        <MasterSection
          title="仕入先マスタ"
          description="商品登録時の仕入先選択に表示されます。"
          items={suppliers}
          inputPlaceholder="新しい仕入先名を入力"
          newValue={newSupplier}
          onChangeNewValue={setNewSupplier}
          onAdd={() => {
            addSupplier(newSupplier);
            setNewSupplier('');
          }}
          onRemove={removeSupplier}
        />
      </div>
    </div>
  );
}
