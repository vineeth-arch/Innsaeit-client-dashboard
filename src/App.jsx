// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/useAuth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProjectView from './pages/ProjectView.jsx';
import SkuDetail from './pages/SkuDetail.jsx';
import Settings from './pages/Settings.jsx';

function Gate({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="login-wrap"><p className="eyebrow">Loading…</p></div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Gate><Layout /></Gate>}>
            <Route index element={<Dashboard />} />
            <Route path="project/:projectId" element={<ProjectView />} />
            <Route path="sku/:skuId" element={<SkuDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
