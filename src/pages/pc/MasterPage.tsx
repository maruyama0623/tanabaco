import { useState } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';
import { useMasterStore } from '../../store/masterStore';
import { MasterSection } from '../../components/desktop/MasterSection';

export function MasterPage() {
  const { departments, staffMembers, suppliers, addDepartment, addStaff, upsertSupplier, removeDepartment, removeStaff, removeSupplier } =
    useMasterStore();
  const [newDept, setNewDept] = useState('');
  const [newStaff, setNewStaff] = useState('');
  const [newSupplier, setNewSupplier] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <AppHeader title="マスタ管理" />
      <div className="space-y-8 px-6 py-4">
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
          onUpdate={(oldV, newV) => {
            removeDepartment(oldV);
            addDepartment(newV);
          }}
        />
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
          onUpdate={(oldV, newV) => {
            removeStaff(oldV);
            addStaff(newV);
          }}
        />
        <MasterSection
          title="仕入先マスタ"
          description="商品登録時の仕入先選択に表示されます。"
          items={suppliers.map((s) => `${s.code} ${s.name}`)}
          inputPlaceholder="新しい仕入先（code name）を入力"
          newValue={newSupplier}
          onChangeNewValue={setNewSupplier}
          onAdd={() => {
            const trimmed = newSupplier.trim();
            if (!trimmed) return;
            const [codePart, ...rest] = trimmed.split(/\s+/);
            const namePart = rest.join(' ') || codePart;
            upsertSupplier({ code: codePart, name: namePart });
            setNewSupplier('');
          }}
          onRemove={(v) => {
            const code = v.split(/\s+/)[0];
            removeSupplier(code);
          }}
          onUpdate={(oldV, newV) => {
            const oldCode = oldV.split(/\s+/)[0];
            const [codePart, ...rest] = newV.trim().split(/\s+/);
            const namePart = rest.join(' ') || codePart;
            upsertSupplier({ code: codePart, name: namePart });
            if (codePart !== oldCode) removeSupplier(oldCode);
          }}
        />
      </div>
    </div>
  );
}
