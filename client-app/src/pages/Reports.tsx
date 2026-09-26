import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorNote, Field, PageHeader, StatCard, StatSkeleton } from '../components/ui';
import { formatMoney } from '../utils/money';

interface Profit {
  revenue: number;
  cost: number;
  expenses: number;
  grossProfit: number;
  marginPct: number;
}

interface Expense {
  id: string;
  category: string;
  amount: string;
  note?: string | null;
  spentOn: string;
}

const CATEGORIES = ['FERTILIZER', 'POLYBAGS', 'COCOPEAT', 'LABOUR', 'ELECTRICITY', 'OTHER'] as const;

export function Reports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currency = user?.nursery?.currencyCode;
  const money = (n: number) => formatMoney(n, currency);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ category: 'FERTILIZER', amount: 500, note: '' });

  const load = () => {
    Promise.all([api.get('/reports/profitability'), api.get('/expenses')])
      .then(([p, e]) => {
        setProfit(p.data.data);
        setExpenses(e.data.data);
      })
      .catch((err) => setError(apiErrorMessage(err)));
  };
  useEffect(load, []);

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      await api.post('/expenses', { ...form, note: form.note || undefined });
      setForm({ ...form, note: '' });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} />
      <ErrorNote message={error} />
      {!profit ? (
        <StatSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('reports.revenue')} value={money(profit.revenue)} />
            <StatCard label={t('reports.cost')} value={money(profit.cost)} />
            <StatCard label={t('reports.expenses')} value={money(profit.expenses)} accent="amber" />
            <StatCard label={t('reports.gross')} value={money(profit.grossProfit)} hint={`${profit.marginPct}%`} accent="sky" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <form onSubmit={save} className="card space-y-3 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('reports.addExpense')}</h2>
              <Field label={t('reports.category')}>
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((key) => <option key={key} value={key}>{t(`reports.categories.${key}`)}</option>)}
                </select>
              </Field>
              <Field label={t('reports.amount')}>
                <input type="number" min={1} className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
              </Field>
              <Field label={t('reports.note')}>
                <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </Field>
              <button className="btn-primary w-full">{t('common.save')}</button>
            </form>
            <div className="card overflow-hidden lg:col-span-2">
              <table className="w-full text-sm">
                <thead className="bg-nursery-50 text-left text-xs uppercase tracking-wide text-nursery-600">
                  <tr>
                    <th className="px-4 py-3">{t('reports.category')}</th>
                    <th className="px-4 py-3">{t('reports.amount')}</th>
                    <th className="px-4 py-3">{t('reports.note')}</th>
                    <th className="px-4 py-3">{t('reports.when')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nursery-50">
                  {expenses.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{t(`reports.categories.${row.category}`)}</td>
                      <td className="px-4 py-3 font-semibold">{money(Number(row.amount))}</td>
                      <td className="px-4 py-3 text-slate-500">{row.note || '—'}</td>
                      <td className="px-4 py-3">{new Date(row.spentOn).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('reports.empty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
