import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';
import type { DashboardData } from '../types';
import { ErrorNote, PageHeader, Spinner, StatCard } from '../components/ui';

const money = (n: number) => `৳${n.toLocaleString('en-IN')}`;

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/reports/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  return (
    <div>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live snapshot of nursery production, inventory & sales"
      />
      <ErrorNote message={error} />
      {!data && !error ? (
        <Spinner label="Loading metrics…" />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Mother Plants" value={data.motherPlants} hint="Exotic cultivars" accent="nursery" />
            <StatCard label="Active Batches" value={data.activeBatches} hint="In propagation lifecycle" accent="sky" />
            <StatCard label="Ready SKUs" value={data.skuCount} hint={`${data.totalStockUnits} plants in stock`} accent="nursery" />
            <StatCard
              label="Low Stock Alerts"
              value={data.lowStockCount}
              hint="At/below reorder level"
              accent={data.lowStockCount > 0 ? 'rose' : 'nursery'}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatCard label="Total Sales" value={money(data.totalSalesValue)} hint={`${data.salesCount} invoices`} accent="amber" />
            <StatCard label="Vermicompost Yield" value={`${data.vermicompostYieldKg} kg`} hint="Harvested organic soil" accent="nursery" />
            <StatCard
              label="Potential Profit"
              value={money(data.inventoryValuation.potentialProfit)}
              hint="Retail value − cost of current stock"
              accent="sky"
            />
          </div>

          <div className="mt-4 card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-nursery-700">
              Inventory Valuation
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-nursery-50 p-4">
                <div className="text-xs text-nursery-500">Cost value</div>
                <div className="text-xl font-bold text-nursery-900">{money(data.inventoryValuation.cost)}</div>
              </div>
              <div className="rounded-xl bg-nursery-50 p-4">
                <div className="text-xs text-nursery-500">Retail value</div>
                <div className="text-xl font-bold text-nursery-900">{money(data.inventoryValuation.retail)}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-nursery-600 to-nursery-800 p-4 text-white">
                <div className="text-xs text-nursery-100">Projected margin</div>
                <div className="text-xl font-bold">{money(data.inventoryValuation.potentialProfit)}</div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
