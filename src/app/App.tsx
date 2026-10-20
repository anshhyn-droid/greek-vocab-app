import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/book/AppLayout';
import DataCheck from '../screens/DataCheck';
import Placeholder from '../screens/Placeholder';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/data-check" element={<DataCheck />} />
        <Route element={<AppLayout />}>
          <Route path="/learn" element={<Placeholder title="학습" />} />
          <Route path="/test" element={<Placeholder title="테스트" />} />
          <Route path="/me" element={<Placeholder title="마이페이지" />} />
        </Route>
        <Route path="*" element={<Navigate to="/learn" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
