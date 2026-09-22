import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/mother-plants', label: 'Mother Plants', icon: '🌳' },
  { to: '/propagation', label: 'Propagation Hub', icon: '🌱' },
  { to: '/inventory', label: 'Plant Inventory', icon: '📦' },
  { to: '/pos', label: 'Sales POS', icon: '🧾' },
  { to: '/vermicompost', label: 'Vermicompost', icon: '🪱' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-nursery-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-nursery-900 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nursery-300 text-xl">🌿</div>
          <div>
            <div className="text-sm font-bold leading-tight">Saba Nursery</div>
            <div className="text-[11px] text-nursery-300">SN-ERMS v3.0</div>
          </div>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-nursery-700 text-white' : 'text-nursery-100 hover:bg-nursery-800'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full p-4">
          <div className="rounded-xl bg-nursery-800 p-3 text-xs text-nursery-200">
            Decoupled Node.js API + PWA · Web / Android / iOS
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-nursery-100 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            ☰
          </button>
          <div className="hidden text-sm font-medium text-nursery-500 lg:block">
            Enterprise Resource &amp; Smart Inventory Management System
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-nursery-900">{user?.name}</div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-nursery-500">
                {user?.role}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nursery-100 font-bold text-nursery-700">
              {user?.name?.[0] ?? '?'}
            </div>
            <button className="btn-ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
