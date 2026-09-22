import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiErrorMessage } from '../api/client';
import { ErrorNote } from '../components/ui';

const DEMO = [
  { role: 'Admin', email: 'admin@sabanursery.com', password: 'Admin@12345' },
  { role: 'Manager', email: 'manager@sabanursery.com', password: 'Manager@123' },
  { role: 'Cashier', email: 'cashier@sabanursery.com', password: 'Cashier@123' },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@sabanursery.com');
  const [password, setPassword] = useState('Admin@12345');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-nursery-800 via-nursery-700 to-nursery-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-nursery-300 text-3xl">
            🌿
          </div>
          <h1 className="text-2xl font-extrabold">Saba Nursery ERMS</h1>
          <p className="text-sm text-nursery-200">
            Enterprise Resource &amp; Smart Inventory Management
          </p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <ErrorNote message={error} />
          <div>
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <span className="label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="rounded-lg bg-nursery-50 p-3 text-xs text-nursery-600">
            <div className="mb-1 font-semibold text-nursery-700">Demo accounts (click to fill)</div>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="rounded-full bg-white px-2.5 py-1 font-medium text-nursery-700 ring-1 ring-nursery-200 hover:bg-nursery-100"
                >
                  {d.role}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
