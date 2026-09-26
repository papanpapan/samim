import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import { ErrorNote, Field, FieldHint, ListSkeleton, PageHeader, RecordItem } from '../components/ui';

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
  userLimit: number;
  locations: Place[];
  unassigned: Person[];
  features: string[];
  roleAccess: RoleAccess[];
}

const ROLES: Role[] = ['STAFF', 'MANAGER', 'CASHIER', 'ADMIN'];

const blankForm = { name: '', email: '', password: '', role: 'STAFF' as Role };

function showDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

export function Nursery() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const canManagePeople = user?.role === 'ADMIN';
  const [site, setSite] = useState<NurserySite | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blankForm);
  const [draftPlace, setDraftPlace] = useState('');
  const [addingPlace, setAddingPlace] = useState<string | null>(null);

  const load = () =>
    api
      .get('/nursery')
      .then((res) => setSite(res.data.data))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setReady(true));
  useEffect(() => { void load(); }, []);

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
      setError(match
        ? t('site.peopleLimit', {
            plan: t(`site.plans.${site?.plan ?? ''}`, { defaultValue: site?.plan ?? '' }),
            limit: Number(match[1]),
            count: peopleCount || Number(match[1]),
          })
        : raw);
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

  const places = site
    ? [
        ...site.locations.map((place) => ({ ...place, whole: false })),
        ...(site.unassigned.length
          ? [{ id: 'unassigned', name: t('site.unassigned'), address: t('site.unassignedHint'), people: site.unassigned, whole: true }]
          : []),
      ]
    : [];
  const peopleCount = site
    ? site.locations.reduce((sum, place) => sum + place.people.length, 0) + site.unassigned.length
    : 0;
  const atPeopleLimit = !!site && site.userLimit > 0 && peopleCount >= site.userLimit;
  const limitNote = atPeopleLimit && site
    ? t('site.peopleLimit', {
        plan: t(`site.plans.${site.plan}`, { defaultValue: site.plan }),
        limit: site.userLimit,
        count: peopleCount,
      })
    : null;

  return (
    <div>
      <PageHeader title={site?.name ?? t('site.title')} subtitle={t('site.subtitle')} />
      <ErrorNote message={error} />
      {!ready && !site ? (
        <div className="space-y-4">
          <div className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-6 w-24 rounded" />
              </div>
            ))}
          </div>
          <ListSkeleton rows={5} />
        </div>
      ) : site ? (
        <>
          <section className="card mb-4 grid grid-cols-2 divide-y divide-slate-100 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {([
              [t('site.code'), t('site.hints.codeWhy'), t('site.hints.codeExample'), site.code],
              [t('site.phone'), t('site.hints.phoneWhy'), t('site.hints.phoneExample'), site.phone || '—'],
              [t('site.onboarded'), t('site.hints.onboardedWhy'), t('site.hints.onboardedExample'), showDate(site.onboardedAt)],
              [t('site.plan'), t('site.hints.planWhy'), t('site.hints.planExample'), t(`site.plans.${site.plan}`, { defaultValue: site.plan })],
            ] as const).map(([label, why, example, value]) => (
              <div key={label} className="px-5 py-4">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {label}
                  <FieldHint why={why} example={example} />
                </div>
                <div className="mt-1 font-sans text-sm font-semibold tabular-nums tracking-tight text-slate-900">{value}</div>
              </div>
            ))}
          </section>

          <section className="card mb-4 p-5">
            <div className="flex items-center gap-1">
              <h2 className="text-base font-bold text-slate-800">{t('site.roleFeatures')}</h2>
              <FieldHint why={t('site.hints.featuresWhy')} example={t('site.hints.featuresExample')} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{user?.role === 'MANAGER' ? t('site.roleFeaturesManager') : t('site.roleFeaturesHelp')}</p>
            {site.features.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">{t('site.noFeatures')}</p>
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {site.roleAccess.map((row) => {
                  const editable = canEditRole(row.role);
                  const ceiling = editable && user?.role === 'MANAGER' && !user.isPlatformOwner
                    ? site.features.filter((feature) => user.features?.includes(feature))
                    : site.features;
                  const selected = new Set(row.inherit ? ceiling : row.features.filter((feature) => ceiling.includes(feature)));
                  return (
                    <div key={row.role} className="rounded-xl border border-slate-200 bg-[#f7faf8] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-800">{t(`roles.${row.role}`)}</h3>
                          <p className="text-[11px] text-slate-400">{selected.size}/{ceiling.length}</p>
                        </div>
                        {editable && !row.inherit && (
                          <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white disabled:opacity-50" type="button" disabled={pending === `role:${row.role}:all`} onClick={() => saveRoleFeatures(row.role, [], true, `role:${row.role}:all`)}>
                            {t('site.useAll')}
                          </button>
                        )}
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
                                className="flex h-10 w-full items-center justify-between gap-2 rounded-lg bg-white px-3 text-left text-sm text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="truncate">{t(`platform.featureLabels.${feature}`, { defaultValue: feature })}</span>
                                <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-forest-700' : 'bg-slate-200'}`} aria-hidden>
                                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? 'left-4' : 'left-0.5'}`} />
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

          <div className="space-y-4">
            {places.map((place) => (
              <section key={place.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-[1.65rem] font-semibold leading-none text-slate-900">{place.name || place.address}</h2>
                    {place.name && <p className="mt-1 text-sm text-slate-500">{place.address}</p>}
                    {!place.whole && <p className="mt-1 text-xs text-slate-400">{t('site.multipleStaff')}</p>}
                  </div>
                  <span className="rounded-full bg-[#eef6f0] px-2.5 py-1 text-xs font-medium text-[#1f6b45]">
                    {t('site.peopleCount', { count: place.people.length })}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {place.people.map((person) => (
                    editingId === person.id ? (
                    <li key={person.id}>
                        <form onSubmit={(event) => savePerson(event, person)} className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2">
                          <Field label={t('site.name')} why={t('site.hints.nameWhy')} example={t('site.hints.nameExample')}>
                            <input className="input" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                          </Field>
                          <Field label={t('site.role')} why={t('site.hints.roleWhy')} example={t('site.hints.roleExample')}>
                            <select className="input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}>
                              {ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
                            </select>
                          </Field>
                          <Field label={t('site.place')} why={t('site.hints.placeWhy')} example={t('site.hints.placeExample')}>
                            <select className="input" value={draftPlace} onChange={(event) => setDraftPlace(event.target.value)}>
                              <option value="">{t('site.unassigned')}</option>
                              {site.locations.map((row) => (
                                <option key={row.id} value={row.id}>{row.name || row.address}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label={t('site.password')} why={t('site.hints.passwordKeepWhy')} example={t('site.hints.passwordExample')}>
                            <input className="input" type="password" minLength={draft.password ? 6 : undefined} placeholder={t('platform.hints.passwordExample')} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
                            <span className="mt-1 block text-xs normal-case tracking-normal text-slate-400">{t('site.passwordKeep')}</span>
                          </Field>
                          <div className="flex gap-2 sm:col-span-2">
                            <button className="btn-primary" disabled={pending === `save:${person.id}`}>{t('common.save')}</button>
                            <button className="btn-ghost" type="button" onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                          </div>
                        </form>
                    </li>
                      ) : (
                        <RecordItem
                          key={person.id}
                          letter={(person.name || '?').slice(0, 1)}
                          title={<>{person.name}{person.id === user?.id && <span className="ml-2 align-middle font-sans text-xs font-normal text-slate-400">{t('site.you')}</span>}</>}
                          subtitle={person.email}
                          extra={!place.whole ? <p className="mt-1 text-xs font-medium text-forest-800">{place.name || place.address}</p> : undefined}
                          tags={<span className="rounded-full bg-[#eef6f0] px-2 py-0.5 text-[11px] font-medium text-[#1f6b45]">{t(`roles.${person.role}`)}</span>}
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
                                      <option key={row.id} value={row.id}>{row.name || row.address}</option>
                                    ))}
                                  </select>
                                </span>
                              )}
                              {canManagePeople && <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white" type="button" onClick={() => startEdit(person)}>{t('site.edit')}</button>}
                              {canManagePeople && person.id !== user?.id && confirmId !== person.id && (
                                <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-white" type="button" onClick={() => { setConfirmId(person.id); setEditingId(null); }}>{t('site.delete')}</button>
                              )}
                              {confirmId === person.id && (
                                <>
                                  <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-white disabled:opacity-50" type="button" disabled={pending === `delete:${person.id}`} onClick={() => removePerson(person)}>{t('site.confirmDelete')}</button>
                                  <button className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-white" type="button" onClick={() => setConfirmId(null)}>{t('common.cancel')}</button>
                                </>
                              )}
                            </>
                          }
                        />
                      )
                  ))}
                  {place.people.length === 0 && <li className="px-4 py-6 text-sm text-slate-400">{t('site.emptyPeople')}</li>}
                </ul>
                {canManagePeople && !place.whole && atPeopleLimit && (
                  <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{limitNote}</p>
                )}
                {canManagePeople && !place.whole && !atPeopleLimit && addingPlace !== place.id && (
                  <button className="btn-ghost m-4 !min-h-9 !px-3 !text-xs" type="button" onClick={() => { setAddingPlace(place.id); setEditingId(null); setDraft(blankForm); }}>
                    {t('site.addStaff')}
                  </button>
                )}
                {canManagePeople && !place.whole && !atPeopleLimit && addingPlace === place.id && (
                  <form onSubmit={(event) => addPerson(event, place.id)} className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
                    {error && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-2">{error}</p>}
                    <Field label={t('site.name')} why={t('site.hints.nameWhy')} example={t('site.hints.nameExample')}>
                      <input className="input" required placeholder={t('platform.hints.adminExample')} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                    </Field>
                    <Field label={t('site.email')} why={t('site.hints.emailWhy')} example={t('site.hints.emailExample')}>
                      <input className="input" type="email" required placeholder={t('platform.hints.emailExample')} value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                    </Field>
                    <Field label={t('site.password')} why={t('site.hints.passwordWhy')} example={t('site.hints.passwordExample')}>
                      <input className="input" type="password" required minLength={6} placeholder={t('platform.hints.passwordExample')} value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
                    </Field>
                    <Field label={t('site.role')} why={t('site.hints.roleWhy')} example={t('site.hints.roleExample')}>
                      <select className="input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}>
                        {ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
                      </select>
                    </Field>
                    <div className="flex gap-2 sm:col-span-2">
                      <button className="btn-primary" disabled={pending === `add:${place.id}`}>{t('site.addStaff')}</button>
                      <button className="btn-ghost" type="button" onClick={() => setAddingPlace(null)}>{t('common.cancel')}</button>
                    </div>
                  </form>
                )}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
