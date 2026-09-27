import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Percent, Shield, Users } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import { ErrorNote, Field, FieldHint, ListSkeleton, RecordItem } from '../components/ui';

interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationId: string | null;
}

interface Place {
  id: string;
  name: string;
  address: string;
  people: Person[];
}

interface RoleAccess {
  role: Role;
  inherit: boolean;
  features: string[];
}

interface NurserySite {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  onboardedAt: string;
  plan: string;
  currencyCode?: string;
  gstDefaultPct?: number;
  gstSlabs?: number[];
  userLimit: number;
  locations: Place[];
  unassigned: Person[];
  features: string[];
  roleAccess: RoleAccess[];
}

interface PlatformNurseryRow {
  id: string;
  name: string;
  code: string;
  currencyCode?: string;
}

const ROLES: Role[] = ['STAFF', 'MANAGER', 'CASHIER', 'ADMIN'];
const blankForm = { name: '', email: '', password: '', role: 'STAFF' as Role };
const GST_CHOICES = [0, 5, 12, 18];

/**
 * Unified Staff & Team — people CRUD + role feature packs for the active nursery.
 * Platform owner can switch nursery here; onboarding stays on /platform.
 */
export function StaffTeam() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const canManagePeople = user?.role === 'ADMIN' || !!user?.isPlatformOwner;
  const [site, setSite] = useState<NurserySite | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blankForm);
  const [draftPlace, setDraftPlace] = useState('');
  const [addingPlace, setAddingPlace] = useState<string | null>(null);
  const [platformNurseries, setPlatformNurseries] = useState<PlatformNurseryRow[]>([]);
  const [gstDefault, setGstDefault] = useState(0);
  const [gstSlabs, setGstSlabs] = useState<number[]>([0, 5, 12, 18]);
  const [gstSaved, setGstSaved] = useState(false);

  const load = () =>
    api
      .get('/nursery')
      .then((res) => {
        const data = res.data.data as NurserySite;
        setSite(data);
        setGstDefault(Number(data.gstDefaultPct ?? 0));
        setGstSlabs(Array.isArray(data.gstSlabs) && data.gstSlabs.length ? data.gstSlabs : [0, 5, 12, 18]);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setReady(true));

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!user?.isPlatformOwner) return;
    api
      .get('/platform/nurseries')
      .then((res) => {
        const rows = (res.data.data as PlatformNurseryRow[]) ?? [];
        setPlatformNurseries(rows.map((n) => ({ id: n.id, name: n.name, code: n.code, currencyCode: n.currencyCode })));
      })
      .catch(() => setPlatformNurseries([]));
  }, [user?.isPlatformOwner]);

  const switchNursery = async (nurseryId: string) => {
    if (!nurseryId) return;
    setError(null);
    setReady(false);
    localStorage.setItem('sn-nursery', nurseryId);
    try {
      await refresh();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
      setReady(true);
    }
  };

  const saveGst = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManagePeople) return;
    setPending('gst');
    setError(null);
    setGstSaved(false);
    try {
      const slabs = gstSlabs.length ? gstSlabs : [0];
      let def = gstDefault;
      if (!slabs.includes(def)) def = slabs[0] ?? 0;
      await api.patch('/nursery/gst', { gstDefaultPct: def, gstSlabs: slabs });
      setGstDefault(def);
      setGstSlabs(slabs);
      setGstSaved(true);
      await refresh();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const toggleSlab = (pct: number) => {
    setGstSlabs((prev) => {
      if (prev.includes(pct)) {
        if (prev.length <= 1) return prev;
        return prev.filter((n) => n !== pct).sort((a, b) => a - b);
      }
      return [...prev, pct].sort((a, b) => a - b);
    });
  };

  const peopleCount = site
    ? site.locations.reduce((sum, place) => sum + place.people.length, 0) + site.unassigned.length
    : 0;
  const atPeopleLimit = !!site && site.userLimit > 0 && peopleCount >= site.userLimit;
  const limitNote =
    atPeopleLimit && site
      ? t('site.peopleLimit', {
          plan: t(`site.plans.${site.plan}`, { defaultValue: site.plan }),
          limit: site.userLimit,
          count: peopleCount,
        })
      : null;

  const places = site
    ? [
        ...site.locations.map((place) => ({ ...place, whole: false as const })),
        ...(site.unassigned.length
          ? [
              {
                id: 'unassigned',
                name: t('site.unassigned'),
                address: t('site.unassignedHint'),
                people: site.unassigned,
                whole: true as const,
              },
            ]
          : []),
      ]
    : [];

  const addPerson = async (event: FormEvent, locationId: string) => {
    event.preventDefault();
    setPending(`add:${locationId}`);
    setError(null);
    try {
      await api.post(`/nursery/places/${locationId}/users`, draft);
      setDraft(blankForm);
      setAddingPlace(null);
      await load();
    } catch (err) {
      const raw = apiErrorMessage(err);
      const match = raw.match(/This plan allows (\d+) people/);
      setError(
        match
          ? t('site.peopleLimit', {
              plan: t(`site.plans.${site?.plan ?? ''}`, { defaultValue: site?.plan ?? '' }),
              limit: Number(match[1]),
              count: peopleCount || Number(match[1]),
            })
          : raw,
      );
    } finally {
      setPending(null);
    }
  };

  const savePerson = async (event: FormEvent, person: Person) => {
    event.preventDefault();
    setPending(`save:${person.id}`);
    setError(null);
    try {
      await api.patch(`/nursery/users/${person.id}`, {
        name: draft.name,
        role: draft.role,
        password: draft.password,
        locationId: draftPlace || null,
      });
      setEditingId(null);
      setDraft(blankForm);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const removePerson = async (person: Person) => {
    setPending(`delete:${person.id}`);
    setError(null);
    try {
      await api.delete(`/nursery/users/${person.id}`);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const saveRoleFeatures = async (role: Role, features: string[], inherit: boolean, key: string) => {
    setPending(key);
    setError(null);
    try {
      await api.patch(`/nursery/roles/${role}/features`, { features, inherit });
      if (user?.role === role) await refresh();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const canEditRole = (role: Role) => {
    if (user?.role === 'ADMIN' || user?.isPlatformOwner) return true;
    return user?.role === 'MANAGER' && (role === 'STAFF' || role === 'CASHIER');
  };

  const assignPlace = async (person: Person, locationId: string) => {
    if (!locationId) return;
    setPending(`assign:${person.id}`);
    setError(null);
    try {
      await api.patch(`/nursery/users/${person.id}`, {
        name: person.name,
        role: person.role,
        locationId,
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const startEdit = (person: Person) => {
    setEditingId(person.id);
    setConfirmId(null);
    setAddingPlace(null);
    setDraft({ name: person.name, email: person.email, password: '', role: person.role });
    setDraftPlace(person.locationId ?? '');
  };

  return (
    <div className="w-full">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-forest-200/70 bg-gradient-to-br from-forest-800 via-forest-700 to-forest-600 px-5 py-6 text-white shadow-md sm:px-7 sm:py-7">
        <div
          className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 left-1/3 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl"
          aria-hidden
        />
        <Users
          className="pointer-events-none absolute right-5 top-5 h-16 w-16 rotate-6 text-white/15 sm:right-8 sm:top-6 sm:h-20 sm:w-20"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
              {t('staffTeam.kicker')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('staffTeam.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/90 sm:text-base">
              {site ? `${site.name} · ${t('staffTeam.subtitleLive')}` : t('staffTeam.subtitleLive')}
            </p>
          </div>
          {site && (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm">
                <Users className="h-4 w-4 text-emerald-100" aria-hidden />
                {t('site.peopleCount', { count: peopleCount })}
                {site.userLimit > 0 ? ` / ${site.userLimit}` : ''}
              </span>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm">
                <MapPin className="h-4 w-4 text-emerald-100" aria-hidden />
                {t('staffTeam.placesStat', { count: site.locations.length })}
              </span>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 text-sm font-semibold backdrop-blur-sm">
                <Building2 className="h-4 w-4 text-emerald-100" aria-hidden />
                {t(`site.plans.${site.plan}`, { defaultValue: site.plan })}
              </span>
            </div>
          )}
        </div>
      </section>

      <ErrorNote message={error} />

      {user?.isPlatformOwner && (
        <section className="card mb-5 overflow-hidden border-forest-200/70 bg-gradient-to-br from-forest-50 via-white to-white p-5 shadow-sm">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-100 text-forest-800 ring-1 ring-forest-200/70">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800">{t('staffTeam.pickNursery')}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{t('staffTeam.pickNurseryHelp')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className="input max-w-md"
              value={site?.id || user.nursery?.id || ''}
              onChange={(e) => void switchNursery(e.target.value)}
              aria-label={t('staffTeam.pickNursery')}
            >
              <option value="">{t('staffTeam.pickNurseryPlaceholder')}</option>
              {platformNurseries.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.code})
                </option>
              ))}
            </select>
            <Link to="/platform" className="btn-ghost inline-flex min-h-12">
              {t('staffTeam.openPlatform')}
            </Link>
          </div>
        </section>
      )}

      {!ready && !site ? (
        <ListSkeleton rows={5} />
      ) : site ? (
        <>
          {canManagePeople && (
            <section className="card mb-5 overflow-hidden border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 ring-1 ring-amber-200/70">
                  <Percent className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-800">{t('staffTeam.gstTitle')}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{t('staffTeam.gstHelp')}</p>
                </div>
              </div>
              <form onSubmit={(e) => void saveGst(e)} className="space-y-4">
                <div>
                  <span className="label mb-2 block">{t('staffTeam.gstSlabs')}</span>
                  <div className="flex flex-wrap gap-2">
                    {GST_CHOICES.map((pct) => (
                      <label
                        key={pct}
                        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-sm font-medium ring-1 transition ${
                          gstSlabs.includes(pct)
                            ? 'bg-amber-100 text-amber-950 ring-amber-300'
                            : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-amber-700"
                          checked={gstSlabs.includes(pct)}
                          onChange={() => toggleSlab(pct)}
                        />
                        {t('pos.gstSlab', { pct })}
                      </label>
                    ))}
                  </div>
                </div>
                <Field label={t('staffTeam.gstDefault')} why={t('staffTeam.gstDefaultWhy')} example="5">
                  <select
                    className="input max-w-xs"
                    value={gstDefault}
                    onChange={(e) => setGstDefault(Number(e.target.value))}
                  >
                    {gstSlabs.map((pct) => (
                      <option key={pct} value={pct}>
                        {pct === 0 ? t('pos.gstNone') : t('pos.gstSlab', { pct })}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn-primary min-h-12" type="submit" disabled={pending === 'gst'}>
                    {t('staffTeam.gstSave')}
                  </button>
                  {gstSaved && <span className="text-sm font-medium text-emerald-700">{t('staffTeam.gstSaved')}</span>}
                  {site.currencyCode !== 'INR' && (
                    <span className="text-xs text-amber-800">{t('staffTeam.gstInrHint')}</span>
                  )}
                </div>
              </form>
            </section>
          )}

          <section className="card mb-5 overflow-hidden border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-sm sm:p-6">
            <div className="mb-1 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 ring-1 ring-sky-200/70">
                <Shield className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <h2 className="text-base font-bold text-slate-800">{t('site.roleFeatures')}</h2>
                  <FieldHint why={t('site.hints.featuresWhy')} example={t('site.hints.featuresExample')} />
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {user?.role === 'MANAGER' ? t('site.roleFeaturesManager') : t('site.roleFeaturesHelp')}
                </p>
              </div>
            </div>
            {site.features.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">{t('site.noFeatures')}</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {site.roleAccess.map((row) => {
                  const editable = canEditRole(row.role);
                  const ceiling =
                    editable && user?.role === 'MANAGER' && !user.isPlatformOwner
                      ? site.features.filter((feature) => user.features?.includes(feature))
                      : site.features;
                  const selected = new Set(row.inherit ? ceiling : row.features.filter((f) => ceiling.includes(f)));
                  return (
                    <div
                      key={row.role}
                      className="rounded-2xl border border-sky-100 bg-white/90 p-3.5 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-800">{t(`roles.${row.role}`)}</h3>
                          <p className="text-[11px] text-slate-400">
                            {selected.size}/{ceiling.length}
                          </p>
                        </div>
                        {editable && !row.inherit && (
                          <button
                            className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                            type="button"
                            disabled={pending === `role:${row.role}:all`}
                            onClick={() => saveRoleFeatures(row.role, [], true, `role:${row.role}:all`)}
                          >
                            {t('site.useAll')}
                          </button>
                        )}
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5">
                        {ceiling.map((feature) => {
                          const on = selected.has(feature);
                          const waiting = pending === `role:${row.role}:${feature}`;
                          return (
                            <li key={feature}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={on}
                                disabled={!editable || waiting}
                                onClick={() => {
                                  const next = new Set(selected);
                                  if (next.has(feature)) next.delete(feature);
                                  else next.add(feature);
                                  void saveRoleFeatures(row.role, [...next], false, `role:${row.role}:${feature}`);
                                }}
                                className="flex h-10 w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 text-left text-sm text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-white hover:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="truncate">
                                  {t(`platform.featureLabels.${feature}`, { defaultValue: feature })}
                                </span>
                                <span
                                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-forest-700' : 'bg-slate-200'}`}
                                  aria-hidden
                                >
                                  <span
                                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? 'left-4' : 'left-0.5'}`}
                                  />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t('staffTeam.peopleHeading')}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{t('staffTeam.peopleHint')}</p>
            </div>
            <span className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-800 ring-1 ring-forest-200/80">
              {t('site.peopleCount', { count: peopleCount })}
              {site.userLimit > 0 ? ` / ${site.userLimit}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {places.map((place) => (
              <section
                key={place.id}
                className="card overflow-hidden border-forest-100/80 bg-gradient-to-br from-white via-white to-forest-50/40 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-forest-100/80 bg-forest-50/40 px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-100 text-forest-800 ring-1 ring-forest-200/70">
                      <MapPin className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold leading-tight text-slate-900">
                        {place.name || place.address}
                      </h3>
                      {place.name && <p className="mt-1 text-sm text-slate-500">{place.address}</p>}
                      {!place.whole && <p className="mt-1 text-xs text-slate-400">{t('site.multipleStaff')}</p>}
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-forest-800 ring-1 ring-forest-200/80">
                    {t('site.peopleCount', { count: place.people.length })}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {place.people.map((person) =>
                    editingId === person.id ? (
                      <li key={person.id}>
                        <form
                          onSubmit={(event) => savePerson(event, person)}
                          className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2"
                        >
                          <Field label={t('site.name')} why={t('site.hints.nameWhy')} example={t('site.hints.nameExample')}>
                            <input
                              className="input"
                              required
                              value={draft.name}
                              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                            />
                          </Field>
                          <Field label={t('site.role')} why={t('site.hints.roleWhy')} example={t('site.hints.roleExample')}>
                            <select
                              className="input"
                              value={draft.role}
                              onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
                            >
                              {ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {t(`roles.${role}`)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={t('site.place')} why={t('site.hints.placeWhy')} example={t('site.hints.placeExample')}>
                            <select className="input" value={draftPlace} onChange={(event) => setDraftPlace(event.target.value)}>
                              <option value="">{t('site.unassigned')}</option>
                              {site.locations.map((row) => (
                                <option key={row.id} value={row.id}>
                                  {row.name || row.address}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field
                            label={t('site.password')}
                            why={t('site.hints.passwordKeepWhy')}
                            example={t('site.hints.passwordExample')}
                          >
                            <input
                              className="input"
                              type="password"
                              minLength={draft.password ? 6 : undefined}
                              placeholder={t('platform.hints.passwordExample')}
                              value={draft.password}
                              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                            />
                            <span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">
                              {t('site.passwordKeep')}
                            </span>
                          </Field>
                          <div className="flex gap-2 sm:col-span-2">
                            <button className="btn-primary" disabled={pending === `save:${person.id}`}>
                              {t('common.save')}
                            </button>
                            <button className="btn-ghost" type="button" onClick={() => setEditingId(null)}>
                              {t('common.cancel')}
                            </button>
                          </div>
                        </form>
                      </li>
                    ) : (
                      <RecordItem
                        key={person.id}
                        letter={(person.name || '?').slice(0, 1)}
                        title={
                          <>
                            {person.name}
                            {person.id === user?.id && (
                              <span className="ml-2 align-middle font-sans text-xs font-normal text-slate-400">
                                {t('site.you')}
                              </span>
                            )}
                          </>
                        }
                        subtitle={person.email}
                        extra={
                          !place.whole ? (
                            <p className="mt-1 text-xs font-medium text-forest-800">{place.name || place.address}</p>
                          ) : undefined
                        }
                        tags={
                          <span className="rounded-full bg-[#eef6f0] px-2 py-0.5 text-[11px] font-medium text-[#1f6b45]">
                            {t(`roles.${person.role}`)}
                          </span>
                        }
                        actions={
                          <>
                            {place.whole && (
                              <span className="inline-flex items-center gap-1">
                                <FieldHint why={t('site.hints.placeWhy')} example={t('site.hints.placeExample')} />
                                <select
                                  className="input !h-8 !w-auto !py-1 text-xs"
                                  value=""
                                  disabled={pending === `assign:${person.id}`}
                                  aria-label={t('site.choosePlace')}
                                  onChange={(event) => assignPlace(person, event.target.value)}
                                >
                                  <option value="">{t('site.choosePlace')}</option>
                                  {site.locations.map((row) => (
                                    <option key={row.id} value={row.id}>
                                      {row.name || row.address}
                                    </option>
                                  ))}
                                </select>
                              </span>
                            )}
                            {canManagePeople && (
                              <button
                                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white"
                                type="button"
                                onClick={() => startEdit(person)}
                              >
                                {t('site.edit')}
                              </button>
                            )}
                            {canManagePeople && person.id !== user?.id && confirmId !== person.id && (
                              <button
                                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-white"
                                type="button"
                                onClick={() => {
                                  setConfirmId(person.id);
                                  setEditingId(null);
                                }}
                              >
                                {t('site.delete')}
                              </button>
                            )}
                            {confirmId === person.id && (
                              <>
                                <button
                                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-white disabled:opacity-50"
                                  type="button"
                                  disabled={pending === `delete:${person.id}`}
                                  onClick={() => removePerson(person)}
                                >
                                  {t('site.confirmDelete')}
                                </button>
                                <button
                                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white"
                                  type="button"
                                  onClick={() => setConfirmId(null)}
                                >
                                  {t('common.cancel')}
                                </button>
                              </>
                            )}
                          </>
                        }
                      />
                    ),
                  )}
                  {place.people.length === 0 && (
                    <li className="px-4 py-6 text-sm text-slate-400">{t('site.emptyPeople')}</li>
                  )}
                </ul>
                {canManagePeople && !place.whole && atPeopleLimit && (
                  <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {limitNote}
                  </p>
                )}
                {canManagePeople && !place.whole && !atPeopleLimit && addingPlace !== place.id && (
                  <button
                    className="btn-ghost m-4 !min-h-9 !px-3 !text-xs"
                    type="button"
                    onClick={() => {
                      setAddingPlace(place.id);
                      setEditingId(null);
                      setDraft(blankForm);
                    }}
                  >
                    {t('site.addStaff')}
                  </button>
                )}
                {canManagePeople && !place.whole && !atPeopleLimit && addingPlace === place.id && (
                  <form
                    onSubmit={(event) => addPerson(event, place.id)}
                    className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2"
                  >
                    <Field label={t('site.name')} why={t('site.hints.nameWhy')} example={t('site.hints.nameExample')}>
                      <input
                        className="input"
                        required
                        placeholder={t('platform.hints.adminExample')}
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    </Field>
                    <Field label={t('site.email')} why={t('site.hints.emailWhy')} example={t('site.hints.emailExample')}>
                      <input
                        className="input"
                        type="email"
                        required
                        placeholder={t('platform.hints.emailExample')}
                        value={draft.email}
                        onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                      />
                    </Field>
                    <Field label={t('site.password')} why={t('site.hints.passwordWhy')} example={t('site.hints.passwordExample')}>
                      <input
                        className="input"
                        type="password"
                        required
                        minLength={6}
                        placeholder={t('platform.hints.passwordExample')}
                        value={draft.password}
                        onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                      />
                    </Field>
                    <Field label={t('site.role')} why={t('site.hints.roleWhy')} example={t('site.hints.roleExample')}>
                      <select
                        className="input"
                        value={draft.role}
                        onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`roles.${role}`)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="flex gap-2 sm:col-span-2">
                      <button className="btn-primary" disabled={pending === `add:${place.id}`}>
                        {t('site.addStaff')}
                      </button>
                      <button className="btn-ghost" type="button" onClick={() => setAddingPlace(null)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ))}
            {places.length === 0 && (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 xl:col-span-2">
                {t('staffTeam.noPlaces')}
              </p>
            )}
          </div>
        </>
      ) : ready ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          {t('staffTeam.needNursery')}
          {user?.isPlatformOwner && (
            <>
              {' '}
              <Link to="/platform" className="font-semibold text-emerald-800 underline">
                {t('staffTeam.openPlatform')}
              </Link>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
