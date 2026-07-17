import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { EvidencePage } from './pages/EvidencePage';
import { StatusPage } from './pages/StatusPage';
import { EndpointsPage } from './pages/app/EndpointsPage';
import { OverviewPage } from './pages/app/OverviewPage';
import { OperationsPage } from './pages/app/OperationsPage';
import { MonitorPage } from './pages/app/MonitorPage';
import { ScenariosPage } from './pages/app/ScenariosPage';
import { DemoPage } from './pages/app/DemoPage';
import { DocsPage } from './pages/app/DocsPage';
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
      <Route path="/evidence/:token" element={<EvidencePage />} />
      <Route path="/status/:token" element={<StatusPage />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="endpoints" element={<EndpointsPage />} />
        <Route path="scenarios" element={<ScenariosPage />} />
        <Route path="monitor" element={<MonitorPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="demo" element={<DemoPage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
