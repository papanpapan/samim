import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { hasRole, POS_ROLES, MANAGER_ROLES, ADMIN_ROLES, SITE_ROLES } from './auth/roles';
import type { Role } from './types';
import { Platform } from './pages/Platform';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MotherPlants } from './pages/MotherPlants';
import { Propagation } from './pages/Propagation';
import { Inventory } from './pages/Inventory';
import { POS } from './pages/POS';
import { Vermicompost } from './pages/Vermicompost';
import { Care } from './pages/Care';
import { Distribution } from './pages/Distribution';
import { Reports } from './pages/Reports';
import { Admin } from './pages/Admin';
import { Nursery } from './pages/Nursery';
import { Alerts } from './pages/Alerts';
import { AlertCase } from './pages/AlertCase';
import { VoiceDesk } from './pages/VoiceDesk';
import { Treatment } from './pages/Treatment';
import { PlantId } from './pages/PlantId';
import { ModuleDesk } from './pages/ModuleDesk';
import { PlantShowcase } from './pages/PlantShowcase';
import { BatchStatus } from './pages/BatchStatus';
import { UnitLabel } from './pages/UnitLabel';
import { StockShowcase } from './pages/StockShowcase';
import { useTranslation } from 'react-i18next';
import { Spinner } from './components/ui';
import { AppHistoryProvider } from './navigation/AppHistory';
import { ExitHintToast } from './components/AppNavButtons';

function AccessDenied({ reason }: { reason: 'role' | 'feature' | 'owner' }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-nursery-950">{t('access.deniedTitle')}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {reason === 'owner' ? t('access.ownerOnly') : reason === 'role' ? t('access.roleDenied') : t('access.featureDenied')}
      </p>
      <Link to="/" className="btn-primary mt-8 inline-flex">{t('access.goHome')}</Link>
    </div>
  );
}

function RoleGate({ allow, feature, children }: { allow: readonly Role[]; feature?: string; children: JSX.Element }) {
  const { user } = useAuth();
  if (!hasRole(user?.role, allow)) return <AccessDenied reason="role" />;
  if (feature && !user?.isPlatformOwner && user?.features && !user.features.includes(feature)) {
    return <AccessDenied reason="feature" />;
  }
  return children;
}

function FeatureGate({ feature, children }: { feature: string; children: JSX.Element }) {
  const { user } = useAuth();
  if (user?.isPlatformOwner) return children;
  if (user?.features && !user.features.includes(feature)) return <AccessDenied reason="feature" />;
  return children;
}

function OwnerGate({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user?.isPlatformOwner) return <AccessDenied reason="owner" />;
  return children;
}

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppHistoryProvider>
          <ExitHintToast />
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/plant/:code" element={<PlantShowcase />} />
          <Route path="/batch/:code" element={<BatchStatus />} />
          <Route path="/unit/:code" element={<UnitLabel />} />
          <Route path="/stock/:code" element={<StockShowcase />} />
          <Route path="/alert/:code" element={<AlertCase />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route
              path="/platform"
              element={
                <OwnerGate>
                  <Platform />
                </OwnerGate>
              }
            />
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/nursery"
              element={
                <RoleGate allow={SITE_ROLES}>
                  <Nursery />
                </RoleGate>
              }
            />
            <Route path="/mother-plants" element={<FeatureGate feature="MOTHER_PLANTS"><MotherPlants /></FeatureGate>} />
            <Route path="/propagation" element={<FeatureGate feature="PROPAGATION"><Propagation /></FeatureGate>} />
            <Route path="/inventory" element={<FeatureGate feature="INVENTORY"><Inventory /></FeatureGate>} />
            <Route
              path="/pos"
              element={
                <RoleGate allow={POS_ROLES} feature="POS">
                  <POS />
                </RoleGate>
              }
            />
            <Route path="/vermicompost" element={<FeatureGate feature="VERMICOMPOST"><Vermicompost /></FeatureGate>} />
            <Route path="/care" element={<FeatureGate feature="CARE"><Care /></FeatureGate>} />
            <Route
              path="/distribution"
              element={
                <RoleGate allow={POS_ROLES} feature="DISTRIBUTION">
                  <Distribution />
                </RoleGate>
              }
            />
            <Route
              path="/reports"
              element={
                <RoleGate allow={MANAGER_ROLES} feature="ACCOUNTS">
                  <Reports />
                </RoleGate>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleGate allow={ADMIN_ROLES} feature="NURSERY_ADMIN">
                  <Admin />
                </RoleGate>
              }
            />
            <Route path="/alerts" element={<FeatureGate feature="CCTV_ALERTS"><Alerts /></FeatureGate>} />
            <Route path="/voice" element={<FeatureGate feature="VOICE_DESK"><VoiceDesk /></FeatureGate>} />
            <Route path="/treatment" element={<FeatureGate feature="PLANT_TREATMENT"><Treatment /></FeatureGate>} />
            <Route path="/identify" element={<FeatureGate feature="PLANT_ID"><PlantId /></FeatureGate>} />
            <Route path="/desk/:feature" element={<ModuleDesk />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppHistoryProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
