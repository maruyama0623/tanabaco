import { Navigate, Route, Routes } from 'react-router-dom';
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

function App() {
  return (
    <Routes>
      <Route path="/sp/start" element={<StartPage />} />
      <Route path="/sp/list" element={<PhotoListPage />} />
      <Route path="/sp/camera" element={<CameraPage />} />
      <Route path="/sp/count/:photoId" element={<CountPage />} />

      <Route path="/pc/assign" element={<AssignListPage />}>
        <Route path="modal/:photoId" element={<AssignModal />} />
      </Route>
      <Route path="/pc/assigned" element={<AssignedDetailPage />} />
      <Route path="/pc/report" element={<ReportPage />} />
      <Route path="/pc/products" element={<ProductListPage />} />
      <Route path="/pc/masters" element={<MasterPage />} />
      <Route path="/pc/departments" element={<DepartmentListPage />} />
      <Route path="/pc/staff" element={<StaffListPage />} />
      <Route path="/pc/suppliers" element={<SupplierListPage />} />

      <Route path="*" element={<Navigate to="/sp/start" replace />} />
    </Routes>
  );
}

export default App;
