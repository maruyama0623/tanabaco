import { useState } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';
import { MasterSection } from '../../components/desktop/MasterSection';
import { useMasterStore } from '../../store/masterStore';

export function StaffListPage() {
  const { staffMembers, addStaff, removeStaff } = useMasterStore();
  const [newStaff, setNewStaff] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="担当者一覧" />
      <div className="px-6 py-4">
        <MasterSection
          title="担当者マスタ"
          description="棚卸開始の担当者選択に表示されます。"
          items={staffMembers}
          inputPlaceholder="新しい担当者名を入力"
          newValue={newStaff}
          onChangeNewValue={setNewStaff}
          onAdd={() => {
            addStaff(newStaff);
            setNewStaff('');
          }}
          onRemove={removeStaff}
        />
      </div>
    </div>
  );
}
