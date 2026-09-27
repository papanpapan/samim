import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TEST_ENVS = new Set(['staging', 'testing', 'test']);

export const IS_TEST_ENV = TEST_ENVS.has((import.meta.env.VITE_APP_ENV ?? '').toLowerCase());

export function EnvBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  if (!IS_TEST_ENV) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 ${className}`}
      title={t('env.testingHint')}
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      {t('env.testing')}
    </span>
  );
}
