import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type PaidServiceKind =
  | 'WHATSAPP'
  | 'PAID_TTS'
  | 'VISION_ID'
  | 'THERMAL_PRINTER'
  | 'NVR_CCTV';

type Pending = {
  kind: PaidServiceKind;
  title: string;
  onMock: () => void | Promise<void>;
};

type Ctx = {
  requestPaidService: (pending: Pending) => void;
};

const PaidSimContext = createContext<Ctx | null>(null);

export function usePaidSimulation() {
  const ctx = useContext(PaidSimContext);
  if (!ctx) throw new Error('PaidSimulationProvider missing');
  return ctx;
}

/** Optional hook when provider may be absent (storybook / tests). */
export function usePaidSimulationOptional() {
  return useContext(PaidSimContext);
}

export function PaidSimulationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<Pending | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [keys, setKeys] = useState({ whatsapp: '', tts: '', vision: '' });

  const requestPaidService = useCallback((p: Pending) => setPending(p), []);

  const value = useMemo(() => ({ requestPaidService }), [requestPaidService]);

  return (
    <PaidSimContext.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-nursery-950">{t('paidSim.title')}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {t('paidSim.body', { service: pending.title })}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary min-h-12 w-full"
                onClick={async () => {
                  const run = pending.onMock;
                  setPending(null);
                  await new Promise((r) => setTimeout(r, 600));
                  await run();
                }}
              >
                {t('paidSim.proceedMock')}
              </button>
              <button
                type="button"
                className="btn-ghost min-h-12 w-full"
                onClick={() => {
                  setDrawer(true);
                }}
              >
                {t('paidSim.configure')}
              </button>
              <button type="button" className="btn-ghost min-h-12 w-full" onClick={() => setPending(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {drawer && (
        <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-sm border-l border-slate-200 bg-white p-5 shadow-2xl">
          <h3 className="text-base font-bold">{t('paidSim.keysTitle')}</h3>
          <p className="mt-1 text-xs text-slate-500">{t('paidSim.keysHelp')}</p>
          <label className="mt-4 block text-xs font-semibold">
            WhatsApp
            <input className="input mt-1" value={keys.whatsapp} onChange={(e) => setKeys({ ...keys, whatsapp: e.target.value })} />
          </label>
          <label className="mt-3 block text-xs font-semibold">
            Paid TTS
            <input className="input mt-1" value={keys.tts} onChange={(e) => setKeys({ ...keys, tts: e.target.value })} />
          </label>
          <label className="mt-3 block text-xs font-semibold">
            Vision ID
            <input className="input mt-1" value={keys.vision} onChange={(e) => setKeys({ ...keys, vision: e.target.value })} />
          </label>
          <button
            type="button"
            className="btn-primary mt-6 min-h-12 w-full"
            onClick={() => {
              localStorage.setItem('sn-paid-keys', JSON.stringify(keys));
              setDrawer(false);
            }}
          >
            {t('common.save')}
          </button>
          <button type="button" className="btn-ghost mt-2 min-h-12 w-full" onClick={() => setDrawer(false)}>
            {t('common.close')}
          </button>
        </div>
      )}
    </PaidSimContext.Provider>
  );
}
