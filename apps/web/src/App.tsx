import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { EndpointsPage } from './pages/app/EndpointsPage';
import { OverviewPage } from './pages/app/OverviewPage';
import { useAuth } from './context/AuthContext';

function RootRedirect() {
  const { user, loading, setup } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return <Navigate to={setup?.setupRequired ? '/register' : '/login'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="endpoints" element={<EndpointsPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
