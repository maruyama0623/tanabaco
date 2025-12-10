import { useState } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';
import { MasterSection } from '../../components/desktop/MasterSection';
import { useMasterStore } from '../../store/masterStore';

export function DepartmentListPage() {
  const { departments, addDepartment, removeDepartment } = useMasterStore();
  const [newDept, setNewDept] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="事業部一覧" />
      <div className="px-6 py-4">
        <MasterSection
          title="事業部マスタ"
          description="棚卸開始の事業部選択に表示されます。"
          items={departments}
          inputPlaceholder="新しい事業部名を入力"
          newValue={newDept}
          onChangeNewValue={setNewDept}
          onAdd={() => {
            addDepartment(newDept);
            setNewDept('');
          }}
          onRemove={removeDepartment}
        />
      </div>
    </div>
  );
}
