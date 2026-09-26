import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { apiErrorMessage } from '../api/client';
import { ErrorNote } from '../components/ui';
import { BrandLockup, LogoMark } from '../components/Logo';
import { PreferencesControls } from '../components/PreferencesControls';
import { AudioAssistTrigger } from '../components/AudioAssistTrigger';
import { AppNavButtons, InstallHint } from '../components/AppNavButtons';

const DEMO = [
  { role: 'Admin', email: 'admin@sabanursery.com', password: 'Admin@12345' },
  { role: 'Manager', email: 'manager@sabanursery.com', password: 'Manager@123' },
  { role: 'Staff', email: 'staff@sabanursery.com', password: 'Staff@123' },
  { role: 'Cashier', email: 'cashier@sabanursery.com', password: 'Cashier@123' },
];

const SHOW_DEMO = import.meta.env.DEV;

const HIGHLIGHTS = [
  { title: 'login.highlight1Title', detail: 'login.highlight1Detail' },
  { title: 'login.highlight2Title', detail: 'login.highlight2Detail' },
  { title: 'login.highlight3Title', detail: 'login.highlight3Detail' },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [email, setEmail] = useState(SHOW_DEMO ? 'admin@sabanursery.com' : '');
  const [password, setPassword] = useState(SHOW_DEMO ? 'Admin@12345' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedIn = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      const next = from && from.startsWith('/') && from !== '/login' ? from : (signedIn.isPlatformOwner ? '/platform' : '/');
      navigate(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-nursery-950 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-nursery-700/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-nursery-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />

        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          <BrandLockup light subtitle="SN-ERMS · v3.0" />

          <div className="max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-nursery-300">{t('login.kicker')}</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">{t('login.headline')}</h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-nursery-200">{t('login.lede')}</p>
          </div>

          <ul className="relative z-10 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nursery-300/20 text-nursery-300">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold">{t(item.title)}</div>
                  <div className="text-sm text-nursery-300">{t(item.detail)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="relative flex flex-col bg-[#F8FAFC] pt-[env(safe-area-inset-top)]">
        <InstallHint />
        <div className="flex items-center justify-between gap-2 px-3 py-2 lg:absolute lg:right-4 lg:top-4 lg:px-0 lg:py-0">
          <AppNavButtons className="lg:hidden" />
          <div className="ml-auto">
            <PreferencesControls />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8 sm:py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <BrandLockup subtitle="SN-ERMS · v3.0" />
          </div>

          <div className="mb-8 hidden items-center gap-3 lg:flex">
            <LogoMark className="h-12 w-12" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-nursery-600">Saba Nursery</p>
              <p className="text-sm text-nursery-700">{t('login.workspace')}</p>
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-nursery-950">{t('login.welcome')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-nursery-700">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <ErrorNote message={error} />
            <div>
              <span className="mb-1 flex items-center justify-between gap-2">
                <label className="label mb-0" htmlFor="email">
                  <Mail className="mr-1 inline h-4 w-4" aria-hidden />
                  {t('login.email')}
                </label>
                <AudioAssistTrigger textKey="voice.loginEmail" />
              </span>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder={t('login.emailPlaceholder')}
                data-speak={t('voice.loginEmail')}
                required
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0" htmlFor="password">
                  <Lock className="mr-1 inline h-4 w-4" aria-hidden />
                  {t('login.password')}
                </label>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost min-h-12 px-3"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    {showPassword ? t('common.hide') : t('common.show')}
                  </button>
                  <AudioAssistTrigger textKey="voice.loginPassword" />
                </span>
              </div>
              <input
                id="password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t('login.passwordPlaceholder')}
                data-speak={t('voice.loginPassword')}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-primary w-full" disabled={busy} data-speak={t('voice.signIn')}>
                <LogIn className="h-4 w-4" aria-hidden />
                {busy ? t('login.signingIn') : t('login.signIn')}
              </button>
              <AudioAssistTrigger textKey="voice.signIn" />
            </div>
          </form>

          {SHOW_DEMO && (
          <div className="mt-8 rounded-2xl border border-nursery-100 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-nursery-700">{t('login.demoTitle')}</div>
            <p className="mt-1 text-xs text-nursery-600">{t('login.demoHelp')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="min-h-12 rounded-full bg-nursery-50 px-4 text-xs font-semibold text-nursery-800 ring-1 ring-nursery-200 transition hover:bg-nursery-100"
                >
                  {t(`roles.${d.role}`)}
                </button>
              ))}
            </div>
          </div>
          )}

          <p className="mt-8 text-center text-[11px] font-medium tracking-wide text-nursery-500">
            {t('login.secure')}
          </p>
        </div>
        </div>
      </main>
    </div>
  );
}
