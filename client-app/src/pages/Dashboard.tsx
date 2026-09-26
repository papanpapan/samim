import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ClipboardCheck,
  Leaf,
  ShieldAlert,
  ShoppingCart,
  Sprout,
  TreeDeciduous,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { hasRole, POS_ROLES } from '../auth/roles';
import type { DashboardData, FeatureKey, Role } from '../types';
import { ErrorNote, PageHeader, StatCard, StatSkeleton } from '../components/ui';
import { formatMoney } from '../utils/money';

type TodayTask = {
  id: string;
  feature?: FeatureKey;
  roles?: readonly Role[];
  count: number;
  titleKey: string;
  whyKey: string;
  ctaKey: string;
  to: string;
  icon: LucideIcon;
  accent: 'rose' | 'amber' | 'sky' | 'nursery';
};

function TaskCard({
  title,
  why,
  cta,
  to,
  count,
  icon: Icon,
  accent,
}: {
  title: string;
  why: string;
  cta: string;
  to: string;
  count: number;
  icon: LucideIcon;
  accent: TodayTask['accent'];
}) {
  const ring: Record<TodayTask['accent'], string> = {
    rose: 'from-rose-500 to-rose-300',
    amber: 'from-amber-500 to-amber-300',
    sky: 'from-sky-500 to-sky-300',
    nursery: 'from-forest-700 to-forest-400',
  };
  const iconTone: Record<TodayTask['accent'], string> = {
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    nursery: 'bg-forest-50 text-forest-800',
  };

  return (
    <Link
      to={to}
      className="card flex min-h-[9.5rem] flex-col justify-between gap-4 p-5 transition hover:border-forest-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-forest-600 focus:ring-offset-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`mb-3 h-1 w-12 rounded-full bg-gradient-to-r ${ring[accent]}`} />
          <div className="text-lg font-bold text-slate-800">{title}</div>
          <p className="mt-1 text-sm text-slate-500">{why}</p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconTone[accent]}`}>
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl font-bold tabular-nums text-slate-800">{count}</span>
        <span className="btn-primary min-h-11 px-4 text-sm">{cta}</span>
      </div>
    </Link>
  );
}

function QuickLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="btn-ghost min-h-11 text-sm">
      {children}
    </Link>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const money = (n: number) => formatMoney(n, user?.nursery?.currencyCode);
  const showMoney = user?.role !== 'STAFF';
  const on = (feature: FeatureKey) =>
    !!user?.isPlatformOwner || !user?.features || user.features.includes(feature);
  const canRole = (roles?: readonly Role[]) => !roles || hasRole(user?.role, roles);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/reports/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const canAccess = (task: Pick<TodayTask, 'feature' | 'roles'>) =>
    (!task.feature || on(task.feature)) && canRole(task.roles);

  const todayTasks: TodayTask[] = data
    ? [
        {
          id: 'alerts',
          feature: 'CCTV_ALERTS',
          count: data.openDangerAlerts ?? 0,
          titleKey: 'dashboard.today.alertsTitle',
          whyKey: 'dashboard.today.alertsWhy',
          ctaKey: 'dashboard.today.alertsCta',
          to: '/alerts',
          icon: ShieldAlert,
          accent: 'rose',
        },
        {
          id: 'care',
          feature: 'CARE',
          count: data.pendingCare,
          titleKey: 'dashboard.today.careTitle',
          whyKey: 'dashboard.today.careWhy',
          ctaKey: 'dashboard.today.careCta',
          to: '/care',
          icon: ClipboardCheck,
          accent: 'amber',
        },
        {
          id: 'lowStock',
          feature: 'INVENTORY',
          count: data.lowStockCount,
          titleKey: 'dashboard.today.lowStockTitle',
          whyKey: 'dashboard.today.lowStockWhy',
          ctaKey: 'dashboard.today.lowStockCta',
          to: '/inventory',
          icon: TriangleAlert,
          accent: 'rose',
        },
        {
          id: 'batches',
          feature: 'PROPAGATION',
          count: data.attentionBatches ?? 0,
          titleKey: 'dashboard.today.batchesTitle',
          whyKey: 'dashboard.today.batchesWhy',
          ctaKey: 'dashboard.today.batchesCta',
          to: '/propagation',
          icon: Sprout,
          accent: 'sky',
        },
        {
          id: 'mothers',
          feature: 'MOTHER_PLANTS',
          count: data.unhealthyMothers ?? 0,
          titleKey: 'dashboard.today.mothersTitle',
          whyKey: 'dashboard.today.mothersWhy',
          ctaKey: 'dashboard.today.mothersCta',
          to: '/mother-plants',
          icon: TreeDeciduous,
          accent: 'amber',
        },
        {
          id: 'sell',
          feature: 'POS',
          roles: POS_ROLES,
          count: data.totalStockUnits,
          titleKey: 'dashboard.today.sellTitle',
          whyKey: 'dashboard.today.sellWhy',
          ctaKey: 'dashboard.today.sellCta',
          to: '/pos',
          icon: ShoppingCart,
          accent: 'nursery',
        },
      ]
    : [];

  // Hard urgents block "all clear". Sell is only a soft extra when stock exists.
  const hardUrgent = todayTasks.filter(
    (task) => task.id !== 'sell' && canAccess(task) && task.count > 0,
  );
  const sellTask = todayTasks.find((task) => task.id === 'sell' && canAccess(task) && task.count > 0);
  const urgentTasks =
    hardUrgent.length > 0
      ? [...hardUrgent, ...(sellTask ? [sellTask] : [])].slice(0, 5)
      : [];

  const quickLinks = (
    [
      { to: '/care', feature: 'CARE' as FeatureKey, labelKey: 'nav.care' },
      { to: '/inventory', feature: 'INVENTORY' as FeatureKey, labelKey: 'nav.inventory' },
      { to: '/propagation', feature: 'PROPAGATION' as FeatureKey, labelKey: 'nav.propagation' },
      { to: '/pos', feature: 'POS' as FeatureKey, roles: POS_ROLES, labelKey: 'nav.pos' },
      { to: '/mother-plants', feature: 'MOTHER_PLANTS' as FeatureKey, labelKey: 'nav.motherPlants' },
      { to: '/alerts', feature: 'CCTV_ALERTS' as FeatureKey, labelKey: 'nav.alerts' },
    ] as const
  ).filter((link) => canAccess(link));

  return (
    <div>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
      <ErrorNote message={error} />
      {!data && !error ? (
        <StatSkeleton />
      ) : data ? (
        <>
          <section className="mb-8" aria-labelledby="dashboard-today-heading">
            <div className="mb-4">
              <h2 id="dashboard-today-heading" className="text-lg font-bold text-slate-800">
                {t('dashboard.today.title')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{t('dashboard.today.subtitle')}</p>
            </div>

            {urgentTasks.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {urgentTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    title={t(task.titleKey, { count: task.count })}
                    why={t(task.whyKey, { count: task.count })}
                    cta={t(task.ctaKey)}
                    to={task.to}
                    count={task.count}
                    icon={task.icon}
                    accent={task.accent}
                  />
                ))}
              </div>
            ) : (
              <div className="card border-forest-100 bg-forest-50/40 p-6">
                <div className="text-lg font-bold text-forest-900">{t('dashboard.today.allClear')}</div>
                <p className="mt-1 text-sm text-forest-800/80">{t('dashboard.today.allClearHint')}</p>
                {quickLinks.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickLinks.map((link) => (
                      <QuickLink key={link.to} to={link.to}>
                        {t(link.labelKey)}
                      </QuickLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            {t('dashboard.statsHeading')}
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {on('MOTHER_PLANTS') && <StatCard
              label={t('dashboard.motherPlants')}
              value={data.motherPlants}
              hint={t('dashboard.motherHint')}
              accent="nursery"
              icon={<TreeDeciduous className="h-5 w-5 text-forest-700" aria-hidden />}
              speak={t('voice.motherPlants', { count: data.motherPlants })}
            />}
            {on('PROPAGATION') && <StatCard
              label={t('dashboard.activeBatches')}
              value={data.activeBatches}
              hint={t('dashboard.activeHint')}
              accent="sky"
              icon={<Sprout className="h-5 w-5 text-sky-600" aria-hidden />}
              speak={t('voice.activeBatches', { count: data.activeBatches })}
            />}
            {on('INVENTORY') && <StatCard
              label={t('dashboard.readySkus')}
              value={data.skuCount}
              hint={t('dashboard.readyHint', { count: data.totalStockUnits })}
              accent="nursery"
              icon={<Leaf className="h-5 w-5 text-forest-700" aria-hidden />}
              speak={t('voice.readySkus', { count: data.skuCount, units: data.totalStockUnits })}
            />}
            {on('INVENTORY') && <StatCard
              label={t('dashboard.lowStock')}
              value={data.lowStockCount}
              hint={t('dashboard.lowHint')}
              accent={data.lowStockCount > 0 ? 'rose' : 'nursery'}
              icon={<TriangleAlert className={`h-5 w-5 ${data.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} aria-hidden />}
              speak={t('voice.lowStock', { count: data.lowStockCount })}
            />}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {on('CARE') && <StatCard label={t('dashboard.pendingCare')} value={data.pendingCare} hint={t('dashboard.pendingCareHint')} accent={data.pendingCare > 0 ? 'amber' : 'nursery'} />}
            {on('VERMICOMPOST') && <StatCard label={t('dashboard.bedsReady')} value={data.bedsReady} hint={t('dashboard.bedsReadyHint')} accent={data.bedsReady > 0 ? 'amber' : 'nursery'} />}
            {showMoney && on('DISTRIBUTION') && (
              <>
                <StatCard label={t('dashboard.openBookings')} value={data.openBookings} hint={t('dashboard.openBookingsHint')} accent="sky" />
                <StatCard label={t('dashboard.newLeads')} value={data.newLeads} hint={t('dashboard.newLeadsHint')} accent="sky" />
              </>
            )}
          </div>

          <div className={`mt-4 grid grid-cols-1 gap-4 ${showMoney ? 'lg:grid-cols-3' : ''}`}>
            {showMoney && on('POS') && (
              <StatCard
                label={t('dashboard.totalSales')}
                value={money(data.totalSalesValue)}
                hint={t('dashboard.salesHint', { count: data.salesCount })}
                accent="sky"
                icon={<Wallet className="h-5 w-5 text-sky-600" aria-hidden />}
                speak={t('voice.totalSales')}
              />
            )}
            {on('VERMICOMPOST') && <StatCard
              label={t('dashboard.vermiYield')}
              value={`${data.vermicompostYieldKg} kg`}
              hint={t('dashboard.vermiHint')}
              accent="amber"
              icon={<Leaf className="h-5 w-5 text-amber-600" aria-hidden />}
              speak={t('voice.vermiYield')}
            />}
            {showMoney && on('INVENTORY') && (
              <StatCard
                label={t('dashboard.profit')}
                value={money(data.inventoryValuation.potentialProfit)}
                hint={t('dashboard.profitHint')}
                accent="amber"
                icon={<Wallet className="h-5 w-5 text-amber-600" aria-hidden />}
                speak={t('voice.profit')}
              />
            )}
          </div>

          {showMoney && on('INVENTORY') && <div className="mt-4 card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-700">{t('dashboard.valuation')}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{t('dashboard.cost')}</div>
                <div className="text-xl font-bold text-slate-800">{money(data.inventoryValuation.cost)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{t('dashboard.retail')}</div>
                <div className="text-xl font-bold text-slate-800">{money(data.inventoryValuation.retail)}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-medium text-amber-700">{t('dashboard.margin')}</div>
                <div className="text-xl font-bold text-amber-700">{money(data.inventoryValuation.potentialProfit)}</div>
              </div>
            </div>
          </div>}
        </>
      ) : null}
    </div>
  );
}
