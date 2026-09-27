import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { PaidSimulationProvider } from './components/PaidSimulation';
import { hasRole, POS_ROLES, MANAGER_ROLES, ADMIN_ROLES, SITE_ROLES, canRunPos } from './auth/roles';
import type { Role } from './types';
import { Platform } from './pages/Platform';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FieldWorkerHome } from './pages/FieldWorkerHome';
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
import { StaffTeam } from './pages/StaffTeam';
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

function AccessRequestPanel({ reason }: { reason: 'role' | 'feature' | 'owner' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const requestAccess = () => {
    const payload = {
      at: new Date().toISOString(),
      userId: user?.id,
      email: user?.email,
      reason,
      path: window.location.pathname,
    };
    const prev = JSON.parse(localStorage.getItem('sn-access-requests') || '[]') as unknown[];
    localStorage.setItem('sn-access-requests', JSON.stringify([payload, ...prev].slice(0, 40)));
    setSent(true);
  };
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-nursery-950">{t('access.deniedTitle')}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        {reason === 'owner' ? t('access.ownerOnly') : reason === 'role' ? t('access.roleDenied') : t('access.featureDenied')}
      </p>
      {!sent ? (
        <button type="button" className="btn-primary mt-6 inline-flex min-h-12" onClick={requestAccess}>
          {t('access.requestAccess')}
        </button>
      ) : (
        <p className="mt-6 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-800 ring-1 ring-forest-200">
          {t('access.requestSent')}
        </p>
      )}
      <div className="mt-4 flex flex-col items-center gap-2">
        <Link to="/field" className="btn-ghost inline-flex min-h-12">{t('access.goField')}</Link>
        <Link to="/" className="btn-primary inline-flex min-h-12">{t('access.goHome')}</Link>
      </div>
    </div>
  );
}

function RoleGate({ allow, feature, children }: { allow: readonly Role[]; feature?: string; children: JSX.Element }) {
  const { user } = useAuth();
  const roleOk =
    feature === 'POS' ? canRunPos(user?.role) : hasRole(user?.role, allow);
  if (!roleOk) return <AccessRequestPanel reason="role" />;
  if (feature && !user?.isPlatformOwner && user?.features && !user.features.includes(feature)) {
    return <AccessRequestPanel reason="feature" />;
  }
  return children;
}

function FeatureGate({ feature, children }: { feature: string; children: JSX.Element }) {
  const { user } = useAuth();
  if (user?.isPlatformOwner) return children;
  if (user?.features && !user.features.includes(feature)) return <AccessRequestPanel reason="feature" />;
  return children;
}

function OwnerGate({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user?.isPlatformOwner) return <AccessRequestPanel reason="owner" />;
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
      <PaidSimulationProvider>
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
            <Route path="/field" element={<FieldWorkerHome />} />
            <Route path="/staff-team" element={<StaffTeam />} />
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
      </PaidSimulationProvider>
    </AuthProvider>
  );
}
