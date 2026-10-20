import { useCallback } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/book/AppLayout';
import { AuthProvider, useAuth } from '../lib/auth';
import { IdleWatcher } from '../lib/idle';
import DataCheck from '../screens/DataCheck';
import Home from '../screens/Home';
import LessonMenu from '../screens/LessonMenu';
import Placeholder from '../screens/Placeholder';
import StudyRoute from '../screens/study/StudyRoute';
import Start from '../screens/Start';

// 로그인(약관 동의까지)한 사람만. 아니면 첫 화면으로
function RequireAuth() {
  const { status, signOut } = useAuth();
  const expire = useCallback(() => signOut('idle'), [signOut]);
  const leave = useCallback(() => signOut('manual'), [signOut]);
  if (status === 'loading') return null;
  if (status !== 'ready') return <Navigate to="/" replace />;
  return (
    <>
      <Outlet />
      <IdleWatcher onExpire={expire} onLogout={leave} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/data-check" element={<DataCheck />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/learn" element={<Home />} />
              <Route path="/learn/:n" element={<LessonMenu />} />
              <Route path="/study/:n/:type" element={<StudyRoute />} />
              <Route path="/test" element={<Placeholder title="테스트" />} />
              <Route path="/me" element={<Placeholder title="마이페이지" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
