import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ClipboardCheck, LayoutDashboard, Leaf, LogOut, MapPin, Menu, Package, Shield, ShieldAlert, ShoppingCart, Sprout, StickyNote, TreeDeciduous, Truck, Wallet, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_ROLES, hasRole, MANAGER_ROLES, POS_ROLES, SITE_ROLES } from '../auth/roles';
import type { FeatureKey, Role } from '../types';
import { LiveDock } from './LiveDock';
import { BrandLockup } from './Logo';
import { PreferencesControls } from './PreferencesControls';
import { AudioAssistTrigger } from './AudioAssistTrigger';
import { AppNavButtons, InstallHint } from './AppNavButtons';

const NAV: { to: string; label: string; icon: LucideIcon; end: boolean; roles?: readonly Role[]; feature?: FeatureKey; ownerOnly?: boolean }[] = [
  { to: '/platform', label: 'nav.platform', icon: Building2, end: false, ownerOnly: true },
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/nursery', label: 'nav.myNursery', icon: MapPin, end: false, roles: SITE_ROLES },
  { to: '/mother-plants', label: 'nav.motherPlants', icon: TreeDeciduous, end: false, feature: 'MOTHER_PLANTS' },
  { to: '/propagation', label: 'nav.propagation', icon: Sprout, end: false, feature: 'PROPAGATION' },
  { to: '/inventory', label: 'nav.inventory', icon: Package, end: false, feature: 'INVENTORY' },
  { to: '/pos', label: 'nav.pos', icon: ShoppingCart, end: false, roles: POS_ROLES, feature: 'POS' },
  { to: '/vermicompost', label: 'nav.vermicompost', icon: Leaf, end: false, feature: 'VERMICOMPOST' },
  { to: '/care', label: 'nav.care', icon: ClipboardCheck, end: false, feature: 'CARE' },
  { to: '/distribution', label: 'nav.distribution', icon: Truck, end: false, roles: POS_ROLES, feature: 'DISTRIBUTION' },
  { to: '/reports', label: 'nav.reports', icon: Wallet, end: false, roles: MANAGER_ROLES, feature: 'ACCOUNTS' },
  { to: '/admin', label: 'nav.admin', icon: Shield, end: false, roles: ADMIN_ROLES, feature: 'NURSERY_ADMIN' },
  { to: '/alerts', label: 'nav.alerts', icon: ShieldAlert, end: false, feature: 'CCTV_ALERTS' },
  // Voice / Treatment stay routable but off the main menu for cleaner testing UX.
];

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#F8FAFC]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white text-slate-700 shadow-sm transition-transform lg:static lg:shrink-0 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-5">
          <BrandLockup subtitle="SN-ERMS v3.0" />
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {NAV.filter((item) => {
            if (item.ownerOnly) return !!user?.isPlatformOwner;
            if (item.roles && !hasRole(user?.role, item.roles)) return false;
            if (item.feature && !user?.isPlatformOwner && user?.features && !user.features.includes(item.feature)) return false;
            return true;
          }).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                    isActive ? 'bg-forest-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t(item.label)}
              </NavLink>
            );
          })}
          {(user?.features ?? [])
            .filter(
              (feature) =>
                feature !== 'LIVE_CAMERA'
                && feature !== 'PLANT_ID'
                && feature !== 'VOICE_DESK'
                && feature !== 'PLANT_TREATMENT'
                && !NAV.some((item) => item.feature === feature),
            )
            .map((feature) => (
              <NavLink
                key={feature}
                to={`/desk/${feature}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                    isActive ? 'bg-forest-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <StickyNote className="h-5 w-5" aria-hidden />
                {t(`platform.featureLabels.${feature}`, { defaultValue: feature })}
              </NavLink>
            ))}
        </nav>
        <div className="shrink-0 border-t border-slate-200 p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">{t('nav.footer')}</div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]">
        <InstallHint />
        <header className="z-20 flex h-14 shrink-0 items-center gap-1.5 border-b border-slate-200/80 bg-white/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-white/90 sm:h-16 sm:gap-3 sm:px-5 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2.5">
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-50 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label={t('common.menu')}
              data-speak={t('voice.menu')}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <AppNavButtons className="lg:hidden" />
            <div className="min-w-0 lg:hidden">
              <BrandLockup compact subtitle="SN-ERMS" />
            </div>
            <div className="hidden truncate text-sm font-medium text-slate-500 lg:block">{t('nav.tagline')}</div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PreferencesControls />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden />
            <div className="hidden min-w-0 text-right sm:block">
              <div className="truncate text-sm font-semibold text-slate-800">{user?.name}</div>
              <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {user?.nursery?.name ? `${user.nursery.name} · ` : ''}
                {user ? t(`roles.${user.role}`, { defaultValue: user.role }) : ''}
              </div>
            </div>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-700 text-sm font-bold text-white shadow-sm sm:h-10 sm:w-10"
              title={user?.name ?? undefined}
              aria-hidden
            >
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200"
              onClick={logout}
              aria-label={t('common.logout')}
              data-speak={t('voice.logout')}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
            <div className="hidden sm:block">
              <AudioAssistTrigger textKey="voice.logout" />
            </div>
          </div>
        </header>
        <LiveDock />
        <main className="relative min-h-0 flex-1">
          <div className="absolute inset-0 flex flex-col overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
