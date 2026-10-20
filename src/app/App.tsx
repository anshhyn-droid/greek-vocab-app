import { BrowserRouter, Route, Routes } from 'react-router-dom';
import DataCheck from '../screens/DataCheck';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<DataCheck />} />
      </Routes>
    </BrowserRouter>
  );
}
