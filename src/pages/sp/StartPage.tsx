import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { AppHeader } from '../../components/layout/AppHeader';
import { Button } from '../../components/common/Button';
import { useMasterStore } from '../../store/masterStore';
import { defaultDisplayMonthKey, toMonthEndDate } from '../../utils/date';

export function StartPage() {
  const navigate = useNavigate();
  const startSession = useSessionStore((s) => s.startSession);
  const departments = useMasterStore((s) => s.departments);
  const staffOptions = useMasterStore((s) => s.staffMembers);
  const currentMonth = useMemo(() => defaultDisplayMonthKey(), []);
  const [inventoryMonth, setInventoryMonth] = useState(currentMonth);
  const inventoryDate = useMemo(() => toMonthEndDate(inventoryMonth), [inventoryMonth]);
  const [department, setDepartment] = useState('');
  const [staff1, setStaff1] = useState('');
  const [staff2, setStaff2] = useState('');

  useEffect(() => {
    if (!department && departments.length) {
      setDepartment(departments[0]);
    }
  }, [department, departments]);

  useEffect(() => {
    if (!staff1 && staffOptions.length) {
      setStaff1(staffOptions[0]);
    }
  }, [staff1, staffOptions]);

  useEffect(() => {
    if (!staff2 && staffOptions.length) {
      setStaff2(staffOptions[1] ?? staffOptions[0]);
    }
  }, [staff2, staffOptions]);

  const handleSubmit = () => {
    startSession({ inventoryDate, department, staff1, staff2 });
    navigate('/sp/list');
  };

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="棚卸月">
            <div className="flex items-center gap-2 rounded border border-border bg-muted px-3 py-2">
              <input
                type="month"
                value={inventoryMonth}
                onChange={(e) => setInventoryMonth(e.target.value)}
                className="w-full bg-transparent text-base outline-none"
              />
              <span role="img" aria-label="calendar">
                📅
              </span>
            </div>
          </Field>
          <Field label="事業部">
            <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {departments.length ? (
                departments.map((d) => <option key={d}>{d}</option>)
              ) : (
                <option value="">事業部を追加してください</option>
              )}
            </Select>
          </Field>
          <Field label="担当者①">
            <Select value={staff1} onChange={(e) => setStaff1(e.target.value)}>
              {staffOptions.length ? (
                staffOptions.map((s) => <option key={s}>{s}</option>)
              ) : (
                <option value="">担当者を追加してください</option>
              )}
            </Select>
          </Field>
          <Field label="担当者②">
            <Select value={staff2} onChange={(e) => setStaff2(e.target.value)}>
              {staffOptions.length ? (
                staffOptions.map((s) => <option key={s}>{s}</option>)
              ) : (
                <option value="">担当者を追加してください</option>
              )}
            </Select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} className="w-full md:w-auto md:min-w-[200px]">
            棚卸しを開始する
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm font-semibold text-gray-700">{label}</div>
      {children}
    </div>
  );
}

function Select({ children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded border border-border bg-muted px-3 py-3 text-base text-gray-800 outline-none h-[52px]"
      {...rest}
    >
      {children}
    </select>
  );
}
