import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { StartPage } from './pages/sp/StartPage';
import { PhotoListPage } from './pages/sp/PhotoListPage';
import { CameraPage } from './pages/sp/CameraPage';
import { CountPage } from './pages/sp/CountPage';
import { AssignListPage } from './pages/pc/AssignListPage';
import { AssignModal } from './pages/pc/AssignModal';
import { AssignedDetailPage } from './pages/pc/AssignedDetailPage';
import { ReportPage } from './pages/pc/ReportPage';
import { ProductListPage } from './pages/pc/ProductListPage';
import { MasterPage } from './pages/pc/MasterPage';
import { DepartmentListPage } from './pages/pc/DepartmentListPage';
import { StaffListPage } from './pages/pc/StaffListPage';
import { SupplierListPage } from './pages/pc/SupplierListPage';
import { hydratePersistence } from './services/persistence';

function App() {
  const location = useLocation();

  // 各ページ遷移時に最新データを取得してキャッシュとストアを更新
  useEffect(() => {
    void hydratePersistence();
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/start" element={<StartPage />} />
      <Route path="/list" element={<PhotoListPage />} />
      <Route path="/camera" element={<CameraPage />} />
      <Route path="/count/:photoId" element={<CountPage />} />

      <Route path="/assign/*" element={<AssignListPage />}>
        <Route path="modal/:photoId" element={<AssignModal />} />
      </Route>
      <Route path="/assigned" element={<AssignedDetailPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/products" element={<ProductListPage />} />
      <Route path="/masters" element={<MasterPage />} />
      <Route path="/departments" element={<DepartmentListPage />} />
      <Route path="/staff" element={<StaffListPage />} />
      <Route path="/suppliers" element={<SupplierListPage />} />

      {/* legacy paths for compatibility */}
      <Route path="/sp/*" element={<Navigate to="/start" replace />} />
      <Route path="/pc/*" element={<Navigate to="/assign" replace />} />

      <Route path="*" element={<Navigate to="/start" replace />} />
    </Routes>
  );
}

export default App;
